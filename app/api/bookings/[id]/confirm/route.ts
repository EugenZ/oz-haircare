// POST /api/bookings/:id/confirm — Olga confirms a pending request (form post
// from /booking/manage, or JSON `{ token }`). Creates the Google Calendar event
// and notifies the client (email with .ics + SMS / Instagram via the outbox).
import { bookingContext, confirmBooking } from "@/lib/bookings";
import { actionResponse, parseId, readBody } from "@/lib/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  const { form, data } = await readBody(request);
  const token = data.token ?? "";
  const result =
    id === null
      ? ({ ok: false, error: "not_found" } as const)
      : await confirmBooking(id, token, bookingContext(request));
  return actionResponse(request, form, result, {
    page: "/booking/manage",
    query: { id: String(id ?? ""), t: token },
    done: "confirmed",
  });
}
