import type { Metadata } from "next";
import { ArticleShell } from "../article-shell";
import { readJournalCatalog } from "@/lib/journal-catalog";
import { JournalAdminDashboard } from "./journal-admin-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Journal admin · OZ SPA",
  robots: { index: false, follow: false },
};

export default async function JournalAdminPage() {
  const { articles } = await readJournalCatalog();
  return (
    <ArticleShell slug="admin" lang="ru">
      <div className="article-read journal-admin">
        <p className="eyebrow">Journal</p>
        <JournalAdminDashboard articles={articles} />
      </div>
    </ArticleShell>
  );
}
