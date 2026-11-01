"use client";

import { Fragment, useEffect, useState, type MouseEvent } from "react";
import { SiteBrand } from "@/app/site-brand";
import type { Localized } from "@/lib/articles";
import { homeHref, type ArticleLanguage as SiteLanguage } from "@/lib/i18n";

export const siteHeaderCopy = {
  ru: {
    brandAria: "OZ SPA — на главную",
    language: "Язык",
    nav: {
      about: "Обо мне",
      services: "Процедуры",
      journal: "Полезно",
      gallery: "Работы",
      book: "Записаться",
      menu: "Меню",
      close: "Закрыть",
    },
  },
  en: {
    brandAria: "OZ SPA — home",
    language: "Language",
    nav: {
      about: "About",
      services: "Treatments",
      journal: "Journal",
      gallery: "Work",
      book: "Book a visit",
      menu: "Menu",
      close: "Close",
    },
  },
} as const;

const languages: SiteLanguage[] = ["ru", "en"];

/**
 * The one site header: brand, section nav, mobile menu, and the RU / EN switch.
 * On the home page pass `onLanguageChange` to switch in place; elsewhere the
 * switch links to `languageHrefs` and the nav links back to home sections.
 */
export function SiteHeader({
  language,
  languageHrefs,
  onLanguageChange,
  onHome = false,
}: {
  language: SiteLanguage;
  languageHrefs: Localized;
  onLanguageChange?: (language: SiteLanguage) => void;
  onHome?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const t = siteHeaderCopy[language];
  const section = (id: string) => (onHome ? `#${id}` : homeHref(language, `#${id}`));
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const selectLanguage = (next: SiteLanguage) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (!onLanguageChange) return;
    event.preventDefault();
    onLanguageChange(next);
  };

  return (
    <header className={onHome ? "site-header" : "site-header site-header--flow"}>
      <SiteBrand href={onHome ? "#top" : homeHref(language)} ariaLabel={t.brandAria} />
      <button
        className="menu-toggle"
        type="button"
        aria-expanded={menuOpen}
        aria-controls="main-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span>{menuOpen ? t.nav.close : t.nav.menu}</span>
        <span className="menu-lines" aria-hidden="true">
          <i />
          <i />
        </span>
      </button>
      <nav
        id="main-navigation"
        className={"main-nav " + (menuOpen ? "is-open" : "")}
        aria-label="Primary navigation"
      >
        <a href={section("about")} onClick={closeMenu}>
          {t.nav.about}
        </a>
        <a href={section("services")} onClick={closeMenu}>
          {t.nav.services}
        </a>
        <a href={section("journal")} onClick={closeMenu}>
          {t.nav.journal}
        </a>
        <a href={section("gallery")} onClick={closeMenu}>
          {t.nav.gallery}
        </a>
        <a className="nav-cta" href={section("booking")} onClick={closeMenu}>
          {t.nav.book} <span>↗</span>
        </a>
      </nav>
      <div className="language-switch" role="group" aria-label={t.language}>
        {languages.map((code, index) => (
          <Fragment key={code}>
            {index > 0 && <span aria-hidden="true">/</span>}
            <a
              className={language === code ? "is-active" : undefined}
              href={languageHrefs[code]}
              hrefLang={code}
              lang={code}
              aria-current={language === code ? "true" : undefined}
              onClick={selectLanguage(code)}
            >
              {code.toUpperCase()}
            </a>
          </Fragment>
        ))}
      </div>
    </header>
  );
}
