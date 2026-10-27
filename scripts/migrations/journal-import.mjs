#!/usr/bin/env node
/**
 * Copy each article in content/journal.json into journal_articles.
 * Skips a slug that is already stored. Does not delete rows missing from the file.
 *
 * Usage: npm run journal:import
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Add it to .env.local, then run npm run journal:import.");
  process.exit(1);
}

const catalogPath = join(process.cwd(), "content", "journal.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
if (!Array.isArray(catalog.articles)) {
  console.error(`${catalogPath} has no articles array.`);
  process.exit(1);
}

const sql = neon(databaseUrl);
let inserted = 0;
let skipped = 0;

for (const [position, article] of catalog.articles.entries()) {
  const slug = String(article?.slug ?? "").trim();
  if (!slug) {
    console.error(`Article at index ${position} has no slug.`);
    process.exit(1);
  }
  const rows = await sql.query(
    `INSERT INTO journal_articles (slug, position, document)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (slug) DO NOTHING
     RETURNING slug`,
    [slug, position, JSON.stringify(article)],
  );
  if (rows.length > 0) {
    inserted += 1;
    console.log(`inserted ${slug}`);
  } else {
    skipped += 1;
    console.log(`skipped ${slug}`);
  }
}

console.log(`Done. Inserted ${inserted}, skipped ${skipped}.`);
