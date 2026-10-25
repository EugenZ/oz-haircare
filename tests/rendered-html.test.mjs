import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { registerHooks } from "node:module";

// Shim `cloudflare:workers` so the booking API route can run under plain Node
// without a real D1 binding (the "no database" local path we exercise).
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") {
      return {
        url: "data:text/javascript,export const env = {}; export default {};",
        shortCircuit: true,
      };
    }
    // Pure lib/*.ts modules import siblings without an extension (bundler
    // style); resolve those to .ts so Node's type stripping can load them.
    if (
      /^\.\.?\//.test(specifier) &&
      !/\.[cm]?[jt]sx?$/.test(specifier) &&
      context.parentURL?.endsWith(".ts")
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

// Node >= 22.18 / 23.6 strips TypeScript types natively; older runtimes skip
// the unit tests that import lib/*.ts directly.
const canImportTs = Boolean(process.features?.typescript);
const tsOnly = canImportTs ? {} : { skip: "requires Node TypeScript type stripping" };
const importLib = (name) => import(new URL(`../lib/${name}.ts`, import.meta.url).href);

const projectRoot = new URL("../", import.meta.url);
const designSystemRoot = new URL("../opendesign/root-ritual/", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function postBooking(body) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-post`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the bilingual ROOT / RITUAL site", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ru">/i);
  assert.match(html, /<title>OZ SPA/);
  assert.match(html, /class="language-switch"/);
  assert.match(html, />RU<\/button>/);
  assert.match(html, />EN<\/button>/);
  assert.match(html, /id="services"/);
  assert.match(html, /id="gallery"/);
  assert.match(html, /id="journal"/);
  assert.match(html, /id="booking"/);
  assert.match(html, /class="booking-form"/);
  assert.match(html, /id="service-01"/);
  assert.match(html, /class="service-subitems"/);
  assert.match(html, /service-subitem-head/);
});

test("keeps core client interactions wired", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("app/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/globals.css", projectRoot), "utf8"),
  ]);

  assert.match(page, /type Language = "ru" \| "en"/);
  assert.match(page, /setLanguage\("ru"\)/);
  assert.match(page, /setLanguage\("en"\)/);
  assert.match(page, /setMenuOpen/);
  assert.match(page, /setOpenService/);
  assert.match(page, /aboutPhotos/);
  assert.match(page, /setAboutPhotoIndex/);
  assert.match(page, /Мои дипломы и сертификаты/);
  assert.match(page, /setCertificateIndex/);
  assert.match(page, /aria-expanded/);
  assert.match(page, /event\.preventDefault\(\)/);
  assert.match(page, /name="date"/);
  assert.match(page, /name="time"/);
  assert.match(page, /className="floating-note floating-note-bottom"/);
  assert.match(page, /href=\{"#service-"/);
  assert.match(page, /setOpenService\(services\[0\]\.number\)/);
  assert.match(page, /function ServiceSubItem/);
  assert.match(page, /service-subitems/);
  assert.match(page, /extraServices\.map/);
  assert.match(page, /Выбрать время и дату/);
  assert.match(css, /@media \(max-width: 650px\)/);
  assert.match(css, /@import "\.\.\/opendesign\/root-ritual\/tokens\.css"/);
});

test("ships a complete OpenDesign design-system package", async () => {
  const [manifestText, design, tokens] = await Promise.all([
    readFile(new URL("manifest.json", designSystemRoot), "utf8"),
    readFile(new URL("DESIGN.md", designSystemRoot), "utf8"),
    readFile(new URL("tokens.css", designSystemRoot), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);

  assert.equal(manifest.schemaVersion, "od-design-system-project/v1");
  assert.equal(manifest.id, "root-ritual");
  assert.equal(manifest.files.design, "DESIGN.md");
  assert.equal(manifest.files.tokens, "tokens.css");
  assert.ok((design.match(/^## /gm) ?? []).length >= 7);

  const requiredTokens = [
    "--bg", "--surface", "--surface-warm", "--fg", "--fg-2", "--muted",
    "--meta", "--border", "--border-soft", "--accent", "--accent-on",
    "--accent-hover", "--accent-active", "--success", "--warn", "--danger",
    "--font-display", "--font-body", "--font-mono", "--text-xs", "--text-sm",
    "--text-base", "--text-lg", "--text-xl", "--text-2xl", "--text-3xl",
    "--text-4xl", "--leading-body", "--leading-tight", "--tracking-display",
    "--space-1", "--space-2", "--space-3", "--space-4", "--space-5",
    "--space-6", "--space-8", "--space-12", "--section-y-desktop",
    "--section-y-tablet", "--section-y-phone", "--radius-sm", "--radius-md",
    "--radius-lg", "--radius-pill", "--elev-flat", "--elev-ring",
    "--elev-raised", "--focus-ring", "--motion-fast", "--motion-base",
    "--ease-standard", "--container-max", "--container-gutter-desktop",
    "--container-gutter-tablet", "--container-gutter-phone",
  ];
  for (const token of requiredTokens) {
    assert.match(tokens, new RegExp(`${token.replaceAll("-", "\\-")}\\s*:`));
  }
});

// A slot safely in the future (Mondays at 10:00, Los Angeles).
const FUTURE_DATE = "2030-11-04";

test("accepts a booking request as pending without a calendar event", async () => {
  const response = await postBooking({
    name: "Test Person",
    contactType: "phone",
    contact: "+1 555 000 0000",
    email: "test@example.com",
    date: FUTURE_DATE,
    time: "10:00",
    service: "Full hair restoration ritual",
    message: "hello",
    language: "en",
  });

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.status, "pending");
  assert.equal(body.contactType, "phone");
  assert.equal(body.persisted, false); // no DATABASE_URL in tests
  assert.equal(body.calendarUrl, undefined);
  assert.equal(body.calendarEvent, undefined);
});

test("validates the phone / Instagram contact and the slot", async () => {
  const base = {
    name: "Test Person",
    date: FUTURE_DATE,
    time: "10:00",
    language: "en",
  };

  const badHandle = await postBooking({ ...base, contactType: "instagram", contact: "not a handle!" });
  assert.equal(badHandle.status, 400);
  const badHandleBody = await badHandle.json();
  assert.equal(badHandleBody.field, "contact");
  assert.match(badHandleBody.error, /Instagram/);

  const badPhone = await postBooking({ ...base, contactType: "phone", contact: "12" });
  assert.equal(badPhone.status, 400);
  assert.match((await badPhone.json()).error, /phone/);

  const badEmail = await postBooking({ ...base, contact: "@olga.client", email: "nope" });
  assert.equal(badEmail.status, 400);

  const past = await postBooking({ ...base, contact: "+13105550123", date: "2020-01-06" });
  assert.equal(past.status, 400);

  const instagram = await postBooking({ ...base, contactType: "instagram", contact: "https://instagram.com/Olga.Client" });
  assert.equal(instagram.status, 201);
  assert.equal((await instagram.json()).contactType, "instagram");
});

test("rejects an incomplete booking request", async () => {
  const response = await postBooking({ name: "Only a name" });

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /required/);
});

test("wires the booking form to the pending flow and the contact toggle", async () => {
  const [page, route, bookingsLib, email] = await Promise.all([
    readFile(new URL("app/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/api/bookings/route.ts", projectRoot), "utf8"),
    readFile(new URL("lib/bookings.ts", projectRoot), "utf8"),
    readFile(new URL("lib/email.ts", projectRoot), "utf8"),
  ]);

  assert.match(page, /fetch\("\/api\/bookings"/);
  assert.match(page, /name="email"/);
  assert.match(page, /name="contactType"/);
  assert.match(page, /setContactType\(type\)/);
  assert.match(page, /role="radiogroup"/);
  assert.match(page, /aria-checked=\{contactType === type\}/);
  assert.match(page, /onKeyDown=\{handleContactTypeKey\}/);
  assert.match(page, /contactType === "phone" \? "tel" : "text"/);
  assert.match(page, /t\.booking\.emailHint/);
  assert.match(page, /t\.booking\.successInstagram/);
  assert.match(page, /t\.booking\.successPhone/);
  assert.doesNotMatch(page, /inviteUrl/);
  assert.match(route, /export async function POST/);
  assert.match(route, /createBooking/);
  assert.match(route, /parseContact/);
  assert.doesNotMatch(route, /createCalendarEvent/);
  assert.match(bookingsLib, /getDb\(\)/);
  assert.match(bookingsLib, /status: "pending"/);
  assert.match(email, /buildCalendarInviteUrl/);
  assert.match(email, /buildIcs/);
  assert.match(email, /attachments/);
});

test("a submitted booking emails Olga and the client but creates no calendar event", async () => {
  process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client";
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-secret";
  process.env.GOOGLE_OAUTH_REFRESH_TOKEN = "test-refresh";
  process.env.GOOGLE_CALENDAR_ID = "primary";
  process.env.BOOKING_NOTIFY_EMAIL = "olga@example.com";
  process.env.EMAIL_API_URL = "https://mail.example.test/emails";
  process.env.EMAIL_API_KEY = "k";
  process.env.EMAIL_FROM = "OZ SPA <booking@example.com>";

  let tokenHits = 0;
  let eventHits = 0;
  let availabilityHits = 0;
  let emailHits = 0;
  const emails = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes("oauth2.googleapis.com/token")) {
      tokenHits += 1;
      return new Response(
        JSON.stringify({ access_token: "test-access", token_type: "Bearer" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (u.includes("events?")) {
      availabilityHits += 1;
      return new Response(
        JSON.stringify({ items: [] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (u.includes("calendar/v3/calendars/")) {
      eventHits += 1;
      return new Response(
        JSON.stringify({
          id: "evt-123",
          htmlLink: "https://calendar.google.com/event?eid=evt-123&source=oz",
          icalLink: "https://www.google.com/calendar/ical/primary/events/basic",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (u.includes("mail.example.test")) {
      emailHits += 1;
      emails.push(JSON.parse(String(init?.body ?? "{}")));
      return new Response(JSON.stringify({ id: "mail-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("not found", { status: 404 });
  };
  try {
    const response = await postBooking({
      name: "Test Person",
      contactType: "instagram",
      contact: "@test.person",
      email: "client@example.com",
      date: FUTURE_DATE,
      time: "10:00",
      service: "Consultation",
      message: "hello",
      language: "en",
    });

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.status, "pending");
    assert.equal(tokenHits, 1); // only the availability guard talks to Google
    assert.equal(availabilityHits, 1);
    assert.equal(eventHits, 0); // the event is created on Olga's confirmation
    assert.equal(emailHits, 2); // Olga + client "request received"
    assert.equal(body.notify.practitioner.ok, true);
    assert.equal(body.notify.client.ok, true);

    const olga = emails.find((mail) => mail.to === "olga@example.com");
    const client = emails.find((mail) => mail.to === "client@example.com");
    assert.match(olga.subject, /Новая заявка/);
    assert.match(olga.html, /Instagram: @test\.person/);
    // Without a database there is no manage link: Olga is told to confirm by hand.
    assert.match(olga.html, /вручную/);
    assert.match(client.subject, /Request received/);
    assert.equal(client.attachments, undefined);
  } finally {
    globalThis.fetch = realFetch;
    for (const key of [
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "GOOGLE_OAUTH_REFRESH_TOKEN",
      "GOOGLE_CALENDAR_ID",
      "BOOKING_NOTIFY_EMAIL",
      "EMAIL_API_URL",
      "EMAIL_API_KEY",
      "EMAIL_FROM",
    ]) {
      delete process.env[key];
    }
  }
});

// A small helper to drive any API route through the built worker (with the
// per-call cache-bust trick the booking tests already use).
async function callApi(path, init) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-api`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, init ?? {}),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

function mockCalendar({ busyEvents = [] } = {}) {
  let tokenHits = 0;
  let eventHits = 0;
  let availabilityHits = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("oauth2.googleapis.com/token")) {
      tokenHits += 1;
      return new Response(
        JSON.stringify({ access_token: "test-access", token_type: "Bearer" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    // The availability guard lists a day's events (GET .../events?timeMin=…).
    if (u.includes("events?")) {
      availabilityHits += 1;
      return new Response(
        JSON.stringify({ items: busyEvents }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    // The server-created event is a POST to .../events with no query string.
    if (u.includes("calendar/v3/calendars/")) {
      eventHits += 1;
      return new Response(
        JSON.stringify({
          id: "evt-123",
          htmlLink: "https://calendar.google.com/event?eid=evt-123&source=oz",
          icalLink: "https://www.google.com/calendar/ical/primary/events/basic",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response("not found", { status: 404 });
  };
  return {
    restore() {
      globalThis.fetch = realFetch;
    },
    stats: () => ({ tokenHits, eventHits, availabilityHits }),
  };
}

// 2030-11-04 08:00–12:00 local (America/Los_Angeles, PST) → slots 10:00 & 11:00 busy.
const busyEvent = {
  start: { dateTime: "2030-11-04T16:00:00Z" },
  end: { dateTime: "2030-11-04T20:00:00Z" },
  status: "confirmed",
  summary: "existing appointment",
};

test("rejects a booking when the slot is already busy on Olya's calendar", async () => {
  process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client";
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-secret";
  process.env.GOOGLE_OAUTH_REFRESH_TOKEN = "test-refresh";
  process.env.GOOGLE_CALENDAR_ID = "primary";

  const mock = mockCalendar({ busyEvents: [busyEvent] });
  try {
    const response = await postBooking({
      name: "Test Person",
      contact: "+1 555 000 0000",
      email: "client@example.com",
      date: FUTURE_DATE,
      time: "10:00",
      service: "Consultation",
      message: "hello",
      language: "en",
    });

    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.match(String(body.error), /already booked|занято/i);
    // The guard must stop the server event from being created.
    assert.equal(mock.stats().eventHits, 0);
    assert.ok(mock.stats().availabilityHits >= 1);
  } finally {
    mock.restore();
    for (const key of [
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "GOOGLE_OAUTH_REFRESH_TOKEN",
      "GOOGLE_CALENDAR_ID",
    ]) {
      delete process.env[key];
    }
  }
});

test("exposes calendar availability for a chosen date", async () => {
  process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client";
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-secret";
  process.env.GOOGLE_OAUTH_REFRESH_TOKEN = "test-refresh";
  process.env.GOOGLE_CALENDAR_ID = "primary";

  const mock = mockCalendar({ busyEvents: [busyEvent] });
  try {
    const response = await callApi(
      `/api/bookings/availability?date=${FUTURE_DATE}&slots=10:00,11:00,12:00`,
      { method: "GET" },
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.ok(body.busy.includes("10:00"));
    assert.ok(body.busy.includes("11:00"));
    assert.ok(!body.busy.includes("12:00"));
    assert.ok(mock.stats().availabilityHits >= 1);
  } finally {
    mock.restore();
    for (const key of [
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "GOOGLE_OAUTH_REFRESH_TOKEN",
      "GOOGLE_CALENDAR_ID",
    ]) {
      delete process.env[key];
    }
  }
});

test("booking form greys out busy slots from the availability endpoint", async () => {
  const [page, route, availability, google] = await Promise.all([
    readFile(new URL("app/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/api/bookings/route.ts", projectRoot), "utf8"),
    readFile(
      new URL("app/api/bookings/availability/route.ts", projectRoot),
      "utf8",
    ),
    readFile(new URL("lib/google.ts", projectRoot), "utf8"),
  ]);

  assert.match(page, /fetch\(`\/api\/bookings\/availability\?/);
  assert.match(page, /busySlots/);
  assert.match(page, /t\.booking\.busy/);
  assert.match(page, /disabled=\{busy\}/);
  assert.match(route, /slotAvailability/);
  assert.match(route, /status: 409/);
  assert.match(availability, /fetchBusySlotsForDay/);
  assert.match(availability, /confirmedSlotsForDay/);
  assert.match(google, /fetchBusySlotsForDay/);
  assert.match(google, /events\?/);
});

function withEnv(values) {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

test("protects the bookings inbox with ADMIN_API_TOKEN", async () => {
  const unset = await callApi("/api/bookings", { method: "GET" });
  assert.equal(unset.status, 401); // deny by default when the token is not configured

  const restore = withEnv({ ADMIN_API_TOKEN: "admin-secret" });
  try {
    const wrong = await callApi("/api/bookings", {
      method: "GET",
      headers: { authorization: "Bearer nope" },
    });
    assert.equal(wrong.status, 401);

    const right = await callApi("/api/bookings", {
      method: "GET",
      headers: { authorization: "Bearer admin-secret" },
    });
    assert.equal(right.status, 200);
    assert.ok(Array.isArray((await right.json()).bookings));
  } finally {
    restore();
  }
});

test("outbox claim / ack require OUTBOX_API_TOKEN and validate the channel", async () => {
  const json = { "content-type": "application/json" };
  const unset = await callApi("/api/outbox/claim", { method: "POST", headers: json, body: "{}" });
  assert.equal(unset.status, 401);

  const restore = withEnv({ OUTBOX_API_TOKEN: "outbox-secret" });
  try {
    const auth = { ...json, authorization: "Bearer outbox-secret" };
    const missing = await callApi("/api/outbox/claim", { method: "POST", headers: json, body: "{}" });
    assert.equal(missing.status, 401);

    const badChannel = await callApi("/api/outbox/claim", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ channel: "fax" }),
    });
    assert.equal(badChannel.status, 400);

    // Authorized, but no database in tests -> 503 rather than a crash.
    const claim = await callApi("/api/outbox/claim", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ channel: "sms", limit: 5 }),
    });
    assert.equal(claim.status, 503);

    const ackNoAuth = await callApi("/api/outbox/1/ack", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ claim: "x", result: "sent" }),
    });
    assert.equal(ackNoAuth.status, 401);

    const ack = await callApi("/api/outbox/1/ack", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ claim: "x", result: "sent" }),
    });
    assert.equal(ack.status, 503);
  } finally {
    restore();
  }
});

test("booking pages only render on GET; actions are POSTs that redirect back", async () => {
  const manage = await callApi("/booking/manage?id=1&t=abc", {
    method: "GET",
    headers: { accept: "text/html" },
  });
  assert.equal(manage.status, 200);
  assert.match(await manage.text(), /База данных недоступна/);

  const view = await callApi("/booking/view?id=1&v=abc", {
    method: "GET",
    headers: { accept: "text/html" },
  });
  assert.equal(view.status, 200);
  assert.match(await view.text(), /temporarily unavailable/);

  const formPost = await callApi("/api/bookings/1/confirm", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "token=abc",
  });
  assert.equal(formPost.status, 303);
  const location = new URL(formPost.headers.get("location"));
  assert.equal(location.pathname, "/booking/manage");
  assert.equal(location.searchParams.get("id"), "1");
  assert.equal(location.searchParams.get("t"), "abc");
  assert.equal(location.searchParams.get("error"), "unavailable");

  const jsonPost = await callApi("/api/bookings/1/decline", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "abc" }),
  });
  assert.equal(jsonPost.status, 503);
  assert.equal((await jsonPost.json()).error, "unavailable");

  const badDecision = await callApi("/api/bookings/1/respond", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "abc", decision: "maybe" }),
  });
  assert.equal(badDecision.status, 400);

  const badSlot = await callApi("/api/bookings/1/propose", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "abc", date: "soon", time: "10:00" }),
  });
  assert.equal(badSlot.status, 400);

  const ics = await callApi("/api/bookings/1/ics", { method: "GET" });
  assert.equal(ics.status, 404); // no view token

  const [managePage, viewPage, sw] = await Promise.all([
    readFile(new URL("app/booking/manage/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/booking/view/page.tsx", projectRoot), "utf8"),
    readFile(new URL("public/sw.js", projectRoot), "utf8"),
  ]);
  for (const source of [managePage, viewPage]) {
    assert.doesNotMatch(source, /confirmBooking|declineBooking|proposeBooking|respondToProposal/);
  }
  assert.match(managePage, /action=\{`\/api\/bookings\/\$\{row\.id\}\/confirm`\}/);
  assert.match(managePage, /action=\{`\/api\/bookings\/\$\{row\.id\}\/decline`\}/);
  assert.match(managePage, /action=\{`\/api\/bookings\/\$\{row\.id\}\/propose`\}/);
  assert.match(managePage, /disabled=\{!canConfirm\}/);
  assert.match(viewPage, /name="decision" value="accept"/);
  assert.match(viewPage, /name="decision" value="decline"/);
  assert.match(sw, /startsWith\("\/booking\/"\)/);
});

test("schema, migration and outbox enforce the booking invariants", async () => {
  const [schema, outboxLib, bookingsLib, journal] = await Promise.all([
    readFile(new URL("db/schema.ts", projectRoot), "utf8"),
    readFile(new URL("lib/outbox.ts", projectRoot), "utf8"),
    readFile(new URL("lib/bookings.ts", projectRoot), "utf8"),
    readFile(new URL("drizzle/meta/_journal.json", projectRoot), "utf8"),
  ]);
  const migrations = JSON.parse(journal).entries.map((entry) => entry.tag);
  const latest = await readFile(
    new URL(`drizzle/${migrations.at(-1)}.sql`, projectRoot),
    "utf8",
  );

  assert.match(schema, /bookings_confirmed_slot_idx/);
  assert.match(schema, /\$\{table\.status\} = 'confirmed'/);
  assert.match(schema, /pgTable\(\s*"outbox"/);
  assert.match(latest, /CREATE TABLE "outbox"/);
  assert.match(latest, /CREATE UNIQUE INDEX "bookings_confirmed_slot_idx"[^;]*WHERE[^;]*'confirmed'/);
  assert.match(latest, /UPDATE "bookings" SET "status" = 'pending' WHERE "status" = 'new'/);

  assert.match(outboxLib, /skipLocked: true/);
  assert.match(outboxLib, /MAX_ATTEMPTS = 2/);
  assert.match(outboxLib, /LEASE_HOURS = 2/);
  // Pending requests never block a slot: only confirmed bookings are checked.
  assert.match(bookingsLib, /eq\(bookings\.status, "confirmed"\)/);
  assert.match(bookingsLib, /hashToken\(manageToken\)/);
});

test("parses phone and Instagram contacts", tsOnly, async () => {
  const { parseContact, normalizePhone, normalizeInstagram } = await importLib("contact");

  assert.equal(normalizePhone("(310) 555-0123"), "+13105550123");
  assert.equal(normalizePhone("+7 916 123-45-67"), "+79161234567");
  assert.equal(normalizePhone("8 916 123 45 67", "RU"), "+79161234567");
  assert.equal(normalizePhone("12"), null);
  assert.equal(normalizePhone("call me"), null);
  assert.equal(normalizeInstagram("@Olga.Zhgirova"), "olga.zhgirova");
  assert.equal(normalizeInstagram("https://www.instagram.com/olga_zhgirova/?hl=en"), "olga_zhgirova");
  assert.equal(normalizeInstagram("no spaces allowed"), null);

  assert.deepEqual(parseContact("phone", "+1 310 555 0123"), {
    ok: true,
    type: "phone",
    normalized: "+13105550123",
  });
  assert.equal(parseContact(undefined, "@client").type, "instagram");
  assert.equal(parseContact(undefined, "310 555 0123").type, "phone");
  assert.equal(parseContact("instagram", "bad handle!").ok, false);
});

test("builds a UTC .ics invite and a Resend attachment", tsOnly, async () => {
  const { buildIcs, buildInviteFromPayload, clientConfirmedEmail, toBase64 } =
    await importLib("email");

  const winter = buildInviteFromPayload({
    name: "Анна",
    contact: "+13105550123",
    date: "2026-11-02",
    time: "10:00",
    service: "Полный ритуал восстановления волос и очень длинное название услуги",
    language: "ru",
  });
  const ics = buildIcs(winter, "booking-7", { url: "https://oz.example/booking/view?id=7&v=x" });
  assert.match(ics, /METHOD:PUBLISH/);
  assert.match(ics, /DTSTART:20261102T180000Z/); // 10:00 PST
  assert.match(ics, /DTEND:20261102T190000Z/);
  assert.match(ics, /UID:booking-7@oz-spa/);
  for (const line of ics.split("\r\n")) {
    assert.ok(new TextEncoder().encode(line).length <= 75, `line too long: ${line}`);
  }
  assert.match(winter.calendarUrl, /dates=20261102T180000Z%2F20261102T190000Z/);

  const summer = buildInviteFromPayload({
    name: "Ann",
    contact: "@ann",
    date: "2026-07-01",
    time: "10:00",
    language: "en",
  });
  assert.match(buildIcs(summer), /DTSTART:20260701T170000Z/); // 10:00 PDT

  const email = clientConfirmedEmail(
    { name: "Ann", contact: "@ann", date: "2026-07-01", time: "10:00", language: "en" },
    { viewUrl: "https://v", googleUrl: summer.calendarUrl, icsUrl: "https://ics" },
    "BEGIN:VCALENDAR",
  );
  assert.match(email.subject, /confirmed/);
  assert.deepEqual(email.attachments, [
    { filename: "oz-spa-booking.ics", content: toBase64("BEGIN:VCALENDAR") },
  ]);
  assert.match(email.html, /Apple Calendar/);
  assert.match(email.html, /Google Calendar/);
});

test("hashes tokens and derives a valid Google event id", tsOnly, async () => {
  const { generateToken, hashToken, safeEqual, calendarEventIdFor } = await importLib("tokens");

  const token = generateToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(token, generateToken());
  const hash = await hashToken(token);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash, await hashToken(token));
  assert.ok(safeEqual(hash, await hashToken(token)));
  assert.ok(!safeEqual(hash, await hashToken("other")));

  const eventId = await calendarEventIdFor(42, hash);
  assert.match(eventId, /^[a-v0-9]{5,1024}$/);
  assert.equal(eventId, await calendarEventIdFor(42, hash));
});

test("renders RU/EN SMS and Instagram message templates", tsOnly, async () => {
  const { clientMessageText, formatSlot } = await importLib("messages");

  const slot = formatSlot("2026-11-02", "10:00", "ru");
  assert.match(slot, /10:00/);
  assert.match(slot, /ноябр/);
  const confirmed = clientMessageText("confirmed", {
    name: "Анна",
    language: "ru",
    slot,
    url: "https://oz.example/booking/view?id=1&v=t",
  });
  assert.match(confirmed, /подтвердила/);
  assert.match(confirmed, /https:\/\/oz\.example\/booking\/view\?id=1&v=t/);

  const proposed = clientMessageText("proposed", {
    name: "Ann",
    language: "en",
    slot: formatSlot("2026-11-03", "12:00", "en"),
    previousSlot: formatSlot("2026-11-02", "10:00", "en"),
    url: "https://v",
  });
  assert.match(proposed, /suggests/);
  assert.match(proposed, /accept or decline/);
  assert.match(clientMessageText("declined", { name: "Ann", language: "en", slot, url: "https://site/#booking" }), /another time/);
});
