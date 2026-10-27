import Home from "./home-client";
import { readJournalCatalog } from "@/lib/journal-catalog";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { articles } = await readJournalCatalog();
  return <Home articles={articles} />;
}
