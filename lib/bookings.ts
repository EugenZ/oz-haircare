// Booking lifecycle: request -> (Olga) confirm | decline | propose another time
// -> (client) accept | decline the proposal.
//
// - A request is stored as `pending`; Olga gets an email with a manage link
//   (/booking/manage). Nothing is written to Google Calendar yet.
// - Pending requests do not block a slot: several may share one. Only a
//   confirmed booking (or a busy Google Calendar event) makes a slot taken, and a
//   partial unique index allows a single confirmed booking per slot.
// - Every state change that the client must hear about emails them (when they
//   left an email) and queues an SMS / Instagram message in the outbox, which
//   Olga's iPhone Shortcut delivers (lib/outbox.ts).
// - Links carry random tokens; only their SHA-256 hashes are stored. The client
//   view token is rotated whenever Olga acts, since its raw value is not kept.
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/db";
import {
  bookings,
  outbox,
  type Booking,
  type BookingStatus,
  type OutboxChannel,
} from "@/db/schema";
import {
  buildIcs,
  buildInviteFromPayload,
  clientConfirmedEmail,
  clientDeclinedEmail,
  clientProposalEmail,
  clientReceivedEmail,
  practitionerRequestEmail,
  practitionerResponseEmail,
  sendEmail,
  type BookingPayload,
  type EmailBackendConfig,
  type EmailContent,
  type SendResult,
} from "./email";
import { emailConfig, envFlag, envNumber, googleConfig, siteUrl } from "./env";
import { createCalendarEvent, fetchBusySlotsForDay, type GoogleCalendarConfig } from "./google";
import { clientMessageText, formatSlot, pickLanguage, type ClientMessageKind } from "./messages";
import { slotStartsInPast } from "./time";
import { calendarEventIdFor, generateToken, hashToken, safeEqual } from "./tokens";
import type { ContactType } from "./contact";

export type BookingContext = {
  siteUrl: string;
  google: GoogleCalendarConfig;
  email: EmailBackendConfig;
  inviteAttendee: boolean;
  proposalTtlHours: number;
};

export function bookingContext(request?: Request): BookingContext {
  return {
    siteUrl: siteUrl(request),
    google: googleConfig(),
    email: emailConfig(),
    inviteAttendee: envFlag("GOOGLE_INVITE_ATTENDEE"),
    proposalTtlHours: envNumber("BOOKING_PROPOSAL_TTL_HOURS", 48),
  };
}

export type ActionError =
  | "not_found"
  | "invalid_state"
  | "invalid_input"
  | "slot_taken"
  | "past"
  | "expired"
  | "calendar_failed"
  | "unavailable";

export type ActionResult =
  | { ok: true; status: BookingStatus; booking: Booking }
  | { ok: false; error: ActionError; detail?: string };

function fail(error: ActionError, detail?: string): ActionResult {
  return { ok: false, error, detail };
}

// Any unexpected failure (no DATABASE_URL, Neon down) becomes "unavailable".
async function guarded(run: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await run();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    console.warn("[bookings] action failed:", detail);
    return fail("unavailable", detail);
  }
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export function manageUrl(ctx: BookingContext, id: number, token: string): string {
  return `${ctx.siteUrl}/booking/manage?id=${id}&t=${encodeURIComponent(token)}`;
}

export function viewUrl(ctx: BookingContext, id: number, token: string): string {
  return `${ctx.siteUrl}/booking/view?id=${id}&v=${encodeURIComponent(token)}`;
}

export function icsUrl(ctx: BookingContext, id: number, token: string): string {
  return `${ctx.siteUrl}/api/bookings/${id}/ics?v=${encodeURIComponent(token)}`;
}

export function toPayload(
  row: Booking,
  slot: { date: string; time: string } = row,
): BookingPayload {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact,
    contactType: row.contactType,
    email: row.email,
    date: slot.date,
    time: slot.time,
    service: row.service,
    message: row.message,
    language: pickLanguage(row.language),
  };
}

export function proposalExpired(
  row: Booking,
  ttlHours: number,
  now: Date = new Date(),
): boolean {
  if (!row.proposedAt) return false;
  return now.getTime() - row.proposedAt.getTime() > ttlHours * 60 * 60 * 1000;
}

