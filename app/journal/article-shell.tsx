import Link from "next/link";
import type { ReactNode } from "react";
import { SiteBrand } from "@/app/site-brand";
import type { ArticleLanguage } from "@/lib/articles";
import { journalArticlePath } from "@/lib/articles";

const shellCopy = {
  ru: {
    home: "OZ SPA — на главную",
    lang: "Язык",
  },
  en: {
    home: "OZ SPA — home",
    lang: "Language",
  },
} as const;

export function ArticleShell({
  slug,
  lang,
  children,
}: {
  slug: string;
  lang: ArticleLanguage;
  children: ReactNode;
}) {
  const t = shellCopy[lang];

  return (
    <main className="article-page">
      <header className="site-header site-header--flow">
        <SiteBrand href="/" ariaLabel={t.home} />
        <nav className="article-page-tools" aria-label={t.lang}>
          <Link
            className={lang === "ru" ? "article-lang is-active" : "article-lang"}
            href={journalArticlePath(slug, "ru")}
            hrefLang="ru"
            aria-current={lang === "ru" ? "page" : undefined}
          >
            RU
          </Link>
          <Link
            className={lang === "en" ? "article-lang is-active" : "article-lang"}
            href={journalArticlePath(slug, "en")}
            hrefLang="en"
            aria-current={lang === "en" ? "page" : undefined}
          >
            EN
          </Link>
        </nav>
      </header>
      <div className="article-page-content">{children}</div>
    </main>
  );
}
