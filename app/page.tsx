"use client";

import { FormEvent, useEffect, useState } from "react";

type Language = "ru" | "en";
type Localized = { ru: string; en: string };

type Service = {
  number: string;
  title: Localized;
  duration: Localized;
  text: Localized;
  details: Localized[];
  videoUrl: string;
};

type Article = {
  tag: Localized;
  title: Localized;
  text: Localized;
  time: Localized;
};

const copy = {
  ru: {
    brandAria: "ROOT / RITUAL — на главную",
    nav: { about: "Обо мне", services: "Процедуры", journal: "Журнал", gallery: "Работы", book: "Записаться", menu: "Меню", close: "Закрыть" },
    hero: {
      eyebrow: "Трихолог · восстановление волос",
      title: "Волосы, к которым хочется",
      titleEm: "прикасаться.",
      lead: "Разбираюсь в состоянии кожи головы и длины, чтобы собрать уход, который подходит именно вам — бережно, понятно, надолго.",
      choose: "Выбрать время",
      procedures: "Посмотреть процедуры",
      notes: ["Диагностика", "Протокол", "Поддержка"],
      imageAlt: "Длинные волосы в солнечном свете",
      noteTop: "Уход без перегруза",
      noteTopSmall: "естественный результат",
      noteBottomSmall: "Главное",
      noteBottom: "понять причину",
    },
    ticker: ["Кожа головы", "Реконструкция", "Мягкий уход", "Живые волосы"],
    about: {
      label: "Обо мне",
      title: "Здоровые волосы начинаются",
      titleEm: "с понимания.",
      imageAlt: "Уход за волосами в салоне",
      caption: "бережная работа|с каждой прядью",
      large: "Я за спокойный подход к волосам. Без обещаний «за один раз» и советов, которые подходят всем. Сначала слушаем, смотрим, задаём вопросы — потом выбираем процедуру.",
      body: "На встрече вы получаете не только уход в кресле, но и понятную систему: что делать дома, чего не делать, когда возвращаться и как замечать изменения.",
      signature: "ваш специалист по волосам",
      processLabel: "Как всё проходит",
      process: [
        ["Слушаем", "что изменилось и чего хочется"],
        ["Смотрим", "кожа головы, длина, текстура"],
        ["Собираем", "процедура и план поддержки"],
      ],
    },
    services: {
      label: "Процедуры",
      title: "Выбираем не модное.",
      titleEm: "Выбираем ваше.",
      aside: "Каждая встреча начинается с вопросов и заканчивается планом, который можно поддерживать в обычной жизни.",
      details: "Подробнее",
      video: "Видео в Instagram",
      notSure: "Не знаете, что выбрать?",
      message: "Напишите — помогу сориентироваться",
      procedure: "процедура",
      watch: "Смотреть видео в Instagram",
      book: "Записаться",
    },
    instagram: {
      label: "Видео и объяснения",
      title: "Загляните в",
      titleEm: "Instagram.",
      text: "Показываю процедуры изнутри, объясняю сложное простыми словами и делюсь маленькими привычками, которые меняют состояние волос.",
      open: "Открыть профиль",
    },
    gallery: {
      label: "Работы",
      title: "Тактильный результат.",
      text: "Смотрите на текстуру, блеск и движение волос — не только на картинку «до и после».",
      study: "изучение текстуры",
      alts: ["Длинные волосы в мягком солнечном свете", "Профессиональный уход за волосами", "Естественная текстура длинных волос", "Женский портрет с длинными волосами"],
    },
    journal: {
      label: "Журнал о волосах",
      title: "Полезное, которое хочется",
      titleEm: "сохранить.",
      all: "Все материалы",
      read: "Читать статью",
    },
    booking: {
      label: "Запись на встречу",
      title: "Начнём с",
      titleEm: "разговора.",
      text: "Оставьте контакты — я напишу, задам несколько вопросов и предложу подходящий формат встречи.",
      location: "Москва · очно",
      schedule: "Пн–Сб · 10:00–20:00",
      name: "Ваше имя",
      namePlaceholder: "Как к вам обращаться?",
      contact: "Телефон или Instagram",
      contactPlaceholder: "Где с вами связаться?",
      interest: "Что вас интересует?",
      select: "Выберите направление",
      serviceOptions: ["Диагностика кожи головы", "Реконструкция волос", "Уход после окрашивания", "Пока не знаю"],
      message: "Сообщение",
      optional: "необязательно",
      messagePlaceholder: "Расскажите, что происходит с волосами",
      submit: "Отправить заявку",
      privacy: "Нажимая кнопку, вы соглашаетесь на обработку персональных данных.",
      successTitle: "Заявка принята.",
      successText: "Спасибо. Я свяжусь с вами в ближайшее время, чтобы подобрать удобный день.",
      another: "Отправить ещё одну заявку",
    },
    footer: { label: "Трихолог · восстановление волос", copyright: "© 2026 · с заботой о ваших волосах" },
  },
  en: {
    brandAria: "ROOT / RITUAL — home",
    nav: { about: "About", services: "Treatments", journal: "Journal", gallery: "Work", book: "Book a visit", menu: "Menu", close: "Close" },
    hero: {
      eyebrow: "Trichology · hair restoration",
      title: "Hair you want to",
      titleEm: "reach for.",
      lead: "I look at the scalp and the lengths together, then build a care plan that fits you — gentle, clear, and made to last.",
      choose: "Choose a time",
      procedures: "Explore treatments",
      notes: ["Diagnosis", "Protocol", "Support"],
      imageAlt: "Long hair in warm sunlight",
      noteTop: "Care without overload",
      noteTopSmall: "a natural result",
      noteBottomSmall: "First step",
      noteBottom: "understand the cause",
    },
    ticker: ["Scalp care", "Reconstruction", "Gentle rituals", "Living hair"],
    about: {
      label: "About",
      title: "Healthy hair begins",
      titleEm: "with understanding.",
      imageAlt: "Professional hair care in a salon",
      caption: "gentle work|with every strand",
      large: "I believe in a calm approach to hair. No one-visit promises and no advice designed for everyone. We listen, look closely, ask questions — then choose the treatment.",
      body: "You leave with more than a salon treatment: a clear system for home care, what to avoid, when to return, and how to notice change.",
      signature: "your hair specialist",
      processLabel: "The process",
      process: [
        ["Listen", "what changed and what you want"],
        ["Look", "scalp, lengths, texture"],
        ["Build", "treatment and support plan"],
      ],
    },
    services: {
      label: "Treatments",
      title: "Not what is trending.",
      titleEm: "What is yours.",
      aside: "Every visit starts with questions and ends with a plan you can actually keep up with in everyday life.",
      details: "Details",
      video: "Watch on Instagram",
      notSure: "Not sure where to start?",
      message: "Write to me — I will help you choose",
      procedure: "treatment",
      watch: "Watch the Instagram video",
      book: "Book a visit",
    },
    instagram: {
      label: "Videos and explainers",
      title: "Visit",
      titleEm: "Instagram.",
      text: "See treatments from the inside, get clear explanations, and find small habits that change the way your hair feels.",
      open: "Open profile",
    },
    gallery: {
      label: "Work",
      title: "A tactile result.",
      text: "Look for texture, shine, and movement — not only a before-and-after picture.",
      study: "texture study",
      alts: ["Long hair in soft sunlight", "Professional hair treatment", "Natural long hair texture", "Woman with long hair in warm light"],
    },
    journal: {
      label: "The hair journal",
      title: "Useful things worth",
      titleEm: "saving.",
      all: "All articles",
      read: "Read article",
    },
    booking: {
      label: "Book a visit",
      title: "Let’s start with a",
      titleEm: "conversation.",
      text: "Leave your details — I will ask a few questions and suggest the right format for your visit.",
      location: "Moscow · in person",
      schedule: "Mon–Sat · 10:00–20:00",
      name: "Your name",
      namePlaceholder: "What should I call you?",
      contact: "Phone or Instagram",
      contactPlaceholder: "Where can I reach you?",
      interest: "What are you looking for?",
      select: "Choose a direction",
      serviceOptions: ["Scalp diagnosis", "Hair reconstruction", "Post-colour care", "Not sure yet"],
      message: "Message",
      optional: "optional",
      messagePlaceholder: "Tell me what is happening with your hair",
      submit: "Send request",
      privacy: "By sending this form, you agree to the processing of personal data.",
      successTitle: "Request received.",
      successText: "Thank you. I will be in touch soon to find a convenient day.",
      another: "Send another request",
    },
    footer: { label: "Trichology · hair restoration", copyright: "© 2026 · made with care for your hair" },
  },
} as const;

