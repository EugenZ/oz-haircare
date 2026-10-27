import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleShell } from "../article-shell";
import { pickArticleLanguage, type ArticleLanguage } from "@/lib/articles";
import { readJournalCatalog } from "@/lib/journal-catalog";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { articles } = await readJournalCatalog();
  const article = articles.find((entry) => entry.slug === slug);
  if (!article) {
    return { title: "Статья · OZ SPA" };
  }
  const lang = pickArticleLanguage((await searchParams).lang);
  const title = article.title[lang];
  const description = article.text[lang];
  return {
    title: `${title} · OZ SPA`,
    description,
    openGraph: {
      title: `${title} · OZ SPA`,
      description,
      type: "article",
    },
  };
}

const readCopy: Record<
  ArticleLanguage,
  { back: string; readTime: string }
> = {
  ru: { back: "К журналу", readTime: "Время чтения" },
  en: { back: "Back to journal", readTime: "Reading time" },
};

export default async function JournalArticlePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const lang = pickArticleLanguage((await searchParams).lang);
  const { articles } = await readJournalCatalog();
  const article = articles.find((entry) => entry.slug === slug);

  if (!article) {
    notFound();
  }

  const t = readCopy[lang];
  const journalHref = lang === "en" ? "/?lang=en#journal" : "/#journal";

  return (
    <ArticleShell slug={slug} lang={lang}>
      <article className="article-read">
        <p className="eyebrow">{article.tag[lang]}</p>
        <h1>{article.title[lang]}</h1>
        <p className="article-byline">
          <span>{article.byline[lang]}</span>
          <span aria-hidden="true"> · </span>
          <span>
            {t.readTime}: {article.time[lang]}
          </span>
        </p>
        <div className="article-body">
          {article.body[lang].map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
        <p className="article-back">
          <Link className="text-link" href={journalHref}>
            {t.back} <span aria-hidden="true">↗</span>
          </Link>
        </p>
      </article>
    </ArticleShell>
  );
}
