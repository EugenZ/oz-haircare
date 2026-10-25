// Server-created Google Calendar event for a booking.
//
// Requires a Google OAuth refresh token (a personal Gmail/Calendar account, or a
// service account with domain-wide delegation). See docs/GOOGLE_CALENDAR_SETUP.md
// for the full setup. When the credentials are not configured, createCalendarEvent
// returns { attempted: false, ok: true } and the caller falls back to a Google
// Calendar "add to calendar" link + downloadable .ics (no OAuth needed).
//
// On success the client is added as an attendee, so Google emails them a native
// calendar invite automatically; the returned htmlLink is a direct link to the
// created event that we hand back to the booking form.

export type GoogleCalendarConfig = {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  calendarId?: string; // default "primary"
  timeZone?: string; // default "America/Los_Angeles" (the practice location)
  apiBaseUrl?: string; // default "https://www.googleapis.com"
  tokenUrl?: string; // default "https://oauth2.googleapis.com/token"
};

export type CalendarEvent = {
  title: string;
  start: string; // "YYYY-MM-DDTHH:MM:00" (naive local time)
  end: string; // "YYYY-MM-DDTHH:MM:00" (naive local time)
  location?: string;
  description?: string;
};

export type CalendarEventResult = {
  attempted: boolean;
  ok: boolean;
  error?: string;
  eventId?: string;
  htmlLink?: string; // e.g. https://calendar.google.com/event?eid=…
  icalLink?: string;
};

const DEFAULT_API_BASE = "https://www.googleapis.com";
const DEFAULT_TOKEN_URL = "https://oauth2.googleapis.com/token";

// Exchange an OAuth refresh token for a short-lived access token.
export async function fetchAccessToken(
  config: GoogleCalendarConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<{ accessToken?: string; error?: string }> {
  const { clientId, clientSecret, refreshToken } = config;
  const tokenUrl = config.tokenUrl ?? DEFAULT_TOKEN_URL;
  if (!clientId || !clientSecret || !refreshToken) {
    return { error: "missing google oauth credentials" };
  }
  try {
    const res = await fetchImpl(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { error: `token exchange failed: ${res.status} ${text}`.trim() };
    }
    const json = (await res.json()) as { access_token?: string; error?: string };
    if (!json.access_token) {
      return { error: `no access_token: ${json.error ?? "unknown"}` };
    }
    return { accessToken: json.access_token };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "unknown error" };
  }
}

// Create a Calendar event. The client's email is added as an attendee so Google
// sends them a native invite. Returns the event's htmlLink on success.
export async function createCalendarEvent(
  event: CalendarEvent,
  attendeeEmail: string | undefined,
  config: GoogleCalendarConfig = {},
  fetchImpl: typeof fetch = fetch,
): Promise<CalendarEventResult> {
  const {
    clientId,
    clientSecret,
    refreshToken,
    calendarId = "primary",
    timeZone = "America/Los_Angeles",
    apiBaseUrl = DEFAULT_API_BASE,
  } = config;

  if (!clientId || !clientSecret || !refreshToken) {
    // Not configured — fall back to the calendar link + .ics path.
    return { attempted: false, ok: true };
  }

  const token = await fetchAccessToken(config, fetchImpl);
  if (!token.accessToken) {
    return { attempted: true, ok: false, error: token.error };
  }

  // Calendar "dateTime" is interpreted in the event's timeZone, so we pass the
  // naive local slot plus the zone.
  const body = {
    summary: event.title,
    start: { dateTime: event.start, timeZone },
    end: { dateTime: event.end, timeZone },
    location: event.location,
    description: event.description,
    attendees: attendeeEmail ? [{ email: attendeeEmail, optional: false }] : [],
  };

  try {
    const res = await fetchImpl(
      `${apiBaseUrl}/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token.accessToken}`,
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        attempted: true,
        ok: false,
        error: `create event failed: ${res.status} ${text}`.trim(),
      };
    }
    const json = (await res.json()) as {
      id?: string;
      htmlLink?: string;
      icalLink?: string;
    };
    return {
      attempted: true,
      ok: true,
      eventId: json.id,
      htmlLink: json.htmlLink,
      icalLink: json.icalLink,
    };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
}

