// Journal articles live in journal_articles once that table has rows.
// Until then, and whenever the database is unreachable, the catalog is
// content/journal.json. JOURNAL_CATALOG_PATH overrides the file in tests.
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { asc, notInArray } from "drizzle-orm";
import { getDb } from "@/db";
import { journalArticles } from "@/db/schema";
import { articles as bundledArticles, type JournalArticle } from "./articles";

export type JournalCatalog = { articles: JournalArticle[] };

function journalCatalogPath(): string {
  const override = process.env.JOURNAL_CATALOG_PATH?.trim();
  return override || join(process.cwd(), "content", "journal.json");
}

function readFileCatalog(): JournalCatalog {
  try {
    const catalog = JSON.parse(readFileSync(journalCatalogPath(), "utf8")) as JournalCatalog;
    if (Array.isArray(catalog.articles)) return catalog;
  } catch {
    // Workers have no project files at runtime; use the copy bundled at build time.
  }
  return { articles: bundledArticles };
}

function writeFileCatalog(catalog: JournalCatalog): void {
  const path = journalCatalogPath();
  const next = join(dirname(path), `.${path.split("/").pop()}.tmp`);
  writeFileSync(next, `${JSON.stringify(catalog, null, 2)}\n`);
  renameSync(next, path);
}

async function readDbCatalog(): Promise<JournalCatalog | null> {
  try {
    const rows = await getDb()
      .select({ document: journalArticles.document })
      .from(journalArticles)
      .orderBy(asc(journalArticles.position));
    if (rows.length === 0) return null;
    return { articles: rows.map((row) => row.document) };
  } catch {
    return null;
  }
}

export async function readJournalCatalog(): Promise<JournalCatalog> {
  return (await readDbCatalog()) ?? readFileCatalog();
}

async function writeDbCatalog(catalog: JournalCatalog): Promise<void> {
  const db = getDb();
  const slugs = catalog.articles.map((article) => article.slug);
  if (slugs.length === 0) {
    await db.delete(journalArticles);
    return;
  }
  await db.delete(journalArticles).where(notInArray(journalArticles.slug, slugs));
  for (const [position, article] of catalog.articles.entries()) {
    await db
      .insert(journalArticles)
      .values({ slug: article.slug, position, document: article })
      .onConflictDoUpdate({
        target: journalArticles.slug,
        set: { position, document: article },
      });
  }
}

export async function writeJournalCatalog(catalog: JournalCatalog): Promise<void> {
  try {
    await writeDbCatalog(catalog);
  } catch {
    writeFileCatalog(catalog);
  }
}
