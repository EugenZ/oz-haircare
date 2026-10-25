// Booking notifications + calendar invites.
//
// This module is intentionally dependency-free and safe to run anywhere: when no
// email backend is configured (local dev, tests) `sendBookingNotifications`
// returns `{ attempted: false }` instead of throwing, so the booking form still
// confirms locally.
//
// Two calendar behaviors, chosen by configuration:
//  1) If Google OAuth is configured (config.google), a real event is created on
//     the practice's calendar and the client is added as an attendee, so Google
//     emails them a native invite. The event's htmlLink is returned as the
//     calendarUrl. See docs/GOOGLE_CALENDAR_SETUP.md.
//  2) Otherwise the client "invite" is a Google Calendar "add to calendar" link
//     plus a downloadable .ics file. This needs no OAuth and opens in any
//     calendar app.
//
// Email delivery is provider-agnostic: point EMAIL_API_URL at any REST email API
// that accepts a JSON { from, to, subject, html, text } envelope (Resend's
// https://api.resend.com/emails by default). Set an optional EMAIL_API_KEY to
// send `Authorization: Bearer <key>`.

import {
  createCalendarEvent,
  type CalendarEventResult,
  type GoogleCalendarConfig,
} from "./google";

export type Language = "ru" | "en";

export type BookingPayload = {
  name: string;
  contact: string;
  email?: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  service?: string;
  message?: string;
  language?: Language;
};

export type BookingInvite = {
  title: string;
  start: string; // "YYYY-MM-DDTHH:MM:00"
  end: string; // "YYYY-MM-DDTHH:MM:00"
  location?: string;
  description?: string;
  calendarUrl: string;
};

export type EmailBackendConfig = {
  apiUrl?: string;
  apiKey?: string;
  notifyEmail?: string; // the practice's "meeting" mailbox
  fromEmail?: string;
  siteUrl?: string;
  google?: GoogleCalendarConfig; // optional server-created Calendar event
};

export type SendResult = {
  attempted: boolean;
  ok: boolean;
  error?: string;
  calendarUrl?: string;
  ics?: string;
  calendarEvent?: CalendarEventResult;
};

const MEETING_MINUTES = 60;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

// Add minutes to an "HH:MM" clock string (capped within a single day).
export function addMinutesToClock(clock: string, minutes: number): string {
  const parts = clock.split(":");
  const hours = Number.parseInt(parts[0] ?? "0", 10);
  const mins = Number.parseInt(parts[1] ?? "0", 10);
  const total = hours * 60 + mins + minutes;
  const clamped = ((total % 1440) + 1440) % 1440;
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}

// Build start/end datetimes from the chosen day + slot.
export function toEventDates(date: string, time: string): { start: string; end: string } {
  const end = addMinutesToClock(time, MEETING_MINUTES);
  return { start: `${date}T${time}:00`, end: `${date}T${end}:00` };
}

// "2026-11-02T10:00:00" -> "20261102T100000"
function icsStamp(iso: string): string {
  return iso.replace(/[-:]/g, "");
}

