"use client";

import { FormEvent, useMemo, useState } from "react";
import type { JournalArticle } from "@/lib/articles";
import { slugifyJournalTitle } from "@/lib/articles";
import type { ArticleLanguage } from "@/lib/i18n";
import { ArticleBody } from "../article-body";

type Draft = Record<"tag" | "title" | "time" | "byline" | "body", Record<ArticleLanguage, string>>;

const defaultByline = {
  ru: "Ольга · трихолог OZ SPA",
  en: "Olga · OZ SPA trichologist",
};

const emptyDraft: Draft = {
  tag: { ru: "", en: "" },
  title: { ru: "", en: "" },
  time: { ru: "5 минут чтения", en: "5 min read" },
  byline: defaultByline,
  body: { ru: "", en: "" },
};

function articleDraft(article?: JournalArticle): Draft {
  if (!article) return emptyDraft;
  return {
    tag: { ru: article.tag?.ru ?? "", en: article.tag?.en ?? "" },
    title: { ru: article.title?.ru ?? "", en: article.title?.en ?? "" },
    time: { ru: article.time?.ru ?? "", en: article.time?.en ?? "" },
    byline: {
      ru: article.byline?.ru ?? defaultByline.ru,
      en: article.byline ? article.byline.en ?? "" : defaultByline.en,
    },
    body: { ru: (article.body?.ru ?? []).join("\n\n"), en: (article.body?.en ?? []).join("\n\n") },
  };
}

function readDraft(form: HTMLFormElement): Draft {
  const data = new FormData(form);
  const pair = (name: string) => ({
    ru: String(data.get(`${name}Ru`) ?? ""),
    en: String(data.get(`${name}En`) ?? ""),
  });
  return {
    tag: pair("tag"), title: pair("title"), time: pair("time"),
    byline: pair("byline"), body: pair("body"),
  };
}

