import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleShell } from "../article-shell";
import {
  homeHref,
  journalArticlePath,
  localizeArticle,
  pickArticleLanguage,
  type ArticleLanguage,
} from "@/lib/i18n";
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
  const { title, text: description } = localizeArticle(article, lang);
  return {
    title: `${title} · OZ SPA`,
    description,
    alternates: {
      languages: { ru: journalArticlePath(slug, "ru"), en: journalArticlePath(slug, "en") },
    },
    openGraph: {
      title: `${title} · OZ SPA`,
      description,
      type: "article",
    },
  };
}

const readCopy: Record<
  ArticleLanguage,
  { back: string; readTime: string; onlyRussian: string }
> = {
  ru: { back: "К журналу", readTime: "Время чтения", onlyRussian: "" },
  en: {
    back: "Back to journal",
    readTime: "Reading time",
    onlyRussian: "This article is not yet available in English, so it is shown in Russian.",
  },
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
  const content = localizeArticle(article, lang);

  return (
    <ArticleShell slug={slug} lang={lang}>
      <article className="article-read">
        {content.lang !== lang && (
          <p className="article-language-note" role="note">
            {t.onlyRussian}
          </p>
        )}
        <div lang={content.lang}>
          <p className="eyebrow">{content.tag}</p>
          <h1>{content.title}</h1>
          <p className="article-byline">
            <span>{content.byline}</span>
            <span aria-hidden="true"> · </span>
            <span>
              {readCopy[content.lang].readTime}: {content.time}
            </span>
          </p>
          <div className="article-body">
            {content.body.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>
        <p className="article-back">
          <Link className="text-link" href={homeHref(lang, "#journal")}>
            {t.back} <span aria-hidden="true">↗</span>
          </Link>
        </p>
      </article>
    </ArticleShell>
  );
}
