// POST /api/bookings/:id/propose — Olga proposes another date / time
// (`{ token, date, time }`). The booking becomes `proposed` and the client gets
// a link to accept or decline it (email + SMS / Instagram via the outbox).
import { bookingContext, proposeBooking } from "@/lib/bookings";
import { actionResponse, parseId, readBody } from "@/lib/http";
import { isValidDate, isValidTime } from "@/lib/time";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  const { form, data } = await readBody(request);
  const token = data.token ?? "";
  const date = data.date ?? "";
  const time = data.time ?? "";
  const result =
    id === null
      ? ({ ok: false, error: "not_found" } as const)
      : !isValidDate(date) || !isValidTime(time)
        ? ({ ok: false, error: "invalid_input" } as const)
        : await proposeBooking(id, token, { date, time }, bookingContext(request));
  return actionResponse(request, form, result, {
    page: "/booking/manage",
    query: { id: String(id ?? ""), t: token },
    done: "proposed",
  });
}
