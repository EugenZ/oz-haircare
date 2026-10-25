// POST /api/outbox/:id/ack — the Shortcut reports a claimed message as sent
// (or failed). Body: { "claim": "<claim from /claim>", "result": "sent" | "failed",
// "error"?: "…" }. Acknowledging an already sent message is a no-op (200).
import { hasBearer, parseId, readBody, unauthorized } from "@/lib/http";
import { ackOutbox } from "@/lib/outbox";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasBearer(request, "OUTBOX_API_TOKEN")) return unauthorized();
  const id = parseId((await params).id);
  if (id === null) return Response.json({ ok: false, error: "not found" }, { status: 404 });
  const { data } = await readBody(request);
  const result = data.result === "failed" ? "failed" : "sent";

  try {
    const ack = await ackOutbox(id, data.claim ?? "", result, data.error);
    return Response.json(ack.body, { status: ack.httpStatus });
  } catch (error) {
    console.warn("[outbox] ack failed:", error instanceof Error ? error.message : error);
    return Response.json({ ok: false, error: "outbox unavailable" }, { status: 503 });
  }
}
