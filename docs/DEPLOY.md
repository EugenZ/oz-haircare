# Deploy: database migrations

The site runs on Cloudflare Workers (Workers Builds, connected to this repo) with
a Neon Postgres database. Schema changes ship as SQL migrations in `drizzle/`
and are applied automatically on every deploy, before the new code is built.

## How it works

- `npm run db:generate` — after editing `db/schema.ts`, writes a new
  `drizzle/NNNN_*.sql` file + `drizzle/meta/*`. Commit them with the code change.
- `npm run db:migrate` — `drizzle-kit migrate`: applies every migration that is
  not yet recorded in `drizzle.__drizzle_migrations` (one row per applied file,
  sha256 of the file + its journal timestamp). Already-applied files are skipped,
  so running it on every deploy is a no-op when nothing changed.
- `drizzle.config.ts` reads `DATABASE_URL` (or `PGUSER`/`PGHOST`/`PGPASSWORD`)
  and throws when it is missing for `migrate` / `push`, so a misconfigured build
  fails instead of deploying code ahead of the schema.
- `drizzle-kit` is a devDependency; Workers Builds installs devDependencies.

## Cloudflare dashboard (one-time)

Workers & Pages → the site's Worker → **Settings → Build**:

1. **Build command:** `npm run db:migrate && npm run build`
2. **Build variables and secrets:** add `DATABASE_URL` as a **secret** (the same
   Neon connection string the Worker uses). Build variables are separate from
   the Worker's runtime variables — keep `DATABASE_URL` in
   **Settings → Variables and Secrets** as well; the running Worker needs it too.

A failing migration fails the build, so the deploy is blocked and the previous
version keeps serving. This is intended: fix the migration and push again.

## Rules

- Do not use `drizzle-kit push` against production any more — it changes the
  schema without recording a migration, and the next `migrate` would then try
  to re-apply it. Always `db:generate` + commit + deploy.
- Migrations must be backward compatible with the code that is still running
  during the deploy (add columns with defaults first; drop in a later release).
- To apply by hand (e.g. a hotfix), run with the production URL in an ignored
  `.env.local`: `node --env-file=.env.local node_modules/drizzle-kit/bin.cjs migrate`.