const imageBase = "https://images.unsplash.com/";

const services: Service[] = [
  {
    number: "01",
    title: { ru: "Диагностика кожи головы", en: "Scalp diagnosis" },
    duration: { ru: "60 минут", en: "60 minutes" },
    text: { ru: "Разбираем состояние кожи головы, привычки ухода и причины изменений — спокойно и без универсальных схем.", en: "We look at your scalp, care habits, and what has changed — calmly, without one-size-fits-all advice." },
    details: [
      { ru: "Подробная беседа о состоянии волос и образе жизни", en: "A detailed conversation about your hair and lifestyle" },
      { ru: "Визуальная оценка кожи головы и длины", en: "A visual look at the scalp and lengths" },
      { ru: "Понятный план следующих шагов и домашнего ухода", en: "A clear next-step and home-care plan" },
    ],
    videoUrl: "https://www.instagram.com/",
  },
  {
    number: "02",
    title: { ru: "Реконструкция волос", en: "Hair reconstruction" },
    duration: { ru: "120 минут", en: "120 minutes" },
    text: { ru: "Бережный протокол для сухой, пористой и повреждённой длины — с фокусом на качество волос, а не на быстрый эффект.", en: "A gentle protocol for dry, porous, and damaged lengths — focused on hair quality, not a quick effect." },
    details: [
      { ru: "Подбор протокола под пористость и историю волос", en: "A protocol matched to porosity and hair history" },
      { ru: "Работа с повреждёнными участками длины", en: "Focused work with damaged lengths" },
      { ru: "Рекомендации, которые помогают удерживать результат дома", en: "Recommendations that help you keep the result at home" },
    ],
    videoUrl: "https://www.instagram.com/",
  },
  {
    number: "03",
    title: { ru: "Уход после окрашивания", en: "Post-colour care" },
    duration: { ru: "90 минут", en: "90 minutes" },
    text: { ru: "Помогаем сохранить мягкость, блеск и живой цвет после осветления или окрашивания.", en: "Help your hair keep its softness, shine, and alive-looking colour after lightening or colouring." },
    details: [
      { ru: "Оценка состояния волос после химического воздействия", en: "An assessment after chemical processing" },
      { ru: "Мягкое восстановление без перегруза", en: "Gentle restoration without overload" },
      { ru: "Схема ухода между визитами", en: "A care rhythm between visits" },
    ],
    videoUrl: "https://www.instagram.com/",
  },
];

