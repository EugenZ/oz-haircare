"use client";

import { FormEvent, useMemo, useState } from "react";
import type { JournalArticle } from "@/lib/articles";
import { slugifyJournalTitle } from "@/lib/articles";

const defaultByline = {
  ru: "Ольга · трихолог OZ SPA",
  en: "Olga · OZ SPA trichologist",
};

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
  bodyRu: string;
  bodyEn: string;
}): JournalArticle {
  return {
    slug: form.slug.trim(),
    tag: { ru: form.tagRu.trim(), en: form.tagEn.trim() },
    title: { ru: form.titleRu.trim(), en: form.titleEn.trim() },
    text: { ru: form.textRu.trim(), en: form.textEn.trim() },
    time: { ru: form.timeRu.trim(), en: form.timeEn.trim() },
    byline: defaultByline,
    body: {
      ru: splitParagraphs(form.bodyRu),
      en: splitParagraphs(form.bodyEn),
    },
  };
}

export function JournalArticleForm({
  apiKey,
  existingSlugs,
  onPublished,
}: {
  apiKey: string;
  existingSlugs: string[];
  onPublished: (article: JournalArticle) => void;
}) {
  const [titleEn, setTitleEn] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

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
      bodyRu: String(data.get("bodyRu") ?? ""),
      bodyEn: String(data.get("bodyEn") ?? ""),
    });
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) {
      setStatus("Slug must use lowercase letters, numbers, and hyphens only.");
      return null;
    }
    if (existingSlugs.includes(article.slug)) {
      setStatus(`Slug “${article.slug}” already exists.`);
      return null;
    }
    if (!article.title.ru || !article.title.en || article.body.ru.length === 0 || article.body.en.length === 0) {
      setStatus("Add titles and at least one paragraph in each language.");
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
    try {
      const response = await fetch("/api/journal", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify(article),
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
            : json.error === "catalog_unwritable"
              ? "The server could not write the journal file."
              : "Could not save the article.",
        );
        return;
      }
      onPublished(article);
      setStatus(`Saved ${article.slug} to the journal.`);
    } catch {
      setStatus("Could not reach the server.");
    }
  };

  return (
    <form className="journal-admin-form" onSubmit={onSubmit}>
      <p className="journal-admin-lead">
        A valid admin key writes the article to <code>content/journal.json</code>. Download still
        saves a JSON file you can commit by hand, or run <code>npm run journal:new</code> for a
        blank scaffold.
      </p>

      <div className="journal-admin-grid">
        <label>
          <span>Slug</span>
          <input
            name="slug"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            placeholder={suggestedSlug || "my-article-slug"}
            required
          />
        </label>
        <label>
          <span>Tag (RU / EN)</span>
          <div className="journal-admin-pair">
            <input name="tagRu" placeholder="База" required />
            <input name="tagEn" placeholder="Basics" required />
          </div>
        </label>
        <label>
          <span>Title (RU / EN)</span>
          <div className="journal-admin-pair">
            <input name="titleRu" placeholder="Заголовок" required />
            <input
              name="titleEn"
              value={titleEn}
              onChange={(event) => onTitleEnChange(event.target.value)}
              placeholder="Title"
              required
            />
          </div>
        </label>
        <label>
          <span>Teaser (RU / EN)</span>
          <div className="journal-admin-pair">
            <textarea name="textRu" rows={3} placeholder="Кратко для карточки" required />
            <textarea name="textEn" rows={3} placeholder="Card teaser" required />
          </div>
        </label>
        <label>
          <span>Reading time (RU / EN)</span>
          <div className="journal-admin-pair">
            <input name="timeRu" defaultValue="5 минут чтения" required />
            <input name="timeEn" defaultValue="5 min read" required />
          </div>
        </label>
        <label>
          <span>Body (RU) — paragraphs separated by a blank line</span>
          <textarea name="bodyRu" rows={8} required />
        </label>
        <label>
          <span>Body (EN)</span>
          <textarea name="bodyEn" rows={8} required />
        </label>
      </div>

      <div className="journal-admin-actions">
        <button type="submit" className="button button-dark">
          Save article
        </button>
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