function splitParagraphs(value: string): string[] {
  return value
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildArticle(form: {
  slug: string;
  tagRu: string;
  tagEn: string;
  titleRu: string;
  titleEn: string;
  textRu: string;
  textEn: string;
  timeRu: string;
  timeEn: string;
  bylineRu: string;
  bylineEn: string;
  bodyRu: string;
  bodyEn: string;
}): JournalArticle {
  return {
    slug: form.slug.trim(),
    tag: { ru: form.tagRu.trim(), en: form.tagEn.trim() },
    title: { ru: form.titleRu.trim(), en: form.titleEn.trim() },
    text: { ru: form.textRu.trim(), en: form.textEn.trim() },
    time: { ru: form.timeRu.trim(), en: form.timeEn.trim() },
    byline: { ru: form.bylineRu.trim(), en: form.bylineEn.trim() },
    body: {
      ru: splitParagraphs(form.bodyRu),
      en: splitParagraphs(form.bodyEn),
    },
  };
}

export function JournalArticleForm({
  apiKey,
  existingSlugs,
  initialArticle,
  onSaved,
  onCancel,
}: {
  apiKey: string;
  existingSlugs: string[];
  initialArticle?: JournalArticle;
  onSaved: (article: JournalArticle) => void;
  onCancel?: () => void;
}) {
  const [titleEn, setTitleEn] = useState(initialArticle?.title?.en ?? "");
  const [slug, setSlug] = useState(initialArticle?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initialArticle));
  const [status, setStatus] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(() => articleDraft(initialArticle));
  const [previewLang, setPreviewLang] = useState<ArticleLanguage>("ru");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const previewBody = splitParagraphs(draft.body[previewLang]);

  const suggestedSlug = useMemo(() => slugifyJournalTitle(titleEn), [titleEn]);

  const onTitleEnChange = (value: string) => {
    setTitleEn(value);
    if (!slugTouched) {
      setSlug(slugifyJournalTitle(value));
    }
  };

  const articleFromForm = (form: HTMLFormElement): JournalArticle | null => {
    const data = new FormData(form);
    const article = buildArticle({
      slug: String(data.get("slug") ?? slug),
      tagRu: String(data.get("tagRu") ?? ""),
      tagEn: String(data.get("tagEn") ?? ""),
      titleRu: String(data.get("titleRu") ?? ""),
      titleEn: String(data.get("titleEn") ?? titleEn),
      textRu: String(data.get("textRu") ?? ""),
      textEn: String(data.get("textEn") ?? ""),
      timeRu: String(data.get("timeRu") ?? "5 минут чтения"),
      timeEn: String(data.get("timeEn") ?? "5 min read"),
      bylineRu: String(data.get("bylineRu") ?? ""),
      bylineEn: String(data.get("bylineEn") ?? ""),
      bodyRu: String(data.get("bodyRu") ?? ""),
      bodyEn: String(data.get("bodyEn") ?? ""),
    });
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) {
      setStatus("Slug must use lowercase letters, numbers, and hyphens only.");
      return null;
    }
    if (existingSlugs.includes(article.slug) && article.slug !== initialArticle?.slug) {
      setStatus(`Slug “${article.slug}” already exists.`);
      return null;
    }
    if (
      !article.title.ru || article.body.ru.length === 0 ||
      (!initialArticle && (!article.title.en || article.body.en.length === 0))
    ) {
      setStatus(initialArticle
        ? "Add a Russian title and at least one paragraph."
        : "Add titles and at least one paragraph in each language.");
      return null;
    }
    return article;
  };

  const downloadArticle = (article: JournalArticle) => {
    const blob = new Blob([JSON.stringify(article, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${article.slug}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    const article = articleFromForm(event.currentTarget);
    if (!article) return;
    if (!apiKey.trim()) {
      setStatus("Enter the admin key above to save the article on the server.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/journal", {
        method: initialArticle ? "PATCH" : "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify(initialArticle ? { slug: initialArticle.slug, article } : article),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (response.status === 401) {
        setStatus("Admin key was rejected.");
        return;
      }
      if (!response.ok) {
        setStatus(
          json.error === "duplicate"
            ? `Slug “${article.slug}” already exists.`
            : json.error === "not_found"
              ? "This article no longer exists. Return to the article list."
              : json.error === "catalog_unwritable"
                ? "The server could not write the journal."
                : "Could not save the article.",
        );
        return;
      }
      setDirty(false);
      onSaved(article);
      setStatus(`Saved ${article.slug} to the journal.`);
    } catch {
      setStatus("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="journal-admin-form"
      onSubmit={onSubmit}
      onChange={(event) => {
        setDraft(readDraft(event.currentTarget));
        setDirty(true);
      }}
    >
      <p className="journal-admin-lead">
        {initialArticle
          ? "Edit the article below. Saving updates the journal without changing its link."
          : "Write the article in Russian and English, then save it to the journal."}
      </p>

      <div className="journal-admin-grid">
        <label>
          <span>Slug</span>
          <input
            name="slug"
            value={slug}
            readOnly={Boolean(initialArticle)}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            placeholder={suggestedSlug || "my-article-slug"}
            required
          />
          {initialArticle ? <small className="journal-admin-hint">The article link stays the same.</small> : null}
        </label>
        <label>
          <span>Tag (RU / EN)</span>
          <div className="journal-admin-pair">
            <input name="tagRu" aria-label="Tag (RU)" defaultValue={initialArticle?.tag?.ru} placeholder="База" required />
            <input name="tagEn" aria-label="Tag (EN)" defaultValue={initialArticle?.tag?.en} placeholder="Basics" required={!initialArticle || Boolean(initialArticle.tag?.en)} />
          </div>
        </label>
        <label>
          <span>Title (RU / EN)</span>
          <div className="journal-admin-pair">
            <input name="titleRu" aria-label="Title (RU)" defaultValue={initialArticle?.title?.ru} placeholder="Заголовок" required />
            <input
              name="titleEn"
              aria-label="Title (EN)"
              value={titleEn}
              onChange={(event) => onTitleEnChange(event.target.value)}
              placeholder="Title"
              required={!initialArticle || Boolean(initialArticle.title?.en)}
            />
          </div>
        </label>
        <label>
          <span>Teaser (RU / EN)</span>
          <div className="journal-admin-pair">
            <textarea name="textRu" aria-label="Teaser (RU)" defaultValue={initialArticle?.text?.ru} rows={3} placeholder="Кратко для карточки" required />
            <textarea name="textEn" aria-label="Teaser (EN)" defaultValue={initialArticle?.text?.en} rows={3} placeholder="Card teaser" required={!initialArticle || Boolean(initialArticle.text?.en)} />
          </div>
        </label>
        <label>
          <span>Reading time (RU / EN)</span>
          <div className="journal-admin-pair">
            <input name="timeRu" aria-label="Reading time (RU)" defaultValue={initialArticle?.time?.ru ?? "5 минут чтения"} required />
            <input name="timeEn" aria-label="Reading time (EN)" defaultValue={initialArticle ? initialArticle.time?.en ?? "" : "5 min read"} required={!initialArticle || Boolean(initialArticle.time?.en)} />
          </div>
        </label>
        <label>
          <span>Author (RU / EN)</span>
          <div className="journal-admin-pair">
            <input name="bylineRu" aria-label="Author (RU)" defaultValue={initialArticle?.byline?.ru ?? defaultByline.ru} required />
            <input name="bylineEn" aria-label="Author (EN)" defaultValue={initialArticle?.byline ? initialArticle.byline.en ?? "" : defaultByline.en} required={!initialArticle || Boolean(initialArticle.byline?.en)} />
          </div>
        </label>
        <p className="journal-admin-hint">
          Blank line — new paragraph · line break is kept · <code>## </code> heading ·{" "}
          <code>* </code> or <code>- </code> bullet · <code>1. </code> numbered item ·{" "}
          <code>**bold**</code>
        </p>
        <label>
          <span>Body (RU)</span>
          <textarea name="bodyRu" defaultValue={draft.body.ru} rows={8} required />
        </label>
        <label>
          <span>Body (EN)</span>
          <textarea name="bodyEn" defaultValue={draft.body.en} rows={8} required={!initialArticle || Boolean(initialArticle.body?.en?.length)} />
        </label>
      </div>

      <section className="journal-admin-preview" aria-label="Preview">
        <div className="journal-admin-preview-head">
          <span>Preview</span>
          <div className="journal-admin-preview-tabs" role="group" aria-label="Preview language">
            {(["ru", "en"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                className={lang === previewLang ? "is-active" : ""}
                aria-pressed={lang === previewLang}
                onClick={() => setPreviewLang(lang)}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="journal-admin-preview-page" lang={previewLang}>
          <p className="eyebrow">{draft.tag[previewLang] || "—"}</p>
          <p className="journal-admin-preview-title">{draft.title[previewLang] || "—"}</p>
          <p className="article-byline">
            {draft.byline[previewLang]} · {draft.time[previewLang]}
          </p>
          {previewBody.length > 0 ? (
            <ArticleBody body={previewBody} />
          ) : (
            <p className="journal-admin-hint">The body text will appear here.</p>
          )}
        </div>
      </section>

      <div className="journal-admin-actions">
        <button type="submit" className="button button-dark" disabled={saving}>
          {saving ? "Saving…" : initialArticle ? "Save changes / Сохранить" : "Save article"}
        </button>
        {onCancel ? (
          <button
            type="button"
            className="journal-admin-delete"
            disabled={saving}
            onClick={() => {
              if (!dirty || window.confirm("Discard unsaved changes?")) onCancel();
            }}
          >
            Cancel / Отмена
          </button>
        ) : null}
        <button
          type="button"
          className="journal-admin-delete"
          onClick={(event) => {
            setStatus(null);
            const form = event.currentTarget.form;
            if (!form) return;
            const article = articleFromForm(form);
            if (!article) return;
            downloadArticle(article);
            setStatus(`Downloaded ${article.slug}.json.`);
          }}
        >
          Download JSON
        </button>
      </div>
      {status ? (
        <p className="journal-admin-status" role="status">
          {status}
        </p>
      ) : null}
    </form>
  );
}
