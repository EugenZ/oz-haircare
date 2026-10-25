// POST /api/bookings — receive a "Запись на встречу" request.
//
// 1) Persist the request to Postgres/Neon when a connection is configured. This
//    is best-effort: a missing or failing database must not stop notifications.
// 2) Create a server-side Google Calendar event (when OAuth is configured) so the
//    client is added as an attendee and Google emails them a native invite.
// 3) Notify the practice's "meeting" mailbox and (optionally) the client by email
//    (calendar link + .ics fallback) when an email backend is configured.
//
// GET /api/bookings — list the most recent requests (a quick inbox). Returns an
// empty list when the database is unavailable, so it never 500s without a DB.
import { desc } from "drizzle-orm";
import { env as bindingEnv } from "cloudflare:workers";
import { getDb } from "@/db";
import { bookings } from "@/db/schema";
import {
  buildInviteFromPayload,
  sendBookingNotifications,
  type BookingPayload,
} from "@/lib/email";
import {
  fetchBusySlotsForDay,
  type GoogleCalendarConfig,
} from "@/lib/google";

function envValue(name: string): string | undefined {
  const fromProcess = process.env[name];
  if (fromProcess) return fromProcess;
  const fromBinding = bindingEnv as unknown as Record<string, string | undefined>;
  return fromBinding[name];
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

function isValidTime(value: string): boolean {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

export async function POST(request: Request) {
  let raw: Partial<BookingPayload>;
  try {
    raw = (await request.json()) as Partial<BookingPayload>;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = String(raw.name ?? "").trim();
  const contact = String(raw.contact ?? "").trim();
  const email = String(raw.email ?? "").trim();
  const date = String(raw.date ?? "").trim();
  const time = String(raw.time ?? "").trim();
  const service = String(raw.service ?? "").trim();
  const message = String(raw.message ?? "").trim();
  const language = raw.language === "en" ? "en" : "ru";

  if (!name || !contact || !date || !time) {
    return Response.json(
      { error: "name, contact, date and time are required" },
      { status: 400 },
    );
  }
  if (!isValidDate(date) || !isValidTime(time)) {
    return Response.json({ error: "date and time must be valid" }, { status: 400 });
  }

  const payload: BookingPayload = { name, contact, email, date, time, service, message, language };

  // Build the calendar invite up front so the response can hand the client a
  // one-click "add to calendar" link even when email / Google is not configured.
  const invite = buildInviteFromPayload(
    payload,
    language === "en" ? "Consultation" : "Запись на встречу",
  );

  // Build the Google calendar config once and reuse it for the double-booking
  // guard and for creating the server event / attendee invite.
  const google: GoogleCalendarConfig = {
    clientId: envValue("GOOGLE_OAUTH_CLIENT_ID"),
    clientSecret: envValue("GOOGLE_OAUTH_CLIENT_SECRET"),
    refreshToken: envValue("GOOGLE_OAUTH_REFRESH_TOKEN"),
    calendarId: envValue("GOOGLE_CALENDAR_ID"),
  };

  // 0) Guard: never double-book a time that is already busy on the practice's
  // calendar. Fail open when the calendar can't be checked so a transient
  // error never drops a legitimate booking.
  const busy = await fetchBusySlotsForDay(date, [time], google);
  if (busy.attempted && busy.ok && busy.busy.includes(time)) {
    return Response.json(
      {
        ok: false,
        error:
          language === "en"
            ? "This time is already booked. Please choose another slot."
            : "Это время уже занято. Пожалуйста, выберите другое время.",
        date,
        time,
      },
      { status: 409 },
    );
  }

  // 1) Persist to Postgres/Neon when available.
  let id: number | undefined;
  let persisted = false;
  let dbError: string | undefined;
  try {
    const db = getDb();
    const [row] = await db
      .insert(bookings)
      .values({
        name,
        contact,
        email,
        date,
        time,
        service,
        message,
        status: "new",
        calendarUrl: invite.calendarUrl ?? "",
      })
      .returning();
    id = row?.id;
    persisted = id !== undefined;
  } catch (error) {
    dbError = error instanceof Error ? error.message : "database unavailable";
    console.warn("[bookings] could not persist to database:", dbError);
  }

  // 2) Create a server-side Google Calendar event (when OAuth is configured) and
  // 3) notify the practice + invite the client by email (best-effort).
  const notify = await sendBookingNotifications(
    payload,
    {
      apiUrl: envValue("EMAIL_API_URL"),
      apiKey: envValue("EMAIL_API_KEY"),
      notifyEmail: envValue("BOOKING_NOTIFY_EMAIL") ?? envValue("OLGA_EMAIL"),
      fromEmail: envValue("EMAIL_FROM"),
      siteUrl: envValue("SITE_URL"),
      google,
    },
  );

  return Response.json(
    {
      ok: true,
      id,
      persisted,
      calendarUrl: notify.calendarUrl,
      ics: notify.ics,
      calendarEvent: notify.calendarEvent,
      notify,
      ...(dbError ? { dbError } : {}),
    },
    { status: 201 },
  );
}

export async function GET() {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(bookings)
      .orderBy(desc(bookings.createdAt), desc(bookings.id))
      .limit(50);
    return Response.json({ bookings: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "database unavailable";
    return Response.json({ bookings: [], error: message }, { status: 200 });
  }
}
