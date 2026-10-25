// GET /api/bookings/:id/ics?v=<view token> — the confirmed visit as an .ics
// file (the "Apple Calendar" link in the confirmation email / booking page).
import { bookingContext, findBookingByToken, toPayload, viewUrl } from "@/lib/bookings";
import { buildIcs, buildInviteFromPayload } from "@/lib/email";
import { parseId } from "@/lib/http";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  const token = new URL(request.url).searchParams.get("v") ?? "";
  if (id === null || !token) return new Response("Not found", { status: 404 });

  let row;
  try {
    row = await findBookingByToken(id, token, "view");
  } catch {
    return new Response("Service unavailable", { status: 503 });
  }
  if (!row || row.status !== "confirmed") return new Response("Not found", { status: 404 });

  const ics = buildIcs(buildInviteFromPayload(toPayload(row)), `booking-${row.id}`, {
    url: viewUrl(bookingContext(request), row.id, token),
  });
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="oz-spa-booking.ics"',
      "cache-control": "private, no-store",
    },
  });
}
