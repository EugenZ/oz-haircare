// GET /api/bookings/availability?date=YYYY-MM-DD&slots=10:00,11:00,…
//
// Returns which of the offered time slots are already busy on the practice's
// Google Calendar (Olya's "primary", via `events.list`). The booking form calls
// this when a date is chosen and greys out / disables the busy slots so a client
// can't pick a time that is already taken.
//
// Fail-open: when Google is not configured or the lookup fails transiently we
// return `busy: []` so a calendar hiccup never blocks a legitimate booking.
import { env as bindingEnv } from "cloudflare:workers";
import { fetchBusySlotsForDay, type GoogleCalendarConfig } from "@/lib/google";

function envValue(name: string): string | undefined {
  const fromProcess = process.env[name];
  if (fromProcess) return fromProcess;
  const fromBinding = bindingEnv as unknown as Record<string, string | undefined>;
  return fromBinding[name];
}

// Kept in sync with TIME_SLOTS in app/page.tsx.
const DEFAULT_SLOTS = [
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

function parseSlots(raw: string | null): string[] {
  if (!raw) return DEFAULT_SLOTS;
  const list = raw
    .split(",")
    .map((slot) => slot.trim())
    .filter(Boolean);
  return list.length ? list : DEFAULT_SLOTS;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date")?.trim() ?? "";
  const slots = parseSlots(url.searchParams.get("slots"));

  if (!isValidDate(date)) {
    return Response.json(
      { ok: false, busy: [], error: "invalid date" },
      { status: 400 },
    );
  }

  const google: GoogleCalendarConfig = {
    clientId: envValue("GOOGLE_OAUTH_CLIENT_ID"),
    clientSecret: envValue("GOOGLE_OAUTH_CLIENT_SECRET"),
    refreshToken: envValue("GOOGLE_OAUTH_REFRESH_TOKEN"),
    calendarId: envValue("GOOGLE_CALENDAR_ID") ?? "primary",
  };

  const result = await fetchBusySlotsForDay(date, slots, google);

  if (!result.attempted) {
    // Google is not configured — nothing to check server-side.
    return Response.json({ ok: true, busy: [], configured: false });
  }
  if (!result.ok) {
    // Best-effort: don't block the form on a transient calendar/authorization
    // error; the form just shows every slot as available.
    console.warn("[availability] freebusy failed:", result.error);
    return Response.json(
      { ok: false, busy: [], configured: true, error: result.error },
      { status: 200 },
    );
  }

  return Response.json({ ok: true, busy: result.busy, configured: true });
}