const articles: Article[] = [
  {
    tag: { ru: "База", en: "Basics" },
    title: { ru: "Почему волосы быстро теряют свежесть", en: "Why hair loses freshness so quickly" },
    text: { ru: "О коже головы, частоте мытья и сигналах, которые не стоит игнорировать.", en: "About the scalp, wash frequency, and signals worth paying attention to." },
    time: { ru: "5 минут чтения", en: "5 min read" },
  },
  {
    tag: { ru: "Уход", en: "Care" },
    title: { ru: "Как читать состав шампуня", en: "How to read a shampoo label" },
    text: { ru: "Небольшая памятка: на что смотреть, если кожа головы чувствительная, а длина сухая.", en: "A small guide to what matters when the scalp is sensitive and the lengths are dry." },
    time: { ru: "7 минут чтения", en: "7 min read" },
  },
  {
    tag: { ru: "Длина", en: "Lengths" },
    title: { ru: "Восстановление — не только маска", en: "Restoration is more than a mask" },
    text: { ru: "Разбираем, из чего складывается устойчивый результат и почему ему нужен план.", en: "What creates a lasting result, and why it needs a plan." },
    time: { ru: "6 минут чтения", en: "6 min read" },
  },
];

const galleryImages = [
  {
    src: imageBase + "photo-1702910449473-0ed91bb0dd4a?auto=format&fit=crop&w=1200&q=85",
    alt: { ru: "Длинные волосы в мягком солнечном свете", en: "Long hair in soft sunlight" },
    className: "gallery-image gallery-image-tall",
  },
  {
    src: imageBase + "photo-1717160675489-7779f2c91999?auto=format&fit=crop&w=1000&q=85",
    alt: { ru: "Профессиональный уход за волосами", en: "Professional hair treatment" },
    className: "gallery-image",
  },
  {
    src: imageBase + "photo-1567102064187-b6709041f322?auto=format&fit=crop&w=1000&q=85",
    alt: { ru: "Естественная текстура длинных волос", en: "Natural long hair texture" },
    className: "gallery-image",
  },
  {
    src: imageBase + "photo-1635713150362-ed0cd425e697?auto=format&fit=crop&w=1200&q=85",
    alt: { ru: "Женский портрет с длинными волосами", en: "Woman with long hair in warm light" },
    className: "gallery-image gallery-image-wide",
  },
];

