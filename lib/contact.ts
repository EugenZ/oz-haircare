// Client contact parsing: the booking form asks for a phone number OR an
// Instagram handle. Phones are normalized to E.164 so the iPhone Shortcut can
// text them directly; handles are normalized for https://ig.me/m/<handle>.

import type { ContactType } from "../db/schema";

export type { ContactType } from "../db/schema";

export type ParsedContact =
  | { ok: true; type: ContactType; normalized: string }
  | { ok: false; type: ContactType };

// National prefixes for numbers written without "+" (DEFAULT_PHONE_COUNTRY).
const COUNTRY_CODES: Record<string, string> = { US: "1", CA: "1", RU: "7" };
const INSTAGRAM_HANDLE = /^[a-z0-9._]{1,30}$/;

export function normalizePhone(raw: string, defaultCountry = "US"): string | null {
  const trimmed = raw.trim();
  if (!/^[+\d\s().-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  const code = COUNTRY_CODES[defaultCountry.toUpperCase()] ?? "1";

  let full: string;
  if (trimmed.startsWith("+")) full = digits;
  else if (trimmed.startsWith("00")) full = digits.slice(2);
  else if (digits.length === 10) full = code + digits;
  else if (code === "7" && digits.length === 11 && digits.startsWith("8")) {
    full = `7${digits.slice(1)}`;
  } else full = digits;

  if (full.length < 8 || full.length > 15) return null;
  return `+${full}`;
}

export function normalizeInstagram(raw: string): string | null {
  let value = raw.trim();
  const url = /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#\s]+)/i.exec(value);
  if (url) value = url[1];
  value = value.replace(/^@/, "").toLowerCase();
  return INSTAGRAM_HANDLE.test(value) ? value : null;
}

// Legacy clients (or API callers) may omit contactType: anything with "@",
// an instagram.com URL or letters is treated as an Instagram handle.
export function guessContactType(raw: string): ContactType {
  const value = raw.trim();
  if (/instagram\.com/i.test(value) || value.startsWith("@")) return "instagram";
  return /[a-z_]/i.test(value) ? "instagram" : "phone";
}

export function parseContact(
  type: unknown,
  raw: string,
  defaultCountry?: string,
): ParsedContact {
  const contactType: ContactType =
    type === "phone" || type === "instagram" ? type : guessContactType(raw);
  const normalized =
    contactType === "phone"
      ? normalizePhone(raw, defaultCountry)
      : normalizeInstagram(raw);
  return normalized
    ? { ok: true, type: contactType, normalized }
    : { ok: false, type: contactType };
}
