// POST /api/bookings/:id/decline — Olga declines a pending / proposed request
// and the client is notified (email + SMS / Instagram via the outbox).
import { bookingContext, declineBooking } from "@/lib/bookings";
import { actionResponse, parseId, readBody } from "@/lib/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  const { form, data } = await readBody(request);
  const token = data.token ?? "";
  const result =
    id === null
      ? ({ ok: false, error: "not_found" } as const)
      : await declineBooking(id, token, bookingContext(request));
  return actionResponse(request, form, result, {
    page: "/booking/manage",
    query: { id: String(id ?? ""), t: token },
    done: "declined",
  });
}