// Times on `date` that already have a confirmed booking. Fails open (empty)
// when the database is unavailable.
export async function confirmedSlotsForDay(date: string, excludeId?: number): Promise<string[]> {
  try {
    const db = getDb();
    const rows = await db
      .select({ time: bookings.time })
      .from(bookings)
      .where(
        and(
          eq(bookings.date, date),
          eq(bookings.status, "confirmed"),
          excludeId !== undefined ? ne(bookings.id, excludeId) : undefined,
        ),
      );
    return rows.map((row) => row.time);
  } catch {
    return [];
  }
}

// A slot is taken when a confirmed booking or a Google Calendar event holds it.
// Pending / proposed requests never block a slot.
export async function slotAvailability(
  date: string,
  time: string,
  ctx: BookingContext,
  excludeId?: number,
): Promise<{ taken: boolean; source?: "booking" | "calendar" }> {
  const confirmed = await confirmedSlotsForDay(date, excludeId);
  if (confirmed.includes(time)) return { taken: true, source: "booking" };
  const busy = await fetchBusySlotsForDay(date, [time], ctx.google);
  if (busy.attempted && busy.ok && busy.busy.includes(time)) {
    return { taken: true, source: "calendar" };
  }
  return { taken: false };
}

export async function findBookingByToken(
  id: number,
  token: string,
  kind: "manage" | "view",
): Promise<Booking | null> {
  if (!Number.isSafeInteger(id) || id <= 0 || !token) return null;
  const db = getDb();
  const [row] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!row) return null;
  const stored = kind === "manage" ? row.manageTokenHash : row.viewTokenHash;
  if (!stored) return null;
  return safeEqual(await hashToken(token), stored) ? row : null;
}

// ---------------------------------------------------------------------------
// New request (POST /api/bookings)

export type NewBookingInput = {
  name: string;
  contact: string;
  contactType: ContactType;
  contactNormalized: string;
  email: string;
  date: string;
  time: string;
  service: string;
  message: string;
  language: "ru" | "en";
};

export async function createBooking(input: NewBookingInput, ctx: BookingContext) {
  const manageToken = generateToken();
  let id: number | undefined;
  let dbError: string | undefined;
  try {
    const db = getDb();
    const [row] = await db
      .insert(bookings)
      .values({
        ...input,
        status: "pending",
        manageTokenHash: await hashToken(manageToken),
      })
      .returning({ id: bookings.id });
    id = row?.id;
  } catch (error) {
    dbError = error instanceof Error ? error.message : "database unavailable";
    console.warn("[bookings] could not persist to database:", dbError);
  }
  const persisted = id !== undefined;

  const payload: BookingPayload = { ...input, id };
  const notifyEmail = ctx.email.notifyEmail;
  const practitioner: SendResult = notifyEmail
    ? await sendEmail(ctx.email, {
        to: notifyEmail,
        ...practitionerRequestEmail(payload, {
          manageUrl: id !== undefined ? manageUrl(ctx, id, manageToken) : undefined,
        }),
      })
    : { attempted: false, ok: true };
  const client: SendResult =
    input.email && input.email.toLowerCase() !== notifyEmail?.toLowerCase()
      ? await sendEmail(ctx.email, {
          to: input.email,
          ...clientReceivedEmail(payload, ctx.siteUrl || undefined),
        })
      : { attempted: false, ok: true };

  return { id, persisted, dbError, notify: { practitioner, client } };
}

// ---------------------------------------------------------------------------
// Client notifications (email + outbox)

function outboxChannel(row: Booking): OutboxChannel | null {
  if (!row.contactNormalized) return null;
  if (row.contactType === "phone") return "sms";
  if (row.contactType === "instagram") return "instagram";
  return null;
}

async function enqueueClientMessage(
  row: Booking,
  kind: ClientMessageKind,
  body: string,
): Promise<void> {
  const channel = outboxChannel(row);
  if (!channel) return;
  const db = getDb();
  const now = new Date();
  // Older, not yet delivered messages for this booking are now stale.
  await db
    .update(outbox)
    .set({ status: "cancelled", updatedAt: now })
    .where(
      and(eq(outbox.bookingId, row.id), eq(outbox.status, "pending"), ne(outbox.kind, kind)),
    );
  await db
    .insert(outbox)
    .values({ bookingId: row.id, channel, kind, recipient: row.contactNormalized, body })
    .onConflictDoUpdate({
      target: [outbox.bookingId, outbox.channel, outbox.kind],
      set: {
        recipient: row.contactNormalized,
        body,
        status: "pending",
        attempts: 0,
        claimId: null,
        claimedUntil: null,
        sentAt: null,
        lastError: "",
        updatedAt: now,
      },
    });
}

