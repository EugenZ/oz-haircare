#!/usr/bin/env node
/**
 * Add a scaffold article to content/journal.json.
 * Usage: node scripts/journal-new.mjs my-article-slug
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const slug = process.argv[2]?.trim();
if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error("Usage: npm run journal:new -- <slug-like-this>");
  process.exit(1);
}

const catalogPath = join(process.cwd(), "content/journal.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));

if (catalog.articles.some((article) => article.slug === slug)) {
  console.error(`Slug already exists: ${slug}`);
  process.exit(1);
}

const entry = {
  slug,
  tag: { ru: "Черновик", en: "Draft" },
  title: {
    ru: "Новая статья — замените заголовок",
    en: "New article — replace this title",
  },
  text: {
    ru: "Краткое описание для карточки на главной.",
    en: "Short teaser for the home page card.",
  },
  time: { ru: "5 минут чтения", en: "5 min read" },
  byline: {
    ru: "Ольга · трихолог OZ SPA",
    en: "Olga · OZ SPA trichologist",
  },
  body: {
    ru: ["Первый абзац полного текста.", "Второй абзац."],
    en: ["First paragraph of the full article.", "Second paragraph."],
  },
};

catalog.articles.push(entry);
writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Added ${slug} to content/journal.json`);
console.log(`Preview: /journal/${slug}`);
