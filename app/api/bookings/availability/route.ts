// GET /api/bookings/availability?date=YYYY-MM-DD&slots=10:00,11:00,…
//
// Returns which of the offered time slots are already taken: busy on the
// practice's Google Calendar (Olya's "primary", via `events.list`) or held by a
// confirmed booking in the database. Pending requests do not block a slot. The
// booking form calls this when a date is chosen and disables the taken slots.
//
// Fail-open: when Google / the database is not configured or the lookup fails
// transiently we return what we know, so a hiccup never blocks a booking.
import { confirmedSlotsForDay } from "@/lib/bookings";
import { googleConfig } from "@/lib/env";
import { fetchBusySlotsForDay } from "@/lib/google";
import { TIME_SLOTS } from "@/lib/slots";
import { isValidDate } from "@/lib/time";

function parseSlots(raw: string | null): string[] {
  if (!raw) return TIME_SLOTS;
  const list = raw
    .split(",")
    .map((slot) => slot.trim())
    .filter(Boolean);
  return list.length ? list : TIME_SLOTS;
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

  const [result, confirmed] = await Promise.all([
    fetchBusySlotsForDay(date, slots, googleConfig()),
    confirmedSlotsForDay(date),
  ]);
  const booked = slots.filter((slot) => confirmed.includes(slot));

  if (!result.attempted) {
    // Google is not configured — only confirmed bookings can be checked.
    return Response.json({ ok: true, busy: booked, configured: false });
  }
  if (!result.ok) {
    // Best-effort: don't block the form on a transient calendar/authorization
    // error; the form just shows every slot that isn't booked as available.
    console.warn("[availability] calendar lookup failed:", result.error);
    return Response.json(
      { ok: false, busy: booked, configured: true, error: result.error },
      { status: 200 },
    );
  }

  const busy = [...new Set([...result.busy, ...booked])];
  return Response.json({ ok: true, busy, configured: true });
}
