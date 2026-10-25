import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Lifecycle of a booking request:
//   pending   — submitted by the client, waiting for Olga
//   proposed  — Olga proposed another date/time, waiting for the client
//   confirmed — confirmed (directly or by accepting a proposal); has a Calendar event
//   declined  — Olga declined the request
//   cancelled — the client declined Olga's proposal
export type BookingStatus =
  | "pending"
  | "proposed"
  | "confirmed"
  | "declined"
  | "cancelled";

export type ContactType = "phone" | "instagram";

// Booking requests submitted through the "Запись на встречу" / "Book a visit"
// section. Persisted to a Postgres database (Neon) whenever a connection is
// configured; without a database the form still sends notifications, but the
// confirm / propose / outbox flow needs the stored row (see lib/bookings.ts).
export const bookings = pgTable(
  "bookings",
  {
    id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
    name: text("name").notNull(),
    contact: text("contact").notNull(),
    // "" for legacy rows created before the phone / Instagram toggle.
    contactType: text("contact_type").$type<ContactType | "">().notNull().default(""),
    // E.164 phone ("+13105551234") or a lowercase Instagram handle without "@".
    contactNormalized: text("contact_normalized").notNull().default(""),
    email: text("email").notNull().default(""),
    date: text("date").notNull(),
    time: text("time").notNull(),
    service: text("service").notNull().default(""),
    message: text("message").notNull().default(""),
    language: text("language").$type<"ru" | "en">().notNull().default("ru"),
    status: text("status").$type<BookingStatus>().notNull().default("pending"),
    // SHA-256 hashes of random tokens; the raw tokens only live in links.
    manageTokenHash: text("manage_token_hash"),
    viewTokenHash: text("view_token_hash"),
    proposedDate: text("proposed_date"),
    proposedTime: text("proposed_time"),
    proposedAt: timestamp("proposed_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    declinedAt: timestamp("declined_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    calendarEventId: text("calendar_event_id").notNull().default(""),
    calendarUrl: text("calendar_url").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    // Pending requests may share a slot; only one booking per slot can be confirmed.
    uniqueIndex("bookings_confirmed_slot_idx")
      .on(table.date, table.time)
      .where(sql`${table.status} = 'confirmed'`),
  ],
);

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;

export type OutboxChannel = "sms" | "instagram";
export type OutboxKind = "confirmed" | "proposed" | "declined";
export type OutboxStatus = "pending" | "claimed" | "sent" | "failed" | "cancelled";

// Messages to the client that are delivered from Olga's iPhone (Shortcuts):
// SMS is sent automatically, Instagram is pasted into the DM by hand. The
// Shortcut claims rows via POST /api/outbox/claim and acknowledges them via
// POST /api/outbox/:id/ack (see docs/IPHONE_SHORTCUTS.md).
export const outbox = pgTable(
  "outbox",
  {
    id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    channel: text("channel").$type<OutboxChannel>().notNull(),
    kind: text("kind").$type<OutboxKind>().notNull(),
    recipient: text("recipient").notNull(),
    body: text("body").notNull(),
    status: text("status").$type<OutboxStatus>().notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    claimId: text("claim_id"),
    claimedUntil: timestamp("claimed_until", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    lastError: text("last_error").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("outbox_booking_channel_kind_idx").on(
      table.bookingId,
      table.channel,
      table.kind,
    ),
    index("outbox_channel_status_idx").on(table.channel, table.status),
  ],
);

export type OutboxMessage = typeof outbox.$inferSelect;
