// Small HTTP helpers shared by the booking / outbox route handlers.
import type { ActionError, ActionResult } from "./bookings";
import { envValue } from "./env";
import { safeEqual } from "./tokens";

// `Authorization: Bearer <token>` must match the env var. Deny by default when
// the variable is not configured.
export function hasBearer(request: Request, envName: string): boolean {
  const expected = envValue(envName)?.trim();
  if (!expected) return false;
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "");
  return match ? safeEqual(match[1].trim(), expected) : false;
}

export function unauthorized(): Response {
  return Response.json(
    { ok: false, error: "unauthorized" },
    { status: 401, headers: { "www-authenticate": "Bearer" } },
  );
}

export function parseId(raw: string | undefined): number | null {
  if (!raw || !/^\d{1,10}$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// Accepts JSON (API / Shortcuts) or an HTML form post (the booking pages).
export async function readBody(
  request: Request,
): Promise<{ form: boolean; data: Record<string, string> }> {
  const type = request.headers.get("content-type") ?? "";
  const data: Record<string, string> = {};
  if (/application\/x-www-form-urlencoded|multipart\/form-data/i.test(type)) {
    const form = await request.formData().catch(() => null);
    form?.forEach((value, key) => {
      if (typeof value === "string") data[key] = value.trim();
    });
    return { form: true, data };
  }
  const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  for (const [key, value] of Object.entries(json ?? {})) {
    if (value !== undefined && value !== null) data[key] = String(value).trim();
  }
  return { form: false, data };
}

const ERROR_STATUS: Record<ActionError, number> = {
  not_found: 404,
  invalid_state: 409,
  invalid_input: 400,
  slot_taken: 409,
  past: 400,
  expired: 410,
  calendar_failed: 502,
  unavailable: 503,
};

// Form posts redirect (303) back to the booking page with ?done= / ?error=;
// JSON callers get a JSON result.
export function actionResponse(
  request: Request,
  form: boolean,
  result: ActionResult,
  back: { page: string; query: Record<string, string>; done: string },
): Response {
  if (form) {
    const target = new URL(back.page, request.url);
    for (const [key, value] of Object.entries(back.query)) target.searchParams.set(key, value);
    target.searchParams.set(result.ok ? "done" : "error", result.ok ? back.done : result.error);
    return new Response(null, { status: 303, headers: { location: target.toString() } });
  }
  if (result.ok) {
    return Response.json({ ok: true, id: result.booking.id, status: result.status });
  }
  return Response.json(
    {
      ok: false,
      error: result.error,
      ...(result.error === "calendar_failed" && result.detail ? { detail: result.detail } : {}),
    },
    { status: ERROR_STATUS[result.error] },
  );
}
