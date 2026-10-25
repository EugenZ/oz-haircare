# Repository Guidelines

Contributor guide for **ROOT / RITUAL** (`root-ritual-bilingual-site`) — a bilingual
(RU/EN) single-page site for a trichology / hair-restoration practice, built on
Next.js (App Router), Vite (`vinext`), and a Cloudflare Worker with an optional
Drizzle (Postgres/Neon) database.

## Project Structure

- `app/` — App Router: `layout.tsx` (metadata/fonts), `page.tsx` (main bilingual page
  + interactions), `globals.css` (structural styling), `chatgpt-auth.ts` (auth helpers).
- `opendesign/root-ritual/` — portable design system; `tokens.css` is imported by the
  live build, `DESIGN.md` documents brand rules, `manifest.json` is the schema.
- `db/` — `schema.ts` (Drizzle `pg-core`; ships a `bookings` table for the booking form) + `index.ts` (`getDb()`, a Neon Postgres client via `@neondatabase/serverless`, configured from `DATABASE_URL`/`PG*` env, graceful when unset).
- `app/api/bookings/route.ts` — `POST` validates (phone OR Instagram via `contactType`, optional email), stores the request as `pending` and emails Olga a manage link + the client "request received"; no Calendar event yet. `GET` (admin inbox) needs `Bearer $ADMIN_API_TOKEN`. Lifecycle lives in `lib/bookings.ts`: Olga confirms / declines / proposes another time on `app/booking/manage` (form POSTs to `app/api/bookings/[id]/{confirm,decline,propose}`); the client accepts / declines a proposal on `app/booking/view` (`[id]/respond`). Confirmation creates the Google Calendar event (`lib/google.ts`, idempotent event id), emails the client an `.ics` (`lib/email.ts`, Resend attachments, UTC times; `[id]/ics` for Apple) and queues SMS / Instagram text in the `outbox` table, which Olga's iPhone Shortcut drains via `app/api/outbox/{claim,[id]/ack}` (`lib/outbox.ts`, `Bearer $OUTBOX_API_TOKEN`; see `docs/IPHONE_SHORTCUTS.md`). Only confirmed bookings (plus Google busy time) block a slot. Tokens are random, stored as SHA-256 hashes; GET pages never mutate.
- `examples/d1/` — opt-in D1 sample. `worker/index.ts` — Worker entry. `tests/` —
  `rendered-html.test.mjs`. `public/` — static assets. `.openai/hosting.json` —
  optional D1/R2 bindings.
- Root config: `vite.config.ts`, `next.config.ts`, `drizzle.config.ts`,
  `eslint.config.mjs`.

## Build, Test & Development

Requires Node ≥ 22.13.0.

- `npm ci` — install exact deps from `package-lock.json` (use `npm install` only to change deps).
- `npm run dev` — local dev server (`http://localhost:3000`).
- `npm run build` / `npm run start` — build and serve production output.
- `npm test` — build, then `node --test tests/rendered-html.test.mjs`; the full gate.
- `npm run lint` — ESLint (ignores `dist`/`.next`).
- `npm run db:generate` — generate migrations after editing `db/schema.ts`; commit the `drizzle/` output.
- `npm run db:migrate` — apply pending migrations (`drizzle-kit migrate`, needs `DATABASE_URL`). Runs on every deploy via the Workers Builds command `npm run db:migrate && npm run build`; see `docs/DEPLOY.md`. Never `drizzle-kit push` to production.

## Coding Style

- TypeScript `strict`, 2-space indent, double quotes, semicolons. Path alias `@/*` → repo root.
- Style with Tailwind CSS v4: visual foundations in `opendesign/.../tokens.css`,
  structural CSS in `app/globals.css`.
- Keep RU/EN copy in the `copy` object in `app/page.tsx`, using the `Localized`
  (`{ ru; en }`) type.
- No formatter is pinned — keep `npm run lint` clean and match surrounding code.

## Testing

- Framework: Node's built-in `node:test` (no Jest/Vitest); tests live in `tests/` and
  assert on rendered HTML plus required source tokens/interactions.
- Name cases descriptively, e.g. `test("server-renders the bilingual ROOT / RITUAL site", …)`.
- Add a case for any new client interaction, section `id`, or design token; run `npm test` first.
- `npm run test:db` — opt-in integration tests (`tests/db-integration.test.mjs`) for the booking lifecycle and outbox on real Neon Postgres. Uses `TEST_DATABASE_URL`, else `DATABASE_URL` from `.env.local`; each run creates a throwaway schema `test_<ts>_<rand>`, applies `drizzle/*.sql` there, points the app at it via `DATABASE_SCHEMA` (WebSocket Pool + `search_path` on the unpooled endpoint, see `db/index.ts`) and drops it with CASCADE — `public` is never touched. Google/Resend are fetch-stubbed. Skips when no URL is set; needs network access to Neon. Never set `DATABASE_SCHEMA` in production.

## Commits & Pull Requests

- Use imperative, conventional-commit subjects (`feat:`, `fix:`, `chore:`); add a body
  for non-trivial changes.
- PRs: describe intent, link any issue, add before/after notes or screenshots for visual
  changes, and pass `npm test` + `npm run lint`. Flag design-system/token changes explicitly.

## Security & Configuration

- No secrets in the repo — environment belongs in ignored `.env*` files; keep real
  D1/R2/Postgres (DATABASE_URL/PG*) and Google OAuth values out of any tracked file.
- Don't implement routes for reserved paths (`/signin-with-chatgpt`,
  `/signout-with-chatgpt`, `/callback`); use the `app/chatgpt-auth.ts` helpers.
- Before real use: replace placeholder Instagram links and stock images. The booking form already POSTs to `/api/bookings`. To make it live: (1) point the DB at Neon via `DATABASE_URL` (or `PGUSER`/`PGHOST`/`PGPASSWORD`) in an ignored `.env.local` and as a Workers Builds build secret; deploys run `npm run db:migrate` to create/upgrade the `bookings` + `outbox` tables (the confirm flow needs the DB; see `docs/DEPLOY.md`); (2) for the Calendar event created on confirmation, set `GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN` (see `docs/GOOGLE_CALENDAR_SETUP.md`); (3) set `BOOKING_NOTIFY_EMAIL` = Olga's meeting mailbox (`olilka.zhgirova@gmail.com`), `EMAIL_API_KEY` (Resend) and `SITE_URL`; (4) set `ADMIN_API_TOKEN` and `OUTBOX_API_TOKEN` as Worker secrets and set up the Shortcut. Without a DB the form still accepts requests and emails Olga to confirm by hand.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
