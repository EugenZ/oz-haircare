import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { env as bindingEnv } from "cloudflare:workers";

// Read a value from local process.env first, then the Worker binding (secrets
// injected at deploy time). Both are optional: when neither is set the database
// is simply unavailable and the booking form degrades gracefully.
function envValue(name: string): string | undefined {
  const fromProcess = process.env[name];
  if (fromProcess) return fromProcess;
  const fromBinding = bindingEnv as unknown as Record<string, string | undefined>;
  return fromBinding?.[name];
}

// Build a Postgres connection string. A full DATABASE_URL wins; otherwise we
// assemble one from the split PG* variables, so a credentials file that only has
// PGUSER / PGPASSWORD / PGHOST (plus optional PGPORT / PGDATABASE) also works.
// Returns undefined when nothing usable is configured.
function connectionString(): string | undefined {
  const full = envValue("DATABASE_URL");
  if (full) return full;

  const user = envValue("PGUSER") ?? envValue("POSTGRES_USER");
  const host = envValue("PGHOST") ?? envValue("POSTGRES_HOST");
  if (!user || !host) return undefined;

  const password = envValue("PGPASSWORD") ?? envValue("POSTGRES_PASSWORD") ?? "";
  const port = envValue("PGPORT") ?? envValue("POSTGRES_PORT") ?? "5432";
  const database = envValue("PGDATABASE") ?? envValue("POSTGRES_DB") ?? "neondb";
  const auth = password ? `${user}:${password}@` : `${user}@`;
  return `postgresql://${auth}${host}:${port}/${database}`;
}

let cached: ReturnType<typeof drizzle<typeof schema>> | null = null;

// Lazily create (and memoize) the Drizzle/Neon client. Construction is cheap and
// never connects — the first query does. The route wraps getDb() in a try/catch,
// so a missing or failing database degrades gracefully instead of 500ing.
export function getDb() {
  if (cached) return cached;
  const url = connectionString();
  if (!url) {
    throw new Error(
      "No database configured. Set DATABASE_URL (or PGUSER/PGHOST/PGPASSWORD) in an ignored .env* file or as Worker secrets.",
    );
  }
  cached = drizzle(neon(url), { schema });
  return cached;
}
