// Outbox for client messages delivered from Olga's iPhone (Shortcuts).
//
// claim: atomically leases up to `limit` pending rows (FOR UPDATE SKIP LOCKED)
// for LEASE_HOURS and hands each a fresh claim id. A row whose lease expired
// without an ack is offered again, at most MAX_ATTEMPTS times in total, so a
// lost ack can cause at most one duplicate message.
// ack: marks a claimed row as sent (idempotent) or failed (retried while
// attempts remain).
import { and, asc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { outbox, type OutboxChannel, type OutboxMessage } from "@/db/schema";

export const MAX_ATTEMPTS = 2;
export const LEASE_HOURS = 2;

export function isOutboxChannel(value: unknown): value is OutboxChannel {
  return value === "sms" || value === "instagram";
}

export type ClaimedItem = {
  id: number;
  bookingId: number;
  channel: OutboxChannel;
  kind: string;
  claim: string;
  text: string;
  attempts: number;
  ackUrl: string;
  phone?: string;
  handle?: string;
  url?: string;
};

function toItem(row: OutboxMessage, siteUrl: string): ClaimedItem {
  const item: ClaimedItem = {
    id: row.id,
    bookingId: row.bookingId,
    channel: row.channel,
    kind: row.kind,
    claim: row.claimId ?? "",
    text: row.body,
    attempts: row.attempts,
    ackUrl: `${siteUrl}/api/outbox/${row.id}/ack`,
  };
  if (row.channel === "sms") item.phone = row.recipient;
  else {
    item.handle = row.recipient;
    item.url = `https://ig.me/m/${encodeURIComponent(row.recipient)}`;
  }
  return item;
}

export async function claimOutbox(
  channel: OutboxChannel,
  limit: number,
  siteUrl: string,
): Promise<ClaimedItem[]> {
  const db = getDb();
  const leaseExpired = lt(outbox.claimedUntil, sql`now()`);

  // Leases that ran out on the last attempt will not be offered again.
  await db
    .update(outbox)
    .set({
      status: "failed",
      lastError: "lease expired without ack after max attempts",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(outbox.channel, channel),
        eq(outbox.status, "claimed"),
        leaseExpired,
        gte(outbox.attempts, MAX_ATTEMPTS),
      ),
    );

  const claimable = db
    .select({ id: outbox.id })
    .from(outbox)
    .where(
      and(
        eq(outbox.channel, channel),
        or(
          eq(outbox.status, "pending"),
          and(eq(outbox.status, "claimed"), leaseExpired, lt(outbox.attempts, MAX_ATTEMPTS)),
        ),
      ),
    )
    .orderBy(asc(outbox.id))
    .limit(limit)
    .for("update", { skipLocked: true });

  const rows = await db
    .update(outbox)
    .set({
      status: "claimed",
      claimId: sql`gen_random_uuid()::text`,
      claimedUntil: sql.raw(`now() + interval '${LEASE_HOURS} hours'`),
      attempts: sql`${outbox.attempts} + 1`,
      updatedAt: new Date(),
    })
    .where(inArray(outbox.id, claimable))
    .returning();

  return rows.sort((a, b) => a.id - b.id).map((row) => toItem(row, siteUrl));
}

export type AckResult = {
  httpStatus: number;
  body: { ok: boolean; id: number; status?: string; error?: string; duplicate?: boolean };
};

export async function ackOutbox(
  id: number,
  claim: string,
  result: "sent" | "failed",
  error?: string,
): Promise<AckResult> {
  const db = getDb();
  const [row] = await db.select().from(outbox).where(eq(outbox.id, id)).limit(1);
  if (!row) return { httpStatus: 404, body: { ok: false, id, error: "not found" } };
  if (row.status === "sent") {
    return { httpStatus: 200, body: { ok: true, id, status: "sent", duplicate: true } };
  }
  if (row.status === "cancelled") {
    return { httpStatus: 200, body: { ok: true, id, status: "cancelled" } };
  }
  if (!claim || row.claimId !== claim) {
    return { httpStatus: 409, body: { ok: false, id, error: "claim mismatch" } };
  }

  const owned = and(eq(outbox.id, id), eq(outbox.claimId, claim));
  if (result === "sent") {
    await db
      .update(outbox)
      .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
      .where(owned);
    return { httpStatus: 200, body: { ok: true, id, status: "sent" } };
  }

  const status = row.attempts >= MAX_ATTEMPTS ? "failed" : "pending";
  await db
    .update(outbox)
    .set({
      status,
      claimId: null,
      claimedUntil: null,
      lastError: (error ?? "reported as failed").slice(0, 500),
      updatedAt: new Date(),
    })
    .where(owned);
  return { httpStatus: 200, body: { ok: true, id, status } };
}
