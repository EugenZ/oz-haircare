// Journal writer. Authorization: Bearer $ADMIN_API_TOKEN.
// POST appends one article. PUT replaces article order. DELETE removes one by slug.
import { hasBearer, unauthorized } from "@/lib/http";
import {
  appendJournalArticle,
  deleteJournalArticle,
  reorderJournalArticles,
  type JournalWriteError,
} from "@/lib/journal-store";

const STATUS: Record<JournalWriteError, number> = {
  invalid: 400,
  duplicate: 409,
  not_found: 404,
  catalog_unwritable: 503,
};

export async function GET(request: Request) {
  if (!hasBearer(request, "ADMIN_API_TOKEN")) return unauthorized();
  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  if (!hasBearer(request, "ADMIN_API_TOKEN")) return unauthorized();
  const body = await request.json().catch(() => null);
  const result = await appendJournalArticle(body);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: STATUS[result.error] });
  }
  return Response.json({ ok: true, slug: result.article.slug }, { status: 201 });
}

export async function PUT(request: Request) {
  if (!hasBearer(request, "ADMIN_API_TOKEN")) return unauthorized();
  const body = (await request.json().catch(() => null)) as { slugs?: unknown } | null;
  const result = await reorderJournalArticles(body?.slugs);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: STATUS[result.error] });
  }
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!hasBearer(request, "ADMIN_API_TOKEN")) return unauthorized();
  const body = (await request.json().catch(() => null)) as { slug?: unknown } | null;
  const slug = String(body?.slug ?? "").trim();
  const result = await deleteJournalArticle(slug);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: STATUS[result.error] });
  }
  return Response.json({ ok: true, slug });
}
