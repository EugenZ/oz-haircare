// POST /api/outbox/claim — Olga's iPhone Shortcut picks up client messages.
//
// Auth: `Authorization: Bearer $OUTBOX_API_TOKEN`. Body (JSON):
//   { "channel": "sms" | "instagram", "limit": 10 }
// Response:
//   { ok, channel, count, items: [{ id, claim, text, phone | handle + url, ackUrl, … }] }
// Each item is leased for 2 hours; the Shortcut sends it and then POSTs
// `{ claim, result: "sent" | "failed" }` to its ackUrl. See docs/IPHONE_SHORTCUTS.md.
import { siteUrl } from "@/lib/env";
import { hasBearer, readBody, unauthorized } from "@/lib/http";
import { claimOutbox, isOutboxChannel } from "@/lib/outbox";

export async function POST(request: Request) {
  if (!hasBearer(request, "OUTBOX_API_TOKEN")) return unauthorized();
  const { data } = await readBody(request);
  const channel = data.channel ?? new URL(request.url).searchParams.get("channel") ?? "sms";
  if (!isOutboxChannel(channel)) {
    return Response.json({ ok: false, error: "channel must be sms or instagram" }, { status: 400 });
  }
  const requested = Number.parseInt(data.limit ?? "10", 10);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 20) : 10;

  try {
    const items = await claimOutbox(channel, limit, siteUrl(request));
    return Response.json({ ok: true, channel, count: items.length, items });
  } catch (error) {
    console.warn("[outbox] claim failed:", error instanceof Error ? error.message : error);
    return Response.json({ ok: false, error: "outbox unavailable" }, { status: 503 });
  }
}
