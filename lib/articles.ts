import catalogJson from "@/content/journal.json";

export type Localized = { ru: string; en: string };

export type JournalArticle = {
  slug: string;
  tag: Localized;
  title: Localized;
  text: Localized;
  time: Localized;
  byline: Localized;
  body: { ru: string[]; en: string[] };
};

const defaultByline: Localized = {
  ru: "Ольга · трихолог OZ SPA",
  en: "Olga · OZ SPA trichologist",
};

const catalog = catalogJson as { articles: JournalArticle[] };

export const articles: JournalArticle[] = catalog.articles.map((article) => ({
  ...article,
  byline: article.byline ?? defaultByline,
}));

export function getArticleBySlug(slug: string): JournalArticle | undefined {
  return articles.find((article) => article.slug === slug);
}

export function journalArticlePath(slug: string, lang?: "ru" | "en"): string {
  const base = `/journal/${slug}`;
  return lang === "en" ? `${base}?lang=en` : base;
}

export type ArticleLanguage = "ru" | "en";

export function pickArticleLanguage(value: string | string[] | undefined): ArticleLanguage {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "en" ? "en" : "ru";
}

export function slugifyJournalTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
