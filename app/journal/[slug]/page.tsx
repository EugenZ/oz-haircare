import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleBody } from "../article-body";
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
  {
    back: string;
    readTime: string;
    onlyRussian: string;
    pager: string;
    previous: string;
    next: string;
  }
> = {
  ru: {
    back: "К журналу",
    readTime: "Время чтения",
    onlyRussian: "",
    pager: "Другие статьи журнала",
    previous: "Предыдущая статья",
    next: "Следующая статья",
  },
  en: {
    back: "Back to journal",
    readTime: "Reading time",
    onlyRussian: "This article is not yet available in English, so it is shown in Russian.",
    pager: "More journal articles",
    previous: "Previous article",
    next: "Next article",
  },
};

export default async function JournalArticlePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const lang = pickArticleLanguage((await searchParams).lang);
  const { articles } = await readJournalCatalog();
  const position = articles.findIndex((entry) => entry.slug === slug);
  const article = articles[position];

  if (!article) {
    notFound();
  }

  const t = readCopy[lang];
  const content = localizeArticle(article, lang);
  const [previous, next] = [articles[position - 1], articles[position + 1]].map((entry) =>
    entry ? { slug: entry.slug, ...localizeArticle(entry, lang) } : null,
  );

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
          <ArticleBody body={content.body} />
        </div>
        {previous || next ? (
          <nav className="article-pager" aria-label={t.pager}>
            {previous ? (
              <Link className="article-pager-link article-pager-prev" href={journalArticlePath(previous.slug, lang)}>
                <small>← {t.previous}</small>
                <span lang={previous.lang}>{previous.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link className="article-pager-link article-pager-next" href={journalArticlePath(next.slug, lang)}>
                <small>{t.next} →</small>
                <span lang={next.lang}>{next.title}</span>
              </Link>
            ) : null}
          </nav>
        ) : null}
        <p className="article-back">
          <Link className="text-link" href={homeHref(lang, "#journal")}>
            {t.back} <span aria-hidden="true">↗</span>
          </Link>
        </p>
      </article>
    </ArticleShell>
  );
}
