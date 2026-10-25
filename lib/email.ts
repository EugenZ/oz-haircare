// Booking emails + calendar invites.
//
// This module is intentionally dependency-free and safe to run anywhere: when no
// email backend is configured (local dev, tests) `sendEmail` returns
// `{ attempted: false }` instead of throwing, so the booking form still works.
//
// Email delivery targets Resend's JSON API (EMAIL_API_URL, by default
// https://api.resend.com/emails): `{ from, to, subject, html, text,
// attachments: [{ filename, content }] }` with base64 attachment content and an
// optional `Authorization: Bearer <EMAIL_API_KEY>`. Any REST backend accepting
// the same envelope works.
//
// Calendar invites never depend on OAuth: the client gets a Google Calendar
// "add to calendar" link plus an .ics file (attached, and downloadable from the
// booking page for Apple Calendar). Times are written in UTC so every calendar
// shows the Los Angeles slot correctly.

import { formatSlot, LOCATION, type Language } from "./messages";
import { addMinutesToClock, MEETING_MINUTES, utcStamp, zonedToUtc } from "./time";

export type { Language } from "./messages";

export type BookingPayload = {
  id?: number;
  name: string;
  contact: string;
  contactType?: "phone" | "instagram" | "";
  email?: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  service?: string;
  message?: string;
  language?: Language;
};

export type BookingInvite = {
  title: string;
  start: string; // "YYYY-MM-DDTHH:MM:00" (naive Los Angeles time)
  end: string; // "YYYY-MM-DDTHH:MM:00" (naive Los Angeles time)
  location?: string;
  description?: string;
  calendarUrl: string;
};

export type EmailBackendConfig = {
  apiUrl?: string;
  apiKey?: string;
  notifyEmail?: string; // the practice's "meeting" mailbox
  fromEmail?: string;
};

export type EmailAttachment = { filename: string; content: string }; // base64
export type EmailContent = { subject: string; html: string; attachments?: EmailAttachment[] };
export type EmailMessage = EmailContent & { to: string };

export type SendResult = {
  attempted: boolean;
  ok: boolean;
  error?: string;
};

// Build start/end datetimes from the chosen day + slot.
export function toEventDates(date: string, time: string): { start: string; end: string } {
  const end = addMinutesToClock(time, MEETING_MINUTES);
  return { start: `${date}T${time}:00`, end: `${date}T${end}:00` };
}

// "2026-11-02T10:00:00" (Los Angeles) -> "20261102T180000Z"
function instantStamp(localIso: string): string {
  const [date, clock = "00:00"] = localIso.split("T");
  return utcStamp(zonedToUtc(date, clock.slice(0, 5)));
}

// Google Calendar "add to calendar" link for the meeting.
export function buildCalendarInviteUrl(invite: BookingInvite): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: invite.title,
    dates: `${instantStamp(invite.start)}/${instantStamp(invite.end)}`,
  });
  if (invite.location) params.set("location", invite.location);
  if (invite.description) params.set("details", invite.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcs(value: string): string {
  return value.replace(/([,;\\])/g, "\\$1").replace(/\r?\n/g, "\\n");
}

// RFC 5545 line folding: at most 75 octets per line, continuation lines start
// with a space. Folds on code-point boundaries so UTF-8 text stays intact.
function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const chunks: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = chunks.length === 0 ? 75 : 74;
    if (size + bytes > limit) {
      chunks.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += bytes;
  }
  chunks.push(current);
  return chunks.join("\r\n ");
}

// A minimal, valid .ics file for the meeting (UTC times, METHOD:PUBLISH so
// Apple / Google / Outlook import it as a regular event).
export function buildIcs(
  invite: BookingInvite,
  uid?: string,
  options: { url?: string } = {},
): string {
  const stamp = utcStamp(new Date());
  const uidSafe = uid ? uid.replace(/[^A-Za-z0-9._-]/g, "-") : "booking";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OZ SPA//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uidSafe}@oz-spa`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${instantStamp(invite.start)}`,
    `DTEND:${instantStamp(invite.end)}`,
    `SUMMARY:${escapeIcs(invite.title)}`,
  ];
  if (invite.location) lines.push(`LOCATION:${escapeIcs(invite.location)}`);
  if (invite.description) lines.push(`DESCRIPTION:${escapeIcs(invite.description)}`);
  if (options.url) lines.push(`URL:${options.url}`);
  lines.push("STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n");
}

