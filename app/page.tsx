import Home from "./home-client";
import { pickArticleLanguage } from "@/lib/i18n";
import { readJournalCatalog } from "@/lib/journal-catalog";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ articles }, { lang }] = await Promise.all([readJournalCatalog(), searchParams]);
  return <Home articles={articles} initialLanguage={pickArticleLanguage(lang)} />;
}