async function cancelPendingOutbox(bookingId: number): Promise<void> {
  const db = getDb();
  await db
    .update(outbox)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(outbox.bookingId, bookingId), eq(outbox.status, "pending")));
}

async function notifyClient(
  row: Booking,
  kind: ClientMessageKind,
  viewToken: string,
  ctx: BookingContext,
): Promise<void> {
  const language = pickLanguage(row.language);
  const payload = toPayload(row);
  const view = viewUrl(ctx, row.id, viewToken);
  const bookAgain = `${ctx.siteUrl}/#booking`;

  let email: EmailContent;
  let text: string;
  if (kind === "confirmed") {
    const invite = buildInviteFromPayload(payload);
    const ics = buildIcs(invite, `booking-${row.id}`, { url: view });
    email = clientConfirmedEmail(
      payload,
      { viewUrl: view, googleUrl: invite.calendarUrl, icsUrl: icsUrl(ctx, row.id, viewToken) },
      ics,
    );
    text = clientMessageText("confirmed", {
      name: row.name,
      language,
      slot: formatSlot(row.date, row.time, language),
      url: view,
    });
  } else if (kind === "proposed") {
    const proposed = { date: row.proposedDate ?? row.date, time: row.proposedTime ?? row.time };
    email = clientProposalEmail(payload, proposed, view);
    text = clientMessageText("proposed", {
      name: row.name,
      language,
      slot: formatSlot(proposed.date, proposed.time, language),
      previousSlot: formatSlot(row.date, row.time, language),
      url: view,
    });
  } else {
    email = clientDeclinedEmail(payload, bookAgain);
    text = clientMessageText("declined", {
      name: row.name,
      language,
      slot: formatSlot(row.date, row.time, language),
      url: bookAgain,
    });
  }

  if (row.email) await sendEmail(ctx.email, { to: row.email, ...email });
  await enqueueClientMessage(row, kind, text);
}

async function notifyPractitioner(row: Booking, accepted: boolean, ctx: BookingContext) {
  if (!ctx.email.notifyEmail) return;
  await sendEmail(ctx.email, {
    to: ctx.email.notifyEmail,
    ...practitionerResponseEmail(toPayload(row), accepted),
  });
}

// ---------------------------------------------------------------------------
// Actions

// pending|proposed -> confirmed for `slot`, then create the Calendar event. On a
// Calendar failure the booking is rolled back so the action can be retried.
async function finalizeConfirmation(
  row: Booking,
  slot: { date: string; time: string },
  from: "pending" | "proposed",
  ctx: BookingContext,
  existingViewToken?: string,
): Promise<ActionResult> {
  const db = getDb();
  const viewToken = existingViewToken ?? generateToken();
  const viewTokenHash = existingViewToken ? row.viewTokenHash : await hashToken(viewToken);

  let confirmed: Booking | undefined;
  try {
    [confirmed] = await db
      .update(bookings)
      .set({
        status: "confirmed",
        date: slot.date,
        time: slot.time,
        viewTokenHash,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(bookings.id, row.id), eq(bookings.status, from)))
      .returning();
  } catch (error) {
    if (isUniqueViolation(error)) return fail("slot_taken");
    throw error;
  }
  if (!confirmed) return fail("invalid_state");

  const invite = buildInviteFromPayload(toPayload(confirmed));
  const event = await createCalendarEvent(
    {
      ...invite,
      id: await calendarEventIdFor(row.id, row.manageTokenHash ?? viewTokenHash ?? ""),
    },
    ctx.inviteAttendee && confirmed.email ? confirmed.email : undefined,
    ctx.google,
  );
  if (event.attempted && !event.ok) {
    await db
      .update(bookings)
      .set({
        status: from,
        date: row.date,
        time: row.time,
        viewTokenHash: row.viewTokenHash,
        confirmedAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(bookings.id, row.id), eq(bookings.status, "confirmed")));
    return fail("calendar_failed", event.error);
  }

  const [saved] = await db
    .update(bookings)
    .set({
      calendarEventId: event.eventId ?? "",
      calendarUrl: event.htmlLink ?? invite.calendarUrl,
    })
    .where(eq(bookings.id, row.id))
    .returning();
  const booking = saved ?? confirmed;
  await notifyClient(booking, "confirmed", viewToken, ctx);
  return { ok: true, status: "confirmed", booking };
}

