// POST /api/bookings/:id/respond — the client accepts or declines Olga's
// proposed time (`{ token, decision: "accept" | "decline" }`, the token from
// their /booking/view link). Accept confirms the booking at the new time.
import { bookingContext, respondToProposal } from "@/lib/bookings";
import { actionResponse, parseId, readBody } from "@/lib/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  const { form, data } = await readBody(request);
  const token = data.token ?? "";
  const decision = data.decision;
  const result =
    id === null
      ? ({ ok: false, error: "not_found" } as const)
      : decision !== "accept" && decision !== "decline"
        ? ({ ok: false, error: "invalid_input" } as const)
        : await respondToProposal(id, token, decision === "accept", bookingContext(request));
  return actionResponse(request, form, result, {
    page: "/booking/view",
    query: { id: String(id ?? ""), v: token },
    done: decision === "accept" ? "accepted" : "declined",
  });
}
