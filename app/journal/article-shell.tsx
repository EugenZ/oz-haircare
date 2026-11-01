import type { ReactNode } from "react";
import { SiteHeader } from "@/app/site-header";
import { journalArticlePath, type ArticleLanguage } from "@/lib/i18n";

export function ArticleShell({
  slug,
  lang,
  children,
}: {
  slug: string;
  lang: ArticleLanguage;
  children: ReactNode;
}) {
  return (
    <main className="article-page">
      <SiteHeader
        language={lang}
        languageHrefs={{ ru: journalArticlePath(slug, "ru"), en: journalArticlePath(slug, "en") }}
      />
      <div className="article-page-content">{children}</div>
    </main>
  );
}
