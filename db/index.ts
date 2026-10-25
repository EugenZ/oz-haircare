import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzlePool } from "drizzle-orm/neon-serverless";
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

type Database = ReturnType<typeof drizzle<typeof schema>>;

let cached: Database | null = null;

// Test-only (DATABASE_SCHEMA, set by tests/db-integration.test.mjs): run every
// query inside a dedicated Postgres schema. The HTTP driver is stateless, so a
// search_path cannot travel with it; instead a WebSocket Pool sets it as a
// startup parameter. Neon's pooler rejects that parameter, so the URL must be
// an unpooled endpoint. The app only uses the query-builder subset that both
// drivers share, hence the cast.
function schemaScopedDb(url: string, schemaName: string): Database {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(schemaName)) {
    throw new Error("DATABASE_SCHEMA must be a lowercase Postgres identifier");
  }
  neonConfig.webSocketConstructor ??= globalThis.WebSocket;
  const options = encodeURIComponent(`-c search_path=${schemaName}`);
  const pool = new Pool({
    connectionString: `${url}${url.includes("?") ? "&" : "?"}options=${options}`,
    max: 4,
    idleTimeoutMillis: 1000,
    allowExitOnIdle: true,
  });
  return drizzlePool(pool, { schema }) as unknown as Database;
}

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
  const testSchema = envValue("DATABASE_SCHEMA");
  cached = testSchema ? schemaScopedDb(url, testSchema) : drizzle(neon(url), { schema });
  return cached;
}