// ---------------------------------------------------------------------------
// Availability: which offered slots are already busy on the practice calendar.
//
// Uses the Calendar `events.list` endpoint (a bounded window) and treats a slot
// (a 60-minute block) as "busy" when any confirmed event on that local day
// overlaps it. `freebusy` is avoided because some API clients have it disabled.
// When Google is not configured this returns `{ attempted: false }` so callers
// fall back to showing every slot.

export type BusySlotsResult = {
  attempted: boolean;
  ok: boolean;
  busy: string[]; // the subset of `slots` that overlap a busy interval
  error?: string;
};

// A slot is a one-hour block ending 60 minutes after its start.
const SLOT_MINUTES = 60;

// Convert an RFC3339 instant to its wall-clock in `timeZone` (DST-aware via Intl),
// returning the local calendar day + minutes-of-day. Null when unparseable.
function localWallClock(
  instant: string,
  timeZone: string,
): { date: string; minutes: number } | null {
  const ms = Date.parse(instant);
  if (Number.isNaN(ms)) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(ms));
  const value = (type: string): string =>
    parts.find((part) => part.type === type)?.value ?? "00";
  const hour = Number(value("hour")) % 24; // some ICU builds emit 24 for midnight
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minutes: hour * 60 + Number(value("minute")),
  };
}

// Ask the calendar which of `slots` are busy on the local day `date`
// ("YYYY-MM-DD", in the calendar's timeZone).
export async function fetchBusySlotsForDay(
  date: string,
  slots: string[],
  config: GoogleCalendarConfig = {},
  fetchImpl: typeof fetch = fetch,
): Promise<BusySlotsResult> {
  const {
    clientId,
    clientSecret,
    refreshToken,
    calendarId = "primary",
    timeZone = "America/Los_Angeles",
    apiBaseUrl = DEFAULT_API_BASE,
  } = config;

  if (!clientId || !clientSecret || !refreshToken) {
    return { attempted: false, ok: true, busy: [] };
  }

  const token = await fetchAccessToken(config, fetchImpl);
  if (!token.accessToken) {
    return { attempted: true, ok: false, busy: [], error: token.error };
  }

  // A wide window (48h) guarantees we capture the whole local day regardless of
  // the timezone offset / DST; we then filter the day's events to the local day.
  // We use `events.list` rather than `freebusy`: some API clients have the
  // freebusy method disabled (it 404s), while `events.list` is always available.
  const timeMin = `${date}T00:00:00Z`;
  const timeMax = new Date(Date.parse(timeMin) + 48 * 60 * 60 * 1000).toISOString();
  const query = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });

  try {
    const res = await fetchImpl(
      `${apiBaseUrl}/calendar/v3/calendars/${encodeURIComponent(
        calendarId,
      )}/events?${query.toString()}`,
      { headers: { authorization: `Bearer ${token.accessToken}` } },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        attempted: true,
        ok: false,
        busy: [],
        error: `list events failed: ${res.status} ${text}`.trim(),
      };
    }

    const json = (await res.json()) as {
      items?: Array<{
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
        status?: string;
      }>;
    };
    const items = json.items ?? [];

    const busy = new Set<string>();
    for (const item of items) {
      if (item.status === "cancelled") continue; // cancelled = not busy

      // All-day event: it occupies the whole local day it falls on.
      if (item.start?.date) {
        if (item.start.date === date) for (const slot of slots) busy.add(slot);
        continue;
      }

      const startInstant = item.start?.dateTime;
      if (!startInstant) continue;

      const start = localWallClock(startInstant, timeZone);
      if (!start || start.date !== date) continue; // different local day

      let endMinutes = 1440; // clip to end of day when the end is missing/next day
      const endInstant = item.end?.dateTime;
      if (endInstant) {
        const end = localWallClock(endInstant, timeZone);
        if (end && end.date === date) endMinutes = end.minutes;
      }

      for (const slot of slots) {
        const [hours, minutes] = slot.split(":").map(Number);
        const slotStart = hours * 60 + minutes;
        const slotEnd = slotStart + SLOT_MINUTES;
        if (start.minutes < slotEnd && slotStart < endMinutes) busy.add(slot);
      }
    }

    return { attempted: true, ok: true, busy: [...busy] };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      busy: [],
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
}
