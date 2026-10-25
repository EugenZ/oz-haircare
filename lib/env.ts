// Environment access for route handlers and pages: local process.env first,
// then the Worker bindings (vars/secrets injected at deploy time).
import { env as bindingEnv } from "cloudflare:workers";
import type { EmailBackendConfig } from "./email";
import type { GoogleCalendarConfig } from "./google";

export function envValue(name: string): string | undefined {
  const fromProcess = process.env[name];
  if (fromProcess) return fromProcess;
  const fromBinding = bindingEnv as unknown as Record<string, string | undefined>;
  return fromBinding?.[name];
}

export function envFlag(name: string): boolean {
  return /^(1|true|yes|on)$/i.test(envValue(name)?.trim() ?? "");
}

export function envNumber(name: string, fallback: number): number {
  const value = Number(envValue(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function googleConfig(): GoogleCalendarConfig {
  return {
    clientId: envValue("GOOGLE_OAUTH_CLIENT_ID"),
    clientSecret: envValue("GOOGLE_OAUTH_CLIENT_SECRET"),
    refreshToken: envValue("GOOGLE_OAUTH_REFRESH_TOKEN"),
    calendarId: envValue("GOOGLE_CALENDAR_ID") ?? "primary",
  };
}

export function emailConfig(): EmailBackendConfig {
  return {
    apiUrl: envValue("EMAIL_API_URL"),
    apiKey: envValue("EMAIL_API_KEY"),
    notifyEmail: envValue("BOOKING_NOTIFY_EMAIL") ?? envValue("OLGA_EMAIL"),
    fromEmail: envValue("EMAIL_FROM"),
  };
}

// Public origin used in email / SMS links: SITE_URL, else the request origin.
export function siteUrl(request?: Request): string {
  const configured = envValue("SITE_URL")?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  return request ? new URL(request.url).origin : "";
}
