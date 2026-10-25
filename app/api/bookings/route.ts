// POST /api/bookings — receive a "Запись на встречу" request.
//
// 1) Validate the request; the contact is a phone number OR an Instagram handle
//    (`contactType`), the email is optional.
// 2) Refuse a slot that is already taken (a confirmed booking or a busy Google
//    Calendar event). Pending requests never block a slot.
// 3) Persist it as `pending` and email Olga a link to confirm / decline /
//    propose another time; the client (if they left an email) gets "request
//    received". The Google Calendar event is created only on confirmation.
//    See lib/bookings.ts for the whole lifecycle.
//
// GET /api/bookings — the most recent requests (admin inbox), protected by
// `Authorization: Bearer $ADMIN_API_TOKEN`.
import { bookingContext, createBooking, listRecentBookings, slotAvailability } from "@/lib/bookings";
import { parseContact } from "@/lib/contact";
import { envValue } from "@/lib/env";
import { hasBearer, unauthorized } from "@/lib/http";
import { pickLanguage } from "@/lib/messages";
import { isValidDate, isValidTime, slotStartsInPast } from "@/lib/time";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const field = (key: string): string => String(raw?.[key] ?? "").trim();

  const name = field("name");
  const contact = field("contact");
  const email = field("email");
  const date = field("date");
  const time = field("time");
  const service = field("service");
  const message = field("message");
  const language = pickLanguage(raw?.language);
  const say = (ru: string, en: string) => (language === "en" ? en : ru);

  if (!name || !contact || !date || !time) {
    return Response.json(
      { error: "name, contact, date and time are required" },
      { status: 400 },
    );
  }
  if (!isValidDate(date) || !isValidTime(time)) {
    return Response.json({ error: "date and time must be valid" }, { status: 400 });
  }
  if (slotStartsInPast(date, time)) {
    return Response.json(
      { ok: false, error: say("Это время уже прошло.", "This time has already passed.") },
      { status: 400 },
    );
  }
  if (email && !EMAIL_PATTERN.test(email)) {
    return Response.json(
      { ok: false, error: say("Проверьте email.", "Please check the email address.") },
      { status: 400 },
    );
  }
  const parsed = parseContact(raw.contactType, contact, envValue("DEFAULT_PHONE_COUNTRY"));
  if (!parsed.ok) {
    return Response.json(
      {
        ok: false,
        field: "contact",
        contactType: parsed.type,
        error:
          parsed.type === "phone"
            ? say("Проверьте номер телефона.", "Please check the phone number.")
            : say("Проверьте ник в Instagram.", "Please check the Instagram username."),
      },
      { status: 400 },
    );
  }

  const ctx = bookingContext(request);
  const slot = await slotAvailability(date, time, ctx);
  if (slot.taken) {
    return Response.json(
      {
        ok: false,
        error: say(
          "Это время уже занято. Пожалуйста, выберите другое время.",
          "This time is already booked. Please choose another slot.",
        ),
        date,
        time,
      },
      { status: 409 },
    );
  }

  const result = await createBooking(
    {
      name,
      contact,
      contactType: parsed.type,
      contactNormalized: parsed.normalized,
      email,
      date,
      time,
      service,
      message,
      language,
    },
    ctx,
  );

  return Response.json(
    {
      ok: true,
      id: result.id,
      persisted: result.persisted,
      status: "pending",
      contactType: parsed.type,
      notify: result.notify,
      ...(result.dbError ? { dbError: result.dbError } : {}),
    },
    { status: 201 },
  );
}

export async function GET(request: Request) {
  if (!hasBearer(request, "ADMIN_API_TOKEN")) return unauthorized();
  try {
    return Response.json({ bookings: await listRecentBookings() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "database unavailable";
    return Response.json({ bookings: [], error: message }, { status: 200 });
  }
}
