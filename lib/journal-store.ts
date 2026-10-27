// Create, reorder, and delete journal articles. Writes Postgres when it is reachable.
import { readJournalCatalog, writeJournalCatalog } from "./journal-catalog";
import type { JournalArticle, Localized } from "./articles";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type JournalWriteError = "invalid" | "duplicate" | "not_found" | "catalog_unwritable";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function localized(value: unknown, max: number): Localized | null {
  if (!isRecord(value)) return null;
  const ru = String(value.ru ?? "").trim();
  const en = String(value.en ?? "").trim();
  if (!ru || !en || ru.length > max || en.length > max) return null;
  return { ru, en };
}

function paragraphs(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 40) return null;
  const lines = value.map((line) => String(line ?? "").trim());
  if (lines.some((line) => !line || line.length > 8000)) return null;
  return lines;
}

export function parseJournalArticle(value: unknown): JournalArticle | null {
  if (!isRecord(value) || !SLUG.test(String(value.slug ?? "").trim())) return null;
  const tag = localized(value.tag, 80);
  const title = localized(value.title, 200);
  const text = localized(value.text, 500);
  const time = localized(value.time, 80);
  const byline = value.byline == null ? null : localized(value.byline, 120);
  if (!tag || !title || !text || !time || (value.byline != null && !byline)) return null;
  if (!isRecord(value.body)) return null;
  const ru = paragraphs(value.body.ru);
  const en = paragraphs(value.body.en);
  if (!ru || !en) return null;
  return {
    slug: String(value.slug).trim(),
    tag,
    title,
    text,
    time,
    byline: byline ?? {
      ru: "Ольга · трихолог OZ SPA",
      en: "Olga · OZ SPA trichologist",
    },
    body: { ru, en },
  };
}

export async function appendJournalArticle(
  value: unknown,
): Promise<{ ok: true; article: JournalArticle } | { ok: false; error: JournalWriteError }> {
  const article = parseJournalArticle(value);
  if (!article) return { ok: false, error: "invalid" };
  try {
    const catalog = await readJournalCatalog();
    if (catalog.articles.some((entry) => entry.slug === article.slug)) {
      return { ok: false, error: "duplicate" };
    }
    catalog.articles.push(article);
    await writeJournalCatalog(catalog);
    return { ok: true, article };
  } catch {
    return { ok: false, error: "catalog_unwritable" };
  }
}

export async function reorderJournalArticles(
  slugs: unknown,
): Promise<{ ok: true } | { ok: false; error: JournalWriteError }> {
  if (!Array.isArray(slugs)) return { ok: false, error: "invalid" };
  const order = slugs.filter((slug): slug is string => typeof slug === "string" && SLUG.test(slug));
  if (order.length !== slugs.length || new Set(order).size !== order.length) {
    return { ok: false, error: "invalid" };
  }
  try {
    const catalog = await readJournalCatalog();
    const bySlug = new Map(catalog.articles.map((article) => [article.slug, article]));
    if (order.length !== bySlug.size || order.some((slug) => !bySlug.has(slug))) {
      return { ok: false, error: "invalid" };
    }
    const articles: JournalArticle[] = [];
    for (const slug of order) {
      const article = bySlug.get(slug);
      if (!article) return { ok: false, error: "invalid" };
      articles.push(article);
    }
    const unchanged = articles.every((article, index) => article.slug === catalog.articles[index]?.slug);
    if (!unchanged) await writeJournalCatalog({ articles });
    return { ok: true };
  } catch {
    return { ok: false, error: "catalog_unwritable" };
  }
}

export async function deleteJournalArticle(
  slug: string,
): Promise<{ ok: true } | { ok: false; error: JournalWriteError }> {
  if (!SLUG.test(slug)) return { ok: false, error: "invalid" };
  try {
    const catalog = await readJournalCatalog();
    const articles = catalog.articles.filter((entry) => entry.slug !== slug);
    if (articles.length === catalog.articles.length) return { ok: false, error: "not_found" };
    await writeJournalCatalog({ articles });
    return { ok: true };
  } catch {
    return { ok: false, error: "catalog_unwritable" };
  }
}
