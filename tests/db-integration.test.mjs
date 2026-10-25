// Opt-in integration tests against a real Neon Postgres (`npm run test:db`).
//
// Isolation: every run creates its own schema (test_<timestamp>_<rand>), applies
// the Drizzle migrations inside it and drops it with CASCADE afterwards — the
// production `public` tables are never touched. The app under test is pointed at
// that schema through DATABASE_SCHEMA (see db/index.ts): Neon's HTTP driver is
// stateless and its pooler rejects a search_path startup parameter, so both the
// app and this file use a WebSocket Pool on the *unpooled* endpoint with
// `options=-c search_path=<schema>`. Before anything is written the test asserts
// that current_schema() really is the test schema.
//
// Database URL: TEST_DATABASE_URL, or — only when TEST_DB_USE_DATABASE_URL=1,
// which `npm run test:db` sets — DATABASE_URL from the ignored .env.local.
// Google Calendar and Resend are stubbed via fetch; any other HTTP call fails.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { after, before, describe, test } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") {
      return {
        url: "data:text/javascript,export const env = {}; export default {};",
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const sourceUrl =
  process.env.TEST_DATABASE_URL ||
  (process.env.TEST_DB_USE_DATABASE_URL === "1" ? process.env.DATABASE_URL : "");
const skip = sourceUrl
  ? false
  : "set TEST_DATABASE_URL (or run `npm run test:db` with DATABASE_URL in .env.local)";

const projectRoot = new URL("../", import.meta.url);
const schemaName = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const ADMIN_TOKEN = "admin-test-token";
const OUTBOX_TOKEN = "outbox-test-token";
const SITE = "https://oz.test";
const OLGA = "olga@oz.test";

const TEST_ENV = {
  DATABASE_SCHEMA: schemaName,
  GOOGLE_OAUTH_CLIENT_ID: "test-client",
  GOOGLE_OAUTH_CLIENT_SECRET: "test-secret",
  GOOGLE_OAUTH_REFRESH_TOKEN: "test-refresh",
  GOOGLE_CALENDAR_ID: "primary",
  GOOGLE_INVITE_ATTENDEE: "false",
  EMAIL_API_URL: "https://mail.test/emails",
  EMAIL_API_KEY: "test-key",
  EMAIL_FROM: "OZ SPA <booking@oz.test>",
  BOOKING_NOTIFY_EMAIL: OLGA,
  SITE_URL: SITE,
  ADMIN_API_TOKEN: ADMIN_TOKEN,
  OUTBOX_API_TOKEN: OUTBOX_TOKEN,
  DEFAULT_PHONE_COUNTRY: "US",
};

function unpooled(url) {
  const parsed = new URL(url);
  parsed.hostname = parsed.hostname.replace("-pooler.", ".");
  return parsed.toString();
}

function withSearchPath(url, schema) {
  const options = encodeURIComponent(`-c search_path=${schema}`);
  return `${url}${url.includes("?") ? "&" : "?"}options=${options}`;
}

const json = (body) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const calls = { emails: [], events: [], lists: 0 };

async function stubFetch(input, init = {}) {
  const url = String(input instanceof Request ? input.url : input);
  const method = (init.method ?? "GET").toUpperCase();
  if (url.startsWith("https://oauth2.googleapis.com/token")) {
    return json({ access_token: "test-access", token_type: "Bearer" });
  }
  if (url.includes("/calendar/v3/calendars/") && method === "GET") {
    calls.lists += 1;
    return json({ items: [] });
  }
  if (url.includes("/calendar/v3/calendars/") && method === "POST") {
    const body = JSON.parse(String(init.body));
    calls.events.push({ url, body });
    return json({ id: body.id, htmlLink: `https://calendar.google.com/event?eid=${body.id}` });
  }
  if (url.startsWith("https://mail.test/")) {
    calls.emails.push(JSON.parse(String(init.body)));
    return json({ id: `mail-${calls.emails.length}` });
  }
  throw new Error(`unexpected fetch in db tests: ${url}`);
}

describe("booking lifecycle on a real Postgres schema", { skip }, () => {
  let admin;
  let scoped;
  let worker;
  let schemaCreated = false;
  const savedEnv = {};
  const realFetch = globalThis.fetch;

  async function dropSchema() {
    if (!schemaCreated) return;
    await admin.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    schemaCreated = false;
  }

  before(async () => {
    const { Pool, neonConfig } = await import("@neondatabase/serverless");
    neonConfig.webSocketConstructor ??= globalThis.WebSocket;
    const url = unpooled(sourceUrl);
    admin = new Pool({ connectionString: url, max: 1 });
    try {
      await admin.query(`CREATE SCHEMA "${schemaName}"`);
      schemaCreated = true;
      scoped = new Pool({ connectionString: withSearchPath(url, schemaName), max: 2 });
      const { rows } = await scoped.query("select current_schema() as schema");
      assert.equal(rows[0].schema, schemaName, "search_path must point at the test schema");

      const journal = JSON.parse(
        await readFile(new URL("drizzle/meta/_journal.json", projectRoot), "utf8"),
      );
      for (const { tag } of journal.entries) {
        const migration = await readFile(new URL(`drizzle/${tag}.sql`, projectRoot), "utf8");
        const scopedSql = migration.replaceAll('"public".', `"${schemaName}".`);
        assert.doesNotMatch(scopedSql, /"public"/, `${tag} still references public`);
        for (const statement of scopedSql.split("--> statement-breakpoint")) {
          if (statement.trim()) await scoped.query(statement);
        }
      }
      const { rows: tables } = await admin.query(
        "select table_name from information_schema.tables where table_schema = $1 order by 1",
        [schemaName],
      );
      assert.deepEqual(
        tables.map((row) => row.table_name),
        ["bookings", "outbox"],
      );

      for (const key of ["DATABASE_URL", "PGUSER", "PGHOST", "PGPASSWORD", ...Object.keys(TEST_ENV)]) {
        savedEnv[key] = process.env[key];
        delete process.env[key];
      }
      Object.assign(process.env, TEST_ENV, { DATABASE_URL: url });
      globalThis.fetch = stubFetch;

      const workerUrl = new URL("../dist/server/index.js", import.meta.url);
      workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-db`);
      worker = (await import(workerUrl.href)).default;
    } catch (error) {
      await dropSchema().catch(() => {});
      throw error;
    }
  });

  after(async () => {
    globalThis.fetch = realFetch;
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    try {
      await dropSchema();
      const { rows } = await admin.query(
        "select count(*)::int as n from information_schema.schemata where schema_name = $1",
        [schemaName],
      );
      assert.equal(rows[0].n, 0, "test schema must be dropped");
    } finally {
      await scoped?.end().catch(() => {});
      await admin?.end().catch(() => {});
    }
  });

  function call(path, init = {}) {
    return worker.fetch(
      new Request(new URL(path, SITE), init),
      { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
      { waitUntil() {}, passThroughOnException() {} },
    );
  }

  const postJson = (path, body, headers = {}) =>
    call(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });

  const postForm = (path, fields) =>
    call(path, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    });

  const outboxAuth = { authorization: `Bearer ${OUTBOX_TOKEN}` };

  async function bookingRow(id) {
    const { rows } = await scoped.query("select * from bookings where id = $1", [id]);
    return rows[0];
  }

  async function outboxRows(bookingId) {
    const { rows } = await scoped.query(
      "select * from outbox where booking_id = $1 order by id",
      [bookingId],
    );
    return rows;
  }

  function emailsSince(index, to) {
    return calls.emails.slice(index).filter((mail) => mail.to === to);
  }

  function linkParams(text, path, param) {
    const match = new RegExp(`${path}\\?id=(\\d+)&(?:amp;)?${param}=([A-Za-z0-9_-]+)`).exec(text);
    assert.ok(match, `no ${path} link in: ${text}`);
    return { id: Number(match[1]), token: match[2] };
  }

  // Submit a booking and pull Olga's manage token out of her email.
  async function submit(overrides) {
    const mark = calls.emails.length;
    const response = await postJson("/api/bookings", {
      name: "Test Client",
      contactType: "phone",
      contact: "(310) 555-0101",
      email: "",
      date: "2030-11-04",
      time: "10:00",
      service: "Consultation",
      message: "",
      language: "ru",
      ...overrides,
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.persisted, true);
    const [olga] = emailsSince(mark, OLGA);
    const { id, token } = linkParams(olga.html, "/booking/manage", "t");
    assert.equal(id, body.id);
    return { id, token, body };
  }

  test("submit stores a pending booking and emails Olga a manage link", async () => {
    const mark = calls.emails.length;
    const { id, token } = await submit({ email: "client1@oz.test", date: "2030-11-04", time: "10:00" });

    const row = await bookingRow(id);
    assert.equal(row.status, "pending");
    assert.equal(row.contact_type, "phone");
    assert.equal(row.contact_normalized, "+13105550101");
    assert.match(row.manage_token_hash, /^[0-9a-f]{64}$/);
    assert.notEqual(row.manage_token_hash, token);
    assert.equal(calls.events.length, 0);
    const [client] = emailsSince(mark, "client1@oz.test");
    assert.match(client.subject, /Заявка получена/);
    assert.equal(client.attachments, undefined);

    const page = await call(`/booking/manage?id=${id}&t=${token}`);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /Test Client/);
    assert.match(html, /Подтвердить/);
    assert.equal((await bookingRow(id)).status, "pending"); // GET never mutates

    const wrongToken = await call(`/booking/manage?id=${id}&t=wrong`);
    assert.match(await wrongToken.text(), /не найдена/);
  });

  test("confirm creates the calendar event, emails the .ics and queues the SMS", async () => {
    const { id, token } = await submit({ email: "client2@oz.test", time: "11:00" });
    const mark = calls.emails.length;
    const eventsBefore = calls.events.length;

    const response = await postForm(`/api/bookings/${id}/confirm`, { token });
    assert.equal(response.status, 303);
    const location = new URL(response.headers.get("location"));
    assert.equal(location.searchParams.get("done"), "confirmed");

    const row = await bookingRow(id);
    assert.equal(row.status, "confirmed");
    assert.ok(row.confirmed_at);
    assert.match(row.calendar_event_id, /^bk\d+[0-9a-f]{20}$/);
    assert.equal(calls.events.length, eventsBefore + 1);
    const event = calls.events.at(-1);
    assert.equal(event.body.id, row.calendar_event_id);
    assert.equal(event.body.start.dateTime, "2030-11-04T11:00:00");
    assert.deepEqual(event.body.attendees, []);
    assert.doesNotMatch(event.url, /sendUpdates/);

    const [client] = emailsSince(mark, "client2@oz.test");
    assert.match(client.subject, /Запись подтверждена/);
    assert.equal(client.attachments[0].filename, "oz-spa-booking.ics");
    const ics = Buffer.from(client.attachments[0].content, "base64").toString("utf8");
    assert.match(ics, /DTSTART:20301104T190000Z/); // 11:00 PST

    const [sms] = await outboxRows(id);
    assert.equal(sms.channel, "sms");
    assert.equal(sms.kind, "confirmed");
    assert.equal(sms.status, "pending");
    assert.equal(sms.recipient, "+13105550101");
    const view = linkParams(sms.body, "/booking/view", "v");
    assert.equal(view.id, id);

    const icsResponse = await call(`/api/bookings/${id}/ics?v=${view.token}`);
    assert.equal(icsResponse.status, 200);
    assert.match(icsResponse.headers.get("content-type"), /text\/calendar/);
    assert.match(await icsResponse.text(), /UID:booking-\d+@oz-spa/);

    const again = await postJson(`/api/bookings/${id}/confirm`, { token });
    assert.equal(again.status, 409);
    assert.equal((await again.json()).error, "invalid_state");
    assert.equal(calls.events.length, eventsBefore + 1);
  });

  test("a confirmed slot blocks other pending requests for it", async () => {
    const slot = { date: "2030-11-05", time: "10:00" };
    const first = await submit({ ...slot, name: "First" });
    const second = await submit({ ...slot, name: "Second" }); // pending never blocks

    assert.equal((await postJson(`/api/bookings/${first.id}/confirm`, { token: first.token })).status, 200);

    const page = await (await call(`/booking/manage?id=${second.id}&t=${second.token}`)).text();
    assert.match(page, /Это время уже занято/);
    assert.match(page, /<button[^>]*disabled=""[^>]*>Подтвердить/);

    const blocked = await postJson(`/api/bookings/${second.id}/confirm`, { token: second.token });
    assert.equal(blocked.status, 409);
    assert.equal((await blocked.json()).error, "slot_taken");
    assert.equal((await bookingRow(second.id)).status, "pending");

    // The partial unique index is the last line of defence against a race.
    await assert.rejects(
      scoped.query("update bookings set status = 'confirmed' where id = $1", [second.id]),
      (error) => error.code === "23505",
    );

    const availability = await call(`/api/bookings/availability?date=${slot.date}&slots=10:00,11:00`);
    assert.deepEqual((await availability.json()).busy, ["10:00"]);
    const newRequest = await postJson("/api/bookings", {
      name: "Late",
      contactType: "phone",
      contact: "+13105550199",
      ...slot,
    });
    assert.equal(newRequest.status, 409);
  });

  test("decline closes the request and notifies the client", async () => {
    const { id, token } = await submit({ email: "client3@oz.test", time: "12:00" });
    const mark = calls.emails.length;

    const response = await postJson(`/api/bookings/${id}/decline`, { token });
    assert.equal(response.status, 200);
    const row = await bookingRow(id);
    assert.equal(row.status, "declined");
    assert.ok(row.declined_at);
    const [client] = emailsSince(mark, "client3@oz.test");
    assert.match(client.html, /не сможет принять/);
    const [sms] = await outboxRows(id);
    assert.equal(sms.kind, "declined");
    assert.match(sms.body, /https:\/\/oz\.test\/#booking/);
  });

  test("propose -> client accepts -> confirmed at the new time", async () => {
    const { id, token } = await submit({
      contactType: "instagram",
      contact: "@Client.Dee",
      email: "dee@oz.test",
      time: "13:00",
      language: "en",
    });
    let mark = calls.emails.length;

    const proposed = await postForm(`/api/bookings/${id}/propose`, {
      token,
      date: "2030-11-06",
      time: "15:00",
    });
    assert.equal(proposed.status, 303);
    assert.equal(new URL(proposed.headers.get("location")).searchParams.get("done"), "proposed");
    let row = await bookingRow(id);
    assert.equal(row.status, "proposed");
    assert.equal(row.proposed_date, "2030-11-06");
    assert.equal(row.proposed_time, "15:00");
    assert.equal(row.date, "2030-11-04"); // original request kept until accepted

    const [proposalMail] = emailsSince(mark, "dee@oz.test");
    assert.match(proposalMail.subject, /New time suggested/);
    const view = linkParams(proposalMail.html, "/booking/view", "v");
    const [igProposal] = await outboxRows(id);
    assert.equal(igProposal.channel, "instagram");
    assert.equal(igProposal.kind, "proposed");
    assert.equal(igProposal.recipient, "client.dee");
    assert.match(igProposal.body, /suggests/);

    const viewPage = await (await call(`/booking/view?id=${id}&v=${view.token}`)).text();
    assert.match(viewPage, /Accept this time/);

    mark = calls.emails.length;
    const eventsBefore = calls.events.length;
    const accepted = await postForm(`/api/bookings/${id}/respond`, {
      token: view.token,
      decision: "accept",
    });
    assert.equal(accepted.status, 303);
    assert.equal(new URL(accepted.headers.get("location")).searchParams.get("done"), "accepted");

    row = await bookingRow(id);
    assert.equal(row.status, "confirmed");
    assert.equal(row.date, "2030-11-06");
    assert.equal(row.time, "15:00");
    assert.equal(calls.events.length, eventsBefore + 1);
    assert.equal(calls.events.at(-1).body.start.dateTime, "2030-11-06T15:00:00");
    assert.match(emailsSince(mark, "dee@oz.test")[0].subject, /Visit confirmed/);
    assert.match(emailsSince(mark, OLGA)[0].subject, /Клиент принял время/);

    const rows = await outboxRows(id);
    assert.deepEqual(
      rows.map((r) => [r.kind, r.status]),
      [
        ["proposed", "cancelled"],
        ["confirmed", "pending"],
      ],
    );
  });

  test("the client can decline a proposal; Olga is notified", async () => {
    const { id, token } = await submit({ email: "eve@oz.test", time: "14:00" });
    await postJson(`/api/bookings/${id}/propose`, { token, date: "2030-11-07", time: "16:00" });
    const view = linkParams((await outboxRows(id))[0].body, "/booking/view", "v");
    const mark = calls.emails.length;

    const declined = await postJson(`/api/bookings/${id}/respond`, {
      token: view.token,
      decision: "decline",
    });
    assert.equal(declined.status, 200);
    assert.equal((await bookingRow(id)).status, "cancelled");
    assert.equal((await outboxRows(id))[0].status, "cancelled");
    assert.match(emailsSince(mark, OLGA)[0].subject, /отказался/);

    const again = await postJson(`/api/bookings/${id}/respond`, {
      token: view.token,
      decision: "accept",
    });
    assert.equal(again.status, 409);
  });

  test("outbox claims are leased with SKIP LOCKED, acks are idempotent, 2 attempts max", async () => {
    // Two more confirmed bookings so several SMS rows are pending.
    for (const time of ["16:00", "17:00"]) {
      const { id, token } = await submit({ date: "2030-11-08", time, contact: `+1310555${time.slice(0, 2)}00` });
      assert.equal((await postJson(`/api/bookings/${id}/confirm`, { token })).status, 200);
    }
    const { rows: pending } = await scoped.query(
      "select id from outbox where channel = 'sms' and status = 'pending' order by id",
    );
    assert.ok(pending.length >= 4);

    const claimBody = { channel: "sms", limit: Math.ceil(pending.length / 2) };
    const [a, b] = await Promise.all([
      postJson("/api/outbox/claim", claimBody, outboxAuth),
      postJson("/api/outbox/claim", claimBody, outboxAuth),
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    const itemsA = (await a.json()).items;
    const itemsB = (await b.json()).items;
    const idsA = itemsA.map((item) => item.id);
    const idsB = itemsB.map((item) => item.id);
    assert.equal(idsA.filter((id) => idsB.includes(id)).length, 0, "no row claimed twice");
    assert.deepEqual([...idsA, ...idsB].sort((x, y) => x - y), pending.map((row) => row.id));

    const [first, second] = [...itemsA, ...itemsB];
    assert.match(first.phone, /^\+1\d{10}$/);
    assert.equal(first.ackUrl, `${SITE}/api/outbox/${first.id}/ack`);
    assert.equal(first.attempts, 1);

    const ackPath = (item) => new URL(item.ackUrl).pathname;
    const sent = await postJson(ackPath(first), { claim: first.claim, result: "sent" }, outboxAuth);
    assert.deepEqual(await sent.json(), { ok: true, id: first.id, status: "sent" });
    const duplicate = await postJson(ackPath(first), { claim: first.claim, result: "sent" }, outboxAuth);
    assert.equal(duplicate.status, 200);
    assert.equal((await duplicate.json()).duplicate, true);
    const mismatch = await postJson(ackPath(second), { claim: "not-the-claim" }, outboxAuth);
    assert.equal(mismatch.status, 409);

    // Nothing left to claim while the leases are active.
    const empty = await postJson("/api/outbox/claim", { channel: "sms" }, outboxAuth);
    assert.equal((await empty.json()).count, 0);

    // Lease expires without an ack -> offered again (attempt 2) with a new claim.
    const expire = (id) =>
      scoped.query("update outbox set claimed_until = now() - interval '1 minute' where id = $1", [id]);
    await expire(second.id);
    const retry = await (await postJson("/api/outbox/claim", { channel: "sms" }, outboxAuth)).json();
    assert.deepEqual(retry.items.map((item) => item.id), [second.id]);
    assert.equal(retry.items[0].attempts, 2);
    assert.notEqual(retry.items[0].claim, second.claim);
    const stale = await postJson(ackPath(second), { claim: second.claim, result: "sent" }, outboxAuth);
    assert.equal(stale.status, 409);

    // Second lease also expires -> the row is failed, never offered a third time.
    await expire(second.id);
    const none = await (await postJson("/api/outbox/claim", { channel: "sms" }, outboxAuth)).json();
    assert.equal(none.count, 0);
    const { rows: failed } = await scoped.query("select status, attempts from outbox where id = $1", [second.id]);
    assert.deepEqual(failed[0], { status: "failed", attempts: 2 });

    // Instagram items carry the handle and the ig.me deep link.
    const ig = await (await postJson("/api/outbox/claim", { channel: "instagram" }, outboxAuth)).json();
    assert.equal(ig.count, 1);
    assert.equal(ig.items[0].handle, "client.dee");
    assert.equal(ig.items[0].url, "https://ig.me/m/client.dee");
  });

  test("admin inbox and outbox reject missing or wrong bearer tokens", async () => {
    assert.equal((await call("/api/bookings")).status, 401);
    assert.equal(
      (await call("/api/bookings", { headers: { authorization: "Bearer wrong" } })).status,
      401,
    );
    assert.equal((await postJson("/api/outbox/claim", { channel: "sms" })).status, 401);
    assert.equal(
      (await postJson("/api/outbox/claim", { channel: "sms" }, { authorization: "Bearer wrong" })).status,
      401,
    );
    assert.equal((await postJson("/api/outbox/1/ack", { claim: "x" })).status, 401);

    const inbox = await call("/api/bookings", { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } });
    assert.equal(inbox.status, 200);
    const { bookings } = await inbox.json();
    assert.ok(bookings.length >= 8);
    for (const booking of bookings) {
      assert.equal(booking.manageTokenHash, undefined);
      assert.equal(booking.viewTokenHash, undefined);
    }
  });
});