export function buildInviteFromPayload(
  payload: BookingPayload,
  fallbackTitle?: string,
): BookingInvite {
  const { start, end } = toEventDates(payload.date, payload.time);
  const lang = payload.language ?? "ru";
  const service =
    payload.service?.trim() ||
    fallbackTitle ||
    (lang === "en" ? "Consultation" : "Запись на встречу");
  const title = `OZ SPA · ${service}`;
  const description = [
    `${lang === "ru" ? "Клиент" : "Client"}: ${payload.name}`,
    `${lang === "ru" ? "Контакт" : "Contact"}: ${payload.contact}${
      payload.email ? ` (${payload.email})` : ""
    }`,
    `${lang === "ru" ? "Услуга" : "Service"}: ${service}`,
    `${lang === "ru" ? "Сообщение" : "Message"}: ${payload.message?.trim() || "—"}`,
  ].join("\n");
  const location = LOCATION[lang];
  const calendarUrl = buildCalendarInviteUrl({
    title,
    start,
    end,
    location,
    description,
    calendarUrl: "",
  });
  return { title, start, end, location, description, calendarUrl };
}

export function toBase64(text: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function esc(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function link(href: string, label: string): string {
  return `<a href="${esc(href)}" style="color:#c66d4e">${esc(label)}</a>`;
}

function contactLabel(payload: BookingPayload): string {
  const kind =
    payload.contactType === "instagram"
      ? "Instagram"
      : payload.contactType === "phone"
        ? "Телефон / Phone"
        : "Контакт / Contact";
  return `${kind}: ${payload.contact}${payload.email ? ` · ${payload.email}` : ""}`;
}

function detailsTable(payload: BookingPayload): string {
  const rows: [string, string][] = [
    ["Клиент / Client", payload.name],
    ["Контакт / Contact", contactLabel(payload)],
    ["Услуга / Service", payload.service || "—"],
    ["Дата / Date", formatSlot(payload.date, payload.time, "ru")],
  ];
  const body = rows
    .map(
      ([k, v]) =>
        `<tr><td style="color:#8a8a8a;padding:6px 12px 6px 0">${k}</td><td style="padding:6px 0">${esc(v)}</td></tr>`,
    )
    .join("");
  return `<table style="font-family:sans-serif">${body}</table>${
    payload.message
      ? `<p style="margin-top:12px"><strong>Сообщение / Message:</strong> ${esc(payload.message)}</p>`
      : ""
  }`;
}

const footer = `<p style="color:#8a8a8a;font-size:12px;margin-top:20px">OZ SPA · Запись на встречу / booking</p>`;

// Olga: a new request with the link to confirm / decline / propose.
export function practitionerRequestEmail(
  payload: BookingPayload,
  options: { manageUrl?: string },
): EmailContent {
  const action = options.manageUrl
    ? `<p style="margin-top:16px">${link(options.manageUrl, "Подтвердить, отклонить или предложить другое время →")}</p>
       <p style="color:#8a8a8a;font-size:12px">Событие в календаре создаётся только после подтверждения.</p>`
    : `<p style="margin-top:16px;color:#b3412e">База данных недоступна — заявка не сохранена. Подтвердите запись вручную и свяжитесь с клиентом.</p>`;
  return {
    subject: `Новая заявка · ${payload.name} · ${formatSlot(payload.date, payload.time, "ru")}`,
    html: `<p>Новая заявка на встречу${payload.id ? ` #${payload.id}` : ""}.</p>${detailsTable(payload)}${action}${footer}`,
  };
}

// Olga: the client answered her proposal.
export function practitionerResponseEmail(
  payload: BookingPayload,
  accepted: boolean,
): EmailContent {
  const slot = formatSlot(payload.date, payload.time, "ru");
  return {
    subject: accepted
      ? `Клиент принял время · ${payload.name} · ${slot}`
      : `Клиент отказался от предложенного времени · ${payload.name}`,
    html: `<p>${
      accepted
        ? `Клиент принял предложенное время — ${esc(slot)}. Событие добавлено в календарь.`
        : `Клиент отказался от предложенного времени (${esc(slot)}). Заявка закрыта.`
    }</p>${detailsTable(payload)}${footer}`,
  };
}

// Client: request received (sent right after submission, no calendar file yet).
export function clientReceivedEmail(payload: BookingPayload, siteUrl?: string): EmailContent {
  const lang = payload.language ?? "ru";
  const slot = formatSlot(payload.date, payload.time, lang);
  const home = siteUrl ? `<p style="margin-top:16px">${link(siteUrl, siteUrl)}</p>` : "";
  return lang === "en"
    ? {
        subject: `Request received · OZ SPA · ${slot}`,
        html: `<p>Thank you, ${esc(payload.name)}! Your request has been received.</p>
          <p>${esc(slot)} · ${esc(LOCATION.en)}</p>
          <p>Olga will check the time and confirm your visit. You'll get the confirmation with a calendar invite.</p>${home}`,
      }
    : {
        subject: `Заявка получена · OZ SPA · ${slot}`,
        html: `<p>Спасибо, ${esc(payload.name)}! Ваша заявка получена.</p>
          <p>${esc(slot)} · ${esc(LOCATION.ru)}</p>
          <p>Ольга проверит время и подтвердит запись — вы получите подтверждение с приглашением в календарь.</p>${home}`,
      };
}

// Client: confirmed, with the .ics attached plus Google / Apple calendar links.
export function clientConfirmedEmail(
  payload: BookingPayload,
  links: { viewUrl: string; googleUrl: string; icsUrl: string },
  ics: string,
): EmailContent {
  const lang = payload.language ?? "ru";
  const slot = formatSlot(payload.date, payload.time, lang);
  const attachments = [{ filename: "oz-spa-booking.ics", content: toBase64(ics) }];
  const calendars = `<p style="margin-top:16px">${link(links.googleUrl, "Google Calendar")} · ${link(
    links.icsUrl,
    "Apple Calendar (.ics)",
  )}</p>`;
  return lang === "en"
    ? {
        subject: `Visit confirmed · OZ SPA · ${slot}`,
        html: `<p>${esc(payload.name)}, your visit is confirmed.</p>
          <p><strong>${esc(slot)}</strong> · ${esc(LOCATION.en)}</p>
          ${calendars}
          <p style="color:#8a8a8a;font-size:12px">The invite is also attached (.ics). Booking details: ${link(links.viewUrl, links.viewUrl)}</p>`,
        attachments,
      }
    : {
        subject: `Запись подтверждена · OZ SPA · ${slot}`,
        html: `<p>${esc(payload.name)}, ваша запись подтверждена.</p>
          <p><strong>${esc(slot)}</strong> · ${esc(LOCATION.ru)}</p>
          ${calendars}
          <p style="color:#8a8a8a;font-size:12px">Приглашение также во вложении (.ics). Детали записи: ${link(links.viewUrl, links.viewUrl)}</p>`,
        attachments,
      };
}

// Client: Olga proposes another time; accept / decline on the booking page.
export function clientProposalEmail(
  payload: BookingPayload,
  proposed: { date: string; time: string },
  viewUrl: string,
): EmailContent {
  const lang = payload.language ?? "ru";
  const requested = formatSlot(payload.date, payload.time, lang);
  const slot = formatSlot(proposed.date, proposed.time, lang);
  return lang === "en"
    ? {
        subject: `New time suggested · OZ SPA · ${slot}`,
        html: `<p>${esc(payload.name)}, unfortunately ${esc(requested)} doesn't work.</p>
          <p>Olga suggests <strong>${esc(slot)}</strong> · ${esc(LOCATION.en)}.</p>
          <p style="margin-top:16px">${link(viewUrl, "Accept or decline →")}</p>`,
      }
    : {
        subject: `Предложено другое время · OZ SPA · ${slot}`,
        html: `<p>${esc(payload.name)}, к сожалению, ${esc(requested)} не получится.</p>
          <p>Ольга предлагает <strong>${esc(slot)}</strong> · ${esc(LOCATION.ru)}.</p>
          <p style="margin-top:16px">${link(viewUrl, "Принять или отказаться →")}</p>`,
      };
}

// Client: Olga declined the request.
export function clientDeclinedEmail(payload: BookingPayload, bookAgainUrl: string): EmailContent {
  const lang = payload.language ?? "ru";
  const slot = formatSlot(payload.date, payload.time, lang);
  return lang === "en"
    ? {
        subject: `Booking update · OZ SPA`,
        html: `<p>${esc(payload.name)}, unfortunately Olga can't see you at ${esc(slot)}.</p>
          <p style="margin-top:16px">${link(bookAgainUrl, "Choose another time →")}</p>`,
      }
    : {
        subject: `Запись · OZ SPA`,
        html: `<p>${esc(payload.name)}, к сожалению, Ольга не сможет принять вас ${esc(slot)}.</p>
          <p style="margin-top:16px">${link(bookAgainUrl, "Выбрать другое время →")}</p>`,
      };
}

// Send one email through the configured REST backend. Best-effort: a failure
// is reported in the result but never throws.
export async function sendEmail(
  config: EmailBackendConfig,
  message: EmailMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  if (!config.apiUrl || !message.to) return { attempted: false, ok: true };
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (config.apiKey) headers["authorization"] = `Bearer ${config.apiKey}`;
  try {
    const res = await fetchImpl(config.apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: config.fromEmail ?? "OZ SPA <booking@oz-spa.example>",
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        ...(message.attachments?.length ? { attachments: message.attachments } : {}),
      }),
    });
    return res.ok
      ? { attempted: true, ok: true }
      : { attempted: true, ok: false, error: `status ${res.status}` };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
}