export function confirmBooking(id: number, token: string, ctx: BookingContext) {
  return guarded(async () => {
    const row = await findBookingByToken(id, token, "manage");
    if (!row) return fail("not_found");
    if (row.status !== "pending") return fail("invalid_state");
    if (slotStartsInPast(row.date, row.time)) return fail("past");
    const slot = await slotAvailability(row.date, row.time, ctx, row.id);
    if (slot.taken) return fail("slot_taken");
    return finalizeConfirmation(row, row, "pending", ctx);
  });
}

export function declineBooking(id: number, token: string, ctx: BookingContext) {
  return guarded(async () => {
    const row = await findBookingByToken(id, token, "manage");
    if (!row) return fail("not_found");
    if (row.status !== "pending" && row.status !== "proposed") return fail("invalid_state");
    const viewToken = generateToken();
    const db = getDb();
    const [declined] = await db
      .update(bookings)
      .set({
        status: "declined",
        declinedAt: new Date(),
        viewTokenHash: await hashToken(viewToken),
        updatedAt: new Date(),
      })
      .where(and(eq(bookings.id, row.id), inArray(bookings.status, ["pending", "proposed"])))
      .returning();
    if (!declined) return fail("invalid_state");
    await notifyClient(declined, "declined", viewToken, ctx);
    return { ok: true, status: "declined", booking: declined };
  });
}

export function proposeBooking(
  id: number,
  token: string,
  slot: { date: string; time: string },
  ctx: BookingContext,
) {
  return guarded(async () => {
    const row = await findBookingByToken(id, token, "manage");
    if (!row) return fail("not_found");
    if (row.status !== "pending" && row.status !== "proposed") return fail("invalid_state");
    if (slot.date === row.date && slot.time === row.time) return fail("invalid_input");
    if (slotStartsInPast(slot.date, slot.time)) return fail("past");
    const availability = await slotAvailability(slot.date, slot.time, ctx, row.id);
    if (availability.taken) return fail("slot_taken");

    const viewToken = generateToken();
    const db = getDb();
    const [proposed] = await db
      .update(bookings)
      .set({
        status: "proposed",
        proposedDate: slot.date,
        proposedTime: slot.time,
        proposedAt: new Date(),
        viewTokenHash: await hashToken(viewToken),
        updatedAt: new Date(),
      })
      .where(and(eq(bookings.id, row.id), inArray(bookings.status, ["pending", "proposed"])))
      .returning();
    if (!proposed) return fail("invalid_state");
    await notifyClient(proposed, "proposed", viewToken, ctx);
    return { ok: true, status: "proposed", booking: proposed };
  });
}

export function respondToProposal(
  id: number,
  token: string,
  accept: boolean,
  ctx: BookingContext,
) {
  return guarded(async () => {
    const row = await findBookingByToken(id, token, "view");
    if (!row) return fail("not_found");
    if (row.status !== "proposed" || !row.proposedDate || !row.proposedTime) {
      return fail("invalid_state");
    }
    if (proposalExpired(row, ctx.proposalTtlHours)) return fail("expired");
    const slot = { date: row.proposedDate, time: row.proposedTime };

    if (accept) {
      if (slotStartsInPast(slot.date, slot.time)) return fail("past");
      const availability = await slotAvailability(slot.date, slot.time, ctx, row.id);
      if (availability.taken) return fail("slot_taken");
      const result = await finalizeConfirmation(row, slot, "proposed", ctx, token);
      if (result.ok) await notifyPractitioner(result.booking, true, ctx);
      return result;
    }

    const db = getDb();
    const [cancelled] = await db
      .update(bookings)
      .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
      .where(and(eq(bookings.id, row.id), eq(bookings.status, "proposed")))
      .returning();
    if (!cancelled) return fail("invalid_state");
    await cancelPendingOutbox(row.id);
    await notifyPractitioner({ ...cancelled, date: slot.date, time: slot.time }, false, ctx);
    return { ok: true, status: "cancelled", booking: cancelled };
  });
}

// ---------------------------------------------------------------------------
// Admin inbox (GET /api/bookings) — never exposes token hashes.

export async function listRecentBookings(limit = 50) {
  const db = getDb();
  const rows = await db
    .select()
    .from(bookings)
    .orderBy(desc(bookings.createdAt), desc(bookings.id))
    .limit(limit);
  return rows.map((row) => {
    const { manageTokenHash, viewTokenHash, ...rest } = row;
    void manageTokenHash;
    void viewTokenHash;
    return rest;
  });
}
