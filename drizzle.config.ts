import { defineConfig } from "drizzle-kit";

// Connection string for `drizzle-kit push` / `migrate`. `generate` only needs the
// schema + dialect, but we wire credentials from env so push/migrate work without
// editing this file. Keep the real value in an ignored .env* file.
function connectionString(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = process.env.PGUSER ?? process.env.POSTGRES_USER;
  const host = process.env.PGHOST ?? process.env.POSTGRES_HOST;
  if (!user || !host) return undefined;
  const password = process.env.PGPASSWORD ?? process.env.POSTGRES_PASSWORD ?? "";
  const port = process.env.PGPORT ?? process.env.POSTGRES_PORT ?? "5432";
  const database = process.env.PGDATABASE ?? process.env.POSTGRES_DB ?? "neondb";
  const auth = password ? `${user}:${password}@` : `${user}@`;
  return `postgresql://${auth}${host}:${port}/${database}`;
}

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  ...(connectionString()
    ? { dbCredentials: { url: connectionString() } }
    : {}),
});
