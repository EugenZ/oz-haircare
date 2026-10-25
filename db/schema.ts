import { sql } from "drizzle-orm";
import { integer, pgTable, timestamp, text } from "drizzle-orm/pg-core";

// Booking requests submitted through the "Запись на встречу" / "Book a visit"
// section. Persisted to a Postgres database (Neon) whenever a connection is
// configured; the form still works without a database (see
// app/api/bookings/route.ts), which stores nothing but keeps sending
// notifications when an email / Google Calendar backend is configured.
export const bookings = pgTable("bookings", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  email: text("email").notNull().default(""),
  date: text("date").notNull(),
  time: text("time").notNull(),
  service: text("service").notNull().default(""),
  message: text("message").notNull().default(""),
  status: text("status").notNull().default("new"),
  calendarUrl: text("calendar_url").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
