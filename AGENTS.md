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
- `app/api/bookings/route.ts` — `POST` persists a booking to Neon, creates a server-side Google Calendar event (client added as attendee) and sends email notifications; `GET` lists recent requests. `lib/google.ts` creates the Calendar event via OAuth; `lib/email.ts` builds the invite + `.ics` fallback and sends via a configurable REST backend (see `env.example`, `docs/GOOGLE_CALENDAR_SETUP.md`).
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
- `npm run db:generate` — generate migrations after editing `db/schema.ts`.

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
- Before real use: replace placeholder Instagram links and stock images. The booking form already POSTs to `/api/bookings`. To make it live: (1) point the DB at Neon via `DATABASE_URL` (or `PGUSER`/`PGHOST`/`PGPASSWORD`) in an ignored `.env.local`, run `npm run db:generate` then `npx drizzle-kit push` to create the `bookings` table; (2) for a server-created Google Calendar event + attendee invite, set `GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN` (see `docs/GOOGLE_CALENDAR_SETUP.md`); (3) set `BOOKING_NOTIFY_EMAIL` = Olga's meeting mailbox (`olilka.zhgirova@gmail.com`) and an `EMAIL_API_KEY` for HTML confirmations. With none of these set the form still confirms locally with a calendar link + `.ics`.

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
