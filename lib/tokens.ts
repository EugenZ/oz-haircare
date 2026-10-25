// Unguessable tokens for the booking links. Only SHA-256 hashes are stored in
// the database; the raw token lives in the email / SMS link alone.

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// 32 random bytes, URL-safe (43 characters).
export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return toHex(new Uint8Array(digest));
}

// Constant-time comparison for equal-length strings.
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

// Deterministic Google Calendar event id for a booking, so a retried
// confirmation can never create a second event (Google answers 409 instead).
// Event ids must use base32hex characters (a–v, 0–9); hex is a subset.
export async function calendarEventIdFor(bookingId: number, seed: string): Promise<string> {
  const digest = await hashToken(`calendar-event:${bookingId}:${seed}`);
  return `bk${bookingId}${digest.slice(0, 20)}`;
}
