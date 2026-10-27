"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Localized } from "@/lib/articles";
import { JournalArticleForm } from "./journal-article-form";

export type JournalAdminEntry = {
  slug: string;
  title: Localized;
};

function sameOrder(left: string[], right: string[]) {
  return left.length === right.length && left.every((slug, index) => slug === right[index]);
}

function moveEntry(entries: JournalAdminEntry[], slug: string, toIndex: number) {
  const from = entries.findIndex((entry) => entry.slug === slug);
  if (from < 0 || toIndex < 0 || toIndex >= entries.length || from === toIndex) return entries;
  const next = [...entries];
  const [item] = next.splice(from, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function dropIndex(list: HTMLElement, slug: string, clientY: number) {
  const others = [...list.querySelectorAll<HTMLElement>("[data-slug]")].filter(
    (row) => row.dataset.slug !== slug,
  );
  const index = others.findIndex((row) => {
    const box = row.getBoundingClientRect();
    return clientY < box.top + box.height / 2;
  });
  return index < 0 ? others.length : index;
}

export function JournalAdminDashboard({ articles }: { articles: JournalAdminEntry[] }) {
  const [apiKey, setApiKey] = useState("");
  const [keyReady, setKeyReady] = useState(false);
  const [checkingKey, setCheckingKey] = useState(false);
  const [entries, setEntries] = useState(articles);
  const [savedSlugs, setSavedSlugs] = useState(() => articles.map((article) => article.slug));
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [draggingSlug, setDraggingSlug] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const orderDirty = !sameOrder(
    entries.map((entry) => entry.slug),
    savedSlugs,
  );

  useEffect(() => {
    const list = listRef.current;
    if (!draggingSlug || !list) return;
    const move = (event: PointerEvent) => {
      const index = dropIndex(list, draggingSlug, event.clientY);
      setEntries((current) => moveEntry(current, draggingSlug, index));
    };
    const stop = () => setDraggingSlug(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [draggingSlug]);

  const unlock = async (event?: FormEvent) => {
    event?.preventDefault();
    const key = apiKey.trim();
    setNotice(null);
    setKeyReady(false);
    if (!key) {
      setNotice("Enter the admin key.");
      return;
    }
    setCheckingKey(true);
    try {
      const response = await fetch("/api/journal", {
        method: "GET",
        headers: { authorization: `Bearer ${key}` },
      });
      if (response.status === 401) {
        setNotice("Admin key was rejected.");
        return;
      }
      if (!response.ok) {
        setNotice("Could not verify the admin key.");
        return;
      }
      setKeyReady(true);
    } catch {
      setNotice("Could not reach the server.");
    } finally {
      setCheckingKey(false);
    }
  };

  const remove = async (entry: JournalAdminEntry) => {
    setNotice(null);
    if (!apiKey.trim()) {
      setNotice("Enter the admin key before deleting an article.");
      return;
    }
    const confirmed = window.confirm(
      `Удалить «${entry.title.ru}»? This removes ${entry.slug} from the journal.`,
    );
    if (!confirmed) return;
    setPendingSlug(entry.slug);
    try {
      const response = await fetch("/api/journal", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({ slug: entry.slug }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (response.status === 401) {
        setKeyReady(false);
        setNotice("Admin key was rejected.");
        return;
      }
      if (!response.ok) {
        setNotice(
          json.error === "catalog_unwritable"
            ? "The server could not write the journal."
            : `Could not delete ${entry.slug}.`,
        );
        return;
      }
      setEntries((current) => current.filter((item) => item.slug !== entry.slug));
      setSavedSlugs((current) => current.filter((slug) => slug !== entry.slug));
      setNotice(`Removed ${entry.slug} from the journal.`);
    } catch {
      setNotice("Could not reach the server.");
    } finally {
      setPendingSlug(null);
    }
  };

  const saveOrder = async () => {
    const slugs = entries.map((entry) => entry.slug);
    if (!apiKey.trim()) {
      setNotice("Enter the admin key before saving the order.");
      return;
    }
    setSavingOrder(true);
    setNotice(null);
    try {
      const response = await fetch("/api/journal", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({ slugs }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (response.status === 401) {
        setKeyReady(false);
        setNotice("Admin key was rejected.");
        return;
      }
      if (!response.ok) {
        setNotice(
          json.error === "catalog_unwritable"
            ? "The server could not write the journal."
            : "Could not save this order.",
        );
        return;
      }
      setSavedSlugs(slugs);
      setNotice("Saved this order.");
    } catch {
      setNotice("Could not reach the server.");
    } finally {
      setSavingOrder(false);
    }
  };

  return (
    <>
      <form className="journal-admin-key" onSubmit={unlock}>
        <label>
          <span>Admin key</span>
          <input
            type="password"
            autoComplete="current-password"
            value={apiKey}
            onChange={(event) => {
              const value = event.target.value;
              setApiKey(value);
              if (!value.trim()) {
                setKeyReady(false);
                setNotice(null);
              }
            }}
            placeholder="ADMIN_API_TOKEN"
            disabled={checkingKey}
          />
        </label>
        <button type="submit" className="button button-dark" disabled={checkingKey}>
          {checkingKey ? "Checking…" : "Unlock"}
        </button>
      </form>

      {notice ? (
        <p className="journal-admin-status" role="status">
          {notice}
        </p>
      ) : null}

      {keyReady ? (
        <>
          <ul
            ref={listRef}
            className={draggingSlug ? "journal-admin-list is-sorting" : "journal-admin-list"}
            aria-label="Journal articles"
          >
            {entries.map((entry) => (
              <li
                className={entry.slug === draggingSlug ? "journal-admin-row is-dragging" : "journal-admin-row"}
                key={entry.slug}
                data-slug={entry.slug}
              >
                <button
                  type="button"
                  className="journal-admin-grip"
                  aria-label={`Reorder ${entry.title.ru}`}
                  disabled={savingOrder || pendingSlug !== null}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    setDraggingSlug(entry.slug);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                    event.preventDefault();
                    const direction = event.key === "ArrowUp" ? -1 : 1;
                    setEntries((current) => {
                      const from = current.findIndex((item) => item.slug === entry.slug);
                      return moveEntry(current, entry.slug, from + direction);
                    });
                  }}
                >
                  <span />
                  <span />
                  <span />
                </button>
                <p>
                  {entry.title.ru}
                  <small>{entry.slug}</small>
                </p>
                <button
                  type="button"
                  className="journal-admin-delete"
                  disabled={pendingSlug === entry.slug || savingOrder}
                  onClick={() => remove(entry)}
                >
                  Удалить
                </button>
              </li>
            ))}
          </ul>

          {orderDirty ? (
            <div className="journal-admin-save-order">
              <button type="button" className="button button-dark" onClick={saveOrder} disabled={savingOrder}>
                Save this order.
              </button>
            </div>
          ) : null}

          <JournalArticleForm
            apiKey={apiKey}
            existingSlugs={entries.map((entry) => entry.slug)}
            onPublished={(article) => {
              setEntries((current) => [
                ...current,
                { slug: article.slug, title: article.title },
              ]);
              setSavedSlugs((current) => [...current, article.slug]);
            }}
          />
        </>
      ) : null}
    </>
  );
}
