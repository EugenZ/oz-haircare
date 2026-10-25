// Wall-clock helpers for the practice's time zone. Booking slots are stored as
// naive local "YYYY-MM-DD" + "HH:MM" strings in Los Angeles time; these helpers
// turn them into real instants (DST-aware via Intl) for .ics files, calendar
// links and "is this slot already in the past" checks.

export const PRACTICE_TIME_ZONE = "America/Los_Angeles";
export const MEETING_MINUTES = 60;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

export function isValidTime(value: string): boolean {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

// Add minutes to an "HH:MM" clock string (wrapped within a single day).
export function addMinutesToClock(clock: string, minutes: number): string {
  const parts = clock.split(":");
  const hours = Number.parseInt(parts[0] ?? "0", 10);
  const mins = Number.parseInt(parts[1] ?? "0", 10);
  const total = hours * 60 + mins + minutes;
  const clamped = ((total % 1440) + 1440) % 1440;
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}

// Offset (ms) between the wall clock in `timeZone` and UTC at `instant`.
function zoneOffsetMs(instant: number, timeZone: string): number {
  const seconds = Math.floor(instant / 1000) * 1000;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(seconds));
  const value = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour") % 24,
    value("minute"),
    value("second"),
  );
  return asUtc - seconds;
}

// "2026-11-02" + "10:00" in Los Angeles -> the matching UTC instant.
export function zonedToUtc(
  date: string,
  time: string,
  timeZone: string = PRACTICE_TIME_ZONE,
): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const naive = Date.UTC(year, month - 1, day, hours, minutes);
  const first = naive - zoneOffsetMs(naive, timeZone);
  const second = naive - zoneOffsetMs(first, timeZone);
  return new Date(second);
}

// Date -> "20261102T180000Z" (iCalendar / Google Calendar UTC form).
export function utcStamp(instant: Date): string {
  return instant
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

export function slotStartsInPast(
  date: string,
  time: string,
  now: Date = new Date(),
): boolean {
  return zonedToUtc(date, time).getTime() <= now.getTime();
}

// Today's local date ("YYYY-MM-DD") in the practice's time zone.
export function todayInPracticeZone(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PRACTICE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