// Google Calendar "add to calendar" link for the meeting.
export function buildCalendarInviteUrl(invite: BookingInvite): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: invite.title,
    dates: `${icsStamp(invite.start)}/${icsStamp(invite.end)}`,
  });
  if (invite.location) params.set("location", invite.location);
  if (invite.description) params.set("details", invite.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcs(value: string): string {
  return value.replace(/([,;\\])/g, "\\$1").replace(/\r?\n/g, "\\n");
}

// A minimal, valid .ics file for the meeting.
export function buildIcs(invite: BookingInvite, uid?: string): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const uidSafe = uid ? uid.replace(/[^A-Za-z0-9._-]/g, "-") : "booking";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OZ SPA//Booking//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uidSafe}@oz-spa`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsStamp(invite.start)}`,
    `DTEND:${icsStamp(invite.end)}`,
    `SUMMARY:${escapeIcs(invite.title)}`,
  ];
  if (invite.location) lines.push(`LOCATION:${escapeIcs(invite.location)}`);
  if (invite.description) lines.push(`DESCRIPTION:${escapeIcs(invite.description)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

export function buildInviteFromPayload(
  payload: BookingPayload,
  fallbackTitle = "Запись на встречу",
): BookingInvite {
  const { start, end } = toEventDates(payload.date, payload.time);
  const lang = payload.language ?? "ru";
  const service = payload.service?.trim() || fallbackTitle;
  const title = `OZ SPA · ${service}`;
  const description = [
    `${lang === "ru" ? "Клиент" : "Client"}: ${payload.name}`,
    `${lang === "ru" ? "Контакт" : "Contact"}: ${payload.contact}${
      payload.email ? ` (${payload.email})` : ""
    }`,
    `${lang === "ru" ? "Услуга" : "Service"}: ${service}`,
    `${lang === "ru" ? "Сообщение" : "Message"}: ${payload.message?.trim() || "—"}`,
  ].join("\n");
  const localeLocation =
    lang === "ru" ? "Лос Анджелес · очно" : "Los Angeles · in person";
  const calendarUrl = buildCalendarInviteUrl({
    title,
    start,
    end,
    location: localeLocation,
    description,
  });
  return { title, start, end, location: localeLocation, description, calendarUrl };
}

function esc(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function notifyHtml(payload: BookingPayload, invite: BookingInvite, calendarUrl: string): string {
  const rows: [string, string][] = [
    ["Клиент / Client", payload.name],
    ["Контакт / Contact", `${payload.contact}${payload.email ? ` · ${payload.email}` : ""}`],
    ["Услуга / Service", payload.service || "—"],
    ["Дата / Date", `${invite.start} — ${invite.end}`],
  ];
  const body = rows
    .map(([k, v]) => `<tr><td style="color:#8a8a8a;padding:6px 0">${k}</td><td style="padding:6px 0">${esc(v)}</td></tr>`)
    .join("");
  return `
    <p>${invite.title}</p>
    <table style="font-family:sans-serif">${body}</table>
    ${payload.message ? `<p style="margin-top:12px"><strong>Сообщение / Message:</strong> ${esc(payload.message)}</p>` : ""}
    <p style="margin-top:16px"><a href="${esc(calendarUrl)}">Открыть в календаре / Open in calendar</a></p>
    <p style="color:#8a8a8a;font-size:12px">OZ SPA · Запись на встречу / booking request</p>
  `;
}

function clientHtml(
  payload: BookingPayload,
  invite: BookingInvite,
  calendarUrl: string,
  siteUrl?: string,
): string {
  const lang = payload.language ?? "ru";
  const greet =
    lang === "ru"
      ? `Спасибо, ${esc(payload.name)}! Ваша заявка принята.`
      : `Thank you, ${esc(payload.name)}! Your request has been received.`;
  const cta = lang === "ru" ? "Добавить в календарь" : "Add to calendar";
  const hint =
    lang === "ru"
      ? "Нажмите, чтобы добавить встречу в свой календарь (Google Calendar)."
      : "Click to add this meeting to your calendar (Google Calendar).";
  const home = siteUrl ? `<p style="margin-top:16px">${esc(siteUrl)}</p>` : "";
  return `
    <p>${greet}</p>
    <p style="margin-top:8px">${esc(invite.title)} — ${invite.start}</p>
    <p style="margin-top:16px"><a href="${esc(calendarUrl)}">${cta}</a></p>
    <p style="color:#8a8a8a;font-size:12px">${hint}</p>
    ${home}
  `;
}

// Send a booking notification to the practice and (if the client left an email)
// a confirmation + calendar invite to the client. Best-effort: a failure is
// reported in the result but never throws, so the booking is not lost.
//
// When config.google is set, a real Calendar event is created first; its htmlLink
// becomes the calendarUrl handed to the client. When it is not set, the client
// gets a Google Calendar "add to calendar" link plus the .ics.
export async function sendBookingNotifications(
  payload: BookingPayload,
  config: EmailBackendConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  const invite = buildInviteFromPayload(
    payload,
    payload.language === "en" ? "Consultation" : "Запись на встречу",
  );
  let calendarUrl = invite.calendarUrl;
  let calendarEvent: CalendarEventResult = { attempted: false, ok: true };
  const ics = buildIcs(
    invite,
    `${invite.start}-${payload.name}`.replace(/[^A-Za-z0-9._-]/g, "-"),
  );
  const clientEmail = payload.email?.trim();

  // 1) Server-created Google Calendar event (when configured). The client is
  // added as an attendee, so Google emails them a native invite.
  if (config.google) {
    calendarEvent = await createCalendarEvent(
      invite,
      clientEmail,
      config.google,
      fetchImpl,
    );
    if (calendarEvent.ok && calendarEvent.htmlLink) {
      calendarUrl = calendarEvent.htmlLink;
    }
  }

  // 2) Email the practice + the client via the configured REST backend.
  const apiUrl = config.apiUrl;
  if (!apiUrl) {
    // No email backend configured — the form confirms locally instead. The
    // calendar event (if any) was still created above.
    return { attempted: false, ok: true, calendarUrl, ics, calendarEvent };
  }

  const results: SendResult[] = [];
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (config.apiKey) headers["authorization"] = `Bearer ${config.apiKey}`;
  const post = (message: {
    to: string;
    subject: string;
    html: string;
  }): Promise<SendResult> =>
    fetchImpl(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: config.fromEmail ?? "OZ SPA <booking@oz-spa.example>",
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.html.replace(/<[^>]+>/g, " "),
      }),
    })
      .then((res) =>
        res.ok
          ? { attempted: true, ok: true }
          : { attempted: true, ok: false, error: `status ${res.status}` },
      )
      .catch((error: unknown) => ({
        attempted: true,
        ok: false,
        error: error instanceof Error ? error.message : "unknown error",
      }));

  if (config.notifyEmail) {
    results.push(
      await post({
        to: config.notifyEmail,
        subject: `Новая запись · ${payload.name} · ${invite.start}`,
        html: notifyHtml(payload, invite, calendarUrl),
      }),
    );
  }
  if (clientEmail && clientEmail.toLowerCase() !== config.notifyEmail?.toLowerCase()) {
    results.push(
      await post({
        to: clientEmail,
        subject: `Подтверждение записи · ${invite.title}`,
        html: clientHtml(payload, invite, calendarUrl, config.siteUrl),
      }),
    );
  }

  const attempted = results.length > 0;
  const ok = results.every((r) => r.ok);
  const errors = results.map((r) => r.error).filter(Boolean) as string[];
  return {
    attempted,
    ok,
    error: errors.length ? errors.join("; ") : undefined,
    calendarUrl,
    ics,
    calendarEvent,
  };
}