export default function Home() {
  const [language, setLanguage] = useState<Language>("ru");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeService, setActiveService] = useState<Service | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const t = copy[language];

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!activeService) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveService(null);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleEscape);
    };
  }, [activeService]);

  const closeMenu = () => setMenuOpen(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label={t.brandAria}>
          <span className="brand-mark" aria-hidden="true">R</span>
          <span>ROOT / RITUAL</span>
        </a>
        <button
          className="menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span>{menuOpen ? t.nav.close : t.nav.menu}</span>
          <span className="menu-lines" aria-hidden="true"><i /><i /></span>
        </button>
        <nav id="main-navigation" className={"main-nav " + (menuOpen ? "is-open" : "")} aria-label="Primary navigation">
          <a href="#about" onClick={closeMenu}>{t.nav.about}</a>
          <a href="#services" onClick={closeMenu}>{t.nav.services}</a>
          <a href="#journal" onClick={closeMenu}>{t.nav.journal}</a>
          <a href="#gallery" onClick={closeMenu}>{t.nav.gallery}</a>
          <a className="nav-cta" href="#booking" onClick={closeMenu}>{t.nav.book} <span>↗</span></a>
        </nav>
        <div className="language-switch" aria-label="Language">
          <button type="button" className={language === "ru" ? "is-active" : ""} onClick={() => setLanguage("ru")}>RU</button>
          <span>/</span>
          <button type="button" className={language === "en" ? "is-active" : ""} onClick={() => setLanguage("en")}>EN</button>
        </div>
      </header>

      <section className="hero section-pad" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> {t.hero.eyebrow}</p>
          <h1>{t.hero.title} <em>{t.hero.titleEm}</em></h1>
          <p className="hero-lead">{t.hero.lead}</p>
          <div className="hero-actions">
            <a className="button button-dark" href="#booking">{t.hero.choose} <span>↗</span></a>
            <a className="text-link" href="#services">{t.hero.procedures} <span>↓</span></a>
          </div>
          <div className="hero-notes">
            {t.hero.notes.map((note, index) => <span key={note}>0{index + 1} <b>{note}</b></span>)}
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="hero-image-wrap">
            <img src={imageBase + "photo-1702910449473-0ed91bb0dd4a?auto=format&fit=crop&w=1400&q=90"} alt={t.hero.imageAlt} className="hero-image" fetchPriority="high" />
          </div>
          <div className="floating-note floating-note-top">
            <span className="note-icon">✦</span>
            <span><b>{t.hero.noteTop}</b><small>{t.hero.noteTopSmall}</small></span>
          </div>
          <div className="floating-note floating-note-bottom">
            <span className="note-number">01</span>
            <span><small>{t.hero.noteBottomSmall}</small><b>{t.hero.noteBottom}</b></span>
          </div>
        </div>
      </section>

      <div className="ticker" aria-label="Focus areas">
        <div className="ticker-track">
          {t.ticker.concat(t.ticker).map((item, index) => <span key={item + index}>{item}<i>✳</i></span>)}
        </div>
      </div>

      <section className="about section-pad" id="about">
        <div className="section-intro">
          <p className="eyebrow">{t.about.label}</p>
          <h2>{t.about.title} <em>{t.about.titleEm}</em></h2>
        </div>
        <div className="about-grid">
          <div className="about-image-wrap">
            <img src={imageBase + "photo-1717160675489-7779f2c91999?auto=format&fit=crop&w=1200&q=85"} alt={t.about.imageAlt} className="about-image" loading="lazy" />
            <span className="image-caption">{t.about.caption.split("|").map((line) => <span key={line}>{line}<br /></span>)}</span>
          </div>
          <div className="about-copy">
            <p className="large-copy">{t.about.large}</p>
            <p>{t.about.body}</p>
            <div className="signature"><span className="signature-line" /><span>{t.about.signature}</span></div>
          </div>
        </div>
        <div className="process-row">
          <div className="process-label">{t.about.processLabel}</div>
          {t.about.process.map((step, index) => <div className="process-step" key={step[0]}><span>0{index + 1}</span><b>{step[0]}</b><small>{step[1]}</small></div>)}
        </div>
      </section>

      <section className="services section-pad section-tint" id="services">
        <div className="services-heading">
          <div className="section-intro">
            <p className="eyebrow">{t.services.label}</p>
            <h2>{t.services.title} <em>{t.services.titleEm}</em></h2>
          </div>
          <p className="heading-aside">{t.services.aside}</p>
        </div>
        <div className="services-list">
          {services.map((service) => (
            <article className="service-card" key={service.number}>
              <div className="service-topline"><span>{service.number}</span><span>{service.duration[language]}</span></div>
              <h3>{service.title[language]}</h3>
              <p>{service.text[language]}</p>
              <div className="service-actions">
                <button className="round-arrow" type="button" onClick={() => setActiveService(service)} aria-label={t.services.details + ": " + service.title[language]}>↗</button>
                <a className="service-video-link" href={service.videoUrl} target="_blank" rel="noreferrer">{t.services.video} <span>↗</span></a>
              </div>
            </article>
          ))}
        </div>
        <div className="services-footnote"><span>{t.services.notSure}</span><a href="#booking">{t.services.message} <span>↗</span></a></div>
      </section>

      <section className="instagram-strip section-pad">
        <div className="instagram-intro">
          <div className="instagram-badge">◎</div>
          <div><p className="eyebrow">{t.instagram.label}</p><h2>{t.instagram.title} <em>{t.instagram.titleEm}</em></h2></div>
        </div>
        <p className="instagram-copy">{t.instagram.text}</p>
        <a className="button button-outline" href="https://www.instagram.com/" target="_blank" rel="noreferrer">{t.instagram.open} <span>↗</span></a>
      </section>

      <section className="gallery section-pad" id="gallery">
        <div className="gallery-heading"><div className="section-intro"><p className="eyebrow">{t.gallery.label}</p><h2>{t.gallery.title}</h2></div><p>{t.gallery.text}</p></div>
        <div className="gallery-grid">
          {galleryImages.map((image, index) => <figure className={"gallery-item gallery-item-" + (index + 1)} key={image.src}><img src={image.src} alt={t.gallery.alts[index]} className={image.className} loading="lazy" /><figcaption>{String(index + 1).padStart(2, "0")} / {t.gallery.study}</figcaption></figure>)}
        </div>
      </section>

      <section className="journal section-pad section-tint" id="journal">
        <div className="journal-heading"><div className="section-intro"><p className="eyebrow">{t.journal.label}</p><h2>{t.journal.title} <em>{t.journal.titleEm}</em></h2></div><a className="text-link" href="#journal">{t.journal.all} <span>↗</span></a></div>
        <div className="articles-grid">
          {articles.map((article, index) => <article className="article-card" key={article.title[language]}><div className="article-number">0{index + 1}</div><div className="article-meta"><span>{article.tag[language]}</span><span>{article.time[language]}</span></div><h3>{article.title[language]}</h3><p>{article.text[language]}</p><a href="#journal" aria-label={t.journal.read + ": " + article.title[language]}>{t.journal.read} <span>↗</span></a></article>)}
        </div>
      </section>

      <section className="booking section-pad" id="booking">
        <div className="booking-heading"><p className="eyebrow eyebrow-light"><span className="eyebrow-dot" /> {t.booking.label}</p><h2>{t.booking.title} <em>{t.booking.titleEm}</em></h2><p>{t.booking.text}</p><div className="booking-details"><span>{t.booking.location}</span><span>{t.booking.schedule}</span></div></div>
        <div className="booking-form-wrap">
          {submitted ? <div className="form-success"><span className="success-mark">✓</span><h3>{t.booking.successTitle}</h3><p>{t.booking.successText}</p><button className="text-link text-link-light" type="button" onClick={() => setSubmitted(false)}>{t.booking.another} <span>↗</span></button></div> : <form className="booking-form" onSubmit={handleSubmit}><label><span>{t.booking.name}</span><input type="text" name="name" placeholder={t.booking.namePlaceholder} required /></label><label><span>{t.booking.contact}</span><input type="text" name="contact" placeholder={t.booking.contactPlaceholder} required /></label><label><span>{t.booking.interest}</span><select name="service" defaultValue="" required><option value="" disabled>{t.booking.select}</option>{t.booking.serviceOptions.map((option) => <option key={option}>{option}</option>)}</select></label><label><span>{t.booking.message} <small>{t.booking.optional}</small></span><textarea name="message" placeholder={t.booking.messagePlaceholder} rows={3} /></label><button className="button button-light" type="submit">{t.booking.submit} <span>↗</span></button><p className="form-privacy">{t.booking.privacy}</p></form>}
        </div>
      </section>

      <footer className="site-footer section-pad"><a className="brand" href="#top"><span className="brand-mark" aria-hidden="true">R</span><span>ROOT / RITUAL</span></a><p>{t.footer.label}</p><a className="footer-instagram" href="https://www.instagram.com/" target="_blank" rel="noreferrer">Instagram <span>↗</span></a><span className="footer-note">{t.footer.copyright}</span></footer>

      {activeService && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveService(null); }}><div className="service-modal" role="dialog" aria-modal="true" aria-labelledby="service-modal-title"><button className="modal-close" type="button" onClick={() => setActiveService(null)} aria-label={t.nav.close}>×</button><p className="eyebrow">{activeService.number} / {t.services.procedure}</p><h2 id="service-modal-title">{activeService.title[language]}</h2><p>{activeService.text[language]}</p><ul>{activeService.details.map((detail) => <li key={detail[language]}><span>✦</span>{detail[language]}</li>)}</ul><div className="modal-actions"><a className="button button-dark" href="#booking" onClick={() => setActiveService(null)}>{t.services.book} <span>↗</span></a><a className="text-link" href={activeService.videoUrl} target="_blank" rel="noreferrer">{t.services.watch} <span>↗</span></a></div></div></div>}
    </main>
  );
}
