// Site language helpers. The language travels in `?lang=en` (Russian is the
// default). Type-only imports keep this safe to use from client components
// without bundling the article catalog.
import type { JournalArticle, Localized } from "./articles";

export type ArticleLanguage = "ru" | "en";

export function pickArticleLanguage(value: string | string[] | undefined): ArticleLanguage {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "en" ? "en" : "ru";
}

/** Home page URL that keeps the language; `hash` is e.g. "#journal". */
export function homeHref(lang: ArticleLanguage, hash = ""): string {
  return (lang === "en" ? "/?lang=en" : "/") + hash;
}

export function journalArticlePath(slug: string, lang?: ArticleLanguage): string {
  const base = `/journal/${slug}`;
  return lang === "en" ? `${base}?lang=en` : base;
}

export type LocalizedArticle = {
  /** Language the copy is actually in: Russian when the requested one is missing. */
  lang: ArticleLanguage;
  tag: string;
  title: string;
  text: string;
  time: string;
  byline: string;
  body: string[];
};

const defaultByline: Localized = {
  ru: "Ольга · трихолог OZ SPA",
  en: "Olga · OZ SPA trichologist",
};

// Database rows are unconstrained JSON, so older entries may lack English copy.
export function localizeArticle(article: JournalArticle, lang: ArticleLanguage): LocalizedArticle {
  const complete = Boolean(article.title?.[lang]?.trim() && article.body?.[lang]?.some((line) => line.trim()));
  const contentLang: ArticleLanguage = complete ? lang : "ru";
  const pick = (value: Localized | undefined) => value?.[contentLang]?.trim() || value?.ru || "";
  return {
    lang: contentLang,
    tag: pick(article.tag),
    title: pick(article.title),
    text: pick(article.text),
    time: pick(article.time),
    byline: pick(article.byline ?? defaultByline),
    body: article.body?.[contentLang] ?? [],
  };
}
