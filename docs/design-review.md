# DESIGN REVIEW — ROOT / RITUAL · OZ SPA

> Generated with the Superdesign plugin · canvas: https://superdesign.dev/teams/6a493359-ac8b-4904-ae21-ce761e8d2c87/projects/7581a039-1f2c-428b-97e1-054f1e93fd05
> Scope: design analysis + conclusion for the current bilingual RU/EN single-page site.

## Вердикт
Спелая, узнаваемая и внутренне согласованная дизайн-система «теплой редакционной»
эстетики (clay / cream / ink + шрифт Georgia). Единый язык во всех секциях, сильный
ритм, продуманная адаптивность и адекватная поддержка доступности. Главная проблема —
не визуальная, а «производственная»: часть ассетов и интеграций остаётся placeholder,
который нужно заменить перед реальной публикацией.

## Что работает хорошо
- **Дизайн-система оформлена и защищена тестами.** `opendesign/root-ritual/`
  (DESIGN.md + tokens.css + manifest.json) — полный OpenDesign-пакет; тест
  `ships a complete OpenDesign design-system package` проверяет наличие всех токенов.
- **Цвета выдержаны.** Бумажный фон `#fbfaf6`, крем `#f5f1e9`, шалфей `#dfe6da`,
  лесной ink `#26342d`, глина `#c66d4e` (акцент), светлая глина `#e9b89c` на тёмном.
  Глина используется дозированно (eyebrow, ссылки, акценты) — как и предписано DESIGN.md.
- **Типографика цельная.** Display — Georgia/Times (обводка 0, negative tracking,
  italic-подчёркивания), body — Arial/Helvetica, mono — Consolas. Ровная шкала
  11/13/16/21/30/44/72/108 px.
- **Резкие углы (radius 0)** — сильная, последовательная идентичность (никаких скруглений
  кроме pill-точек/кружков-кнопок).
- **Микровзаимодействия сдержанные и единые:** 200 ms, `cubic-bezier(.2,0,0,1)`,
  лёгкий «подъём» кнопок, дрейф стрелок `↗`, зум галереи, бегущая строка.
  Есть `prefers-reduced-motion: reduce` (выключает декоративные анимации).
- **Карусель «Обо мне»** (9 слайдов, fan-стек фото слева + счётчик/текст/круглые
  стрелки справа, свайп) соответствует референсу Chris Coyier и вписана в палитру.
- **Доступность:** `focus-visible` на всех кнопках/переключателях, `aria-expanded`
  на аккордеоне и карточке «Дополнительные услуги», `aria-roledescription="carousel"`,
  обновление `documentElement.lang`, alt у активного слайда, `aria-current` на точках
  сертификатов, видимые фокус-кольца.
- **Двуязычность построена корректно:** единый `copy = { ru, en }` с типом
  `Localized`, RU/EN равны как поверхности.

## Риски и зазоры (важно перед публикацией)
1. **Повторяющиеся placeholder-фото (ошибочное состояние).**
   `about-08.jpg` ≡ `about-03.jpg`, `about-09.jpg` ≡ `about-06.jpg` (md5 совпадает) —
   слайды 8 и 9 дублируют 3 и 6. Реальные фото обещаны позже; пока карусель «зациклена».
2. **Placeholder-ссылка на Instagram:** `https://www.instagram.com/olga_zhgirova`
   (хардкод, 2 места — strip и footer). Заместить на реальный профиль.
3. **Форма записи — только интерфейс.** `onSubmit` лишь ставит `submitted=true`;
   реального эндпоинта нет (подтверждение локальное). Нужно подключить приём заявок.
4. **Мёртвые ссылки в «Журнале».** Кнопка «Все статьи» и ссылки на статьи ведут
   на `#journal` (страницы статей не существует).
5. **Предупреждения lint:** `@next/next/no-img-element` ×6 (используется `<img>`,
   не `next/image`). Не блокирует сборку, но стоит перейти на `next/image` для
   авто-оптимизации (важно при тяжёлых PNG-ассетах: hero-hair.png ~1 MB, about-01/02 ~2 MB).
6. **Шрифт Geist загружается, но не используется.** В `layout.tsx` импортируются
   `Geist`/`Geist_Mono` (next/font), а визуально система работает на системных
   Arial/Helvetica/Georgia (по DESIGN.md). Лишний сетевой вес без эффекта — либо
   подключить Geist, либо убрать импорт.
7. **Доступность-нюансы (не блокер, но улучшить):**
   - Счётчик карусели «Обо мне» помечен `aria-hidden` — скринридер не слышит текущий
     индекс. Полезно добавить `aria-live="polite"` на текст слайда.
   - Акцентная глина `#c66d4e` на бумажном фоне для мелкого eyebrow/ссылок — проверить
     контраст (может быть на грани 4.5:1 для мелкого текста).
8. **Производственные границы (по DESIGN.md / AGENTS.md):** не публиковать, не добавлять
   аналитику и не менять реальные контактные данные без явного одобрения.

## Приоритизированные рекомендации
- **P0 (перед публикацией):** заменить дублирующиеся/placeholder-фото на реальные;
  вставить реальный Instagram; подключить реальный приём заявок в форме записи.
- **P1:** перевести `<img>` → `next/image` (убрать 6 предупреждений + оптимизация веса);
  добавить страницу/раздел «Журнал» или убрать «мёртвые» ссылки; решить вопрос со
  шрифтом Geist (включить или убрать).
- **P2:** `aria-live` на тексте слайда; проверить контраст глины на мелком тексте;
  добавить автопаузу/клавиатурную навигацию в каруселях (стрелки Left/Right, Home/End).
- **Позитив:** идентичность, ритм, доступность-базис и двуязычность — уровень «готово к
  прод-полировке», не «перерисовка».

## Вывод
Дизайн-система зрелая и целостная: её не нужно перепроектировать, нужно
**довести до производства** — заменить placeholder-ассеты и интеграции, убрать
неиспользуемый шрифт и «мёртвые» ссылки, закрыть пару a11y-нюансов. После этого
сайт готов к публикации в текущей эстетике.

### Canvas
https://superdesign.dev/teams/6a493359-ac8b-4904-ae21-ce761e8d2c87/projects/7581a039-1f2c-428b-97e1-054f1e93fd05

---

## Приложение — Карта изменений и зависимостей (change impact & dependency map)

> Граф-анализ, эквивалентный тому, что дал бы Graphify, но собранный локально из
> `app/page.tsx`, `app/layout.tsx`, `tests/rendered-html.test.mjs` и `public/`.
> Один файл `app/page.tsx` = 1834 строки, единый компонент `Home` (с 1136).

### A. Пути вызовов (feature call-paths)

**Точки входа (якоря данных → что рендерят):**

| Якорь | Строка | Рендерит / управляет |
|---|---|---|
| `featuredServices = services.slice(0,4)` | 746 | Аккордеон услуг (4 карточки, `#services`) |
| `extraServices = services.slice(4)` | 747 | Карточка «Дополнительные услуги» (свёрнута, «05» / `$60–$280`) |
| `articles` | 749 | 3 карточки «Журнал» (все ссылки → `#journal`, т.е. на себя = dead) |
| `galleryImages` | 788 | Сетка 4 фото (`#gallery`) |
| `aboutPhotos` | 833 | Карусель «Обо мне» (fan-стек, 9 слайдов, `#about`) |
| `aboutRotations = [5,-3,7,-6,4,-8,6,-4,2]` | 910 | Наклон каждого слайда в веере |
| `certificates: AboutPhoto[] = []` | 913 | Слайдер «Мои дипломы и сертификаты» — **ПУСТОЙ** |
| `TIME_SLOTS` / `availableSlots(iso,now)` | 915 / 944 | Чипы времени в записи |
| `ServiceRow` / `ServiceSubItem` | 961 / 1053 | Строка аккордеона / подпункт |
| `subscribeToOpenDays()` / `useSyncExternalStore` | 1121 / 1194 | Живые часы «работает сегодня» |

**Состояние в `Home`:** `language, menuOpen, openService, extrasOpen(false), submitted,
selectedDate, aboutPhotoIndex, certificateIndex` + refs `aboutSwipeStart /
certificateSwipeStart`. `timeSlots = selectedDate ? availableSlots(selectedDate) : TIME_SLOTS` (1199).

**Цепочки вызовов:**
- **Карусель:** prev/next/swipe → `showAboutPhoto(i±1)` [1167] → `setAboutPhotoIndex` →
  активный слайд пересчитывается от `aboutPhotoIndex` [1366–1372], счётчик `padStart`
  [1428/1434], текст `t.about.slides[aboutPhotoIndex]` [1440, `aria-live` добавлен коммитом `5059be6`].
- **Сертификаты:** тот же паттерн через `showCertificate` [1191] → `certificate` [1170];
  массив пуст → слайдер инертен, но заголовок всё равно рендерится [1470].
- **«Дополнительные услуги»:** `extrasOpen` [1140] переключает класс `service-more is-open`
  [1569] + `hidden={!extrasOpen}` [1593] + `aria-expanded` [1582]; по умолчанию `false` → свёрнуто.
- **Запись:** `handleSubmit` → `setSubmitted(true)` [1209]; форма имеет `name="date"`/`name="time"`,
  сети нет → только UI.
- **Журнал:** карточки рендерят `articles` [749]; каждая ссылка `href="#journal"` [1674/1693]
  → на сам раздел (пути к статьям нет) = dead-link.

### B. Impact по неpushнутым коммитам (`origin/master..HEAD`)

| Коммит | Subject | Файл | Риск | Затронутые тесты |
|---|---|---|---|---|
| `5059be6` | fix: announce About carousel slide changes to screen readers | `app/page.tsx` (+1/−1, стр. 1439) | **Низкий** (a11y-only, добавлен атрибут) | Ни один из 3 тестов не проверяет `aria-live` → проходят без изменений. **Пробел:** добавить тест, что `.about-slide-text` несёт `aria-live`. |
| `6402fe1` | chore: remove unused Geist font imports | `app/layout.tsx` (−импорт, −2 константы, `body`→`antialiased`) | **Низкий–Средний** (поведенчески нейтрально, т.к. CSS не потребляет `--font-geist-*` — проверено; обратимо, если Geist был задуман) | Ни один тест не ссылается на geist/шрифт body → проходят. Тест #1 проверяет только `<html lang="ru">`/`<title>`. |

**Связанные тесты (`tests/rendered-html.test.mjs`), что охраняют:**
1. `server-renders the bilingual ROOT / RITUAL site` → `<html lang="ru">`, `<title>OZ SPA`,
   `class="language-switch"`, `>RU<`/`>EN<`, `id="services|gallery|journal|booking"`,
   `class="booking-form"`, `id="service-01"`, `class="service-subitems"`, `service-subitem-head`.
2. `keeps core client interactions wired` (regex по `page.tsx`+`globals.css`): `type Language`,
   `setLanguage("ru"|"en")`, `setMenuOpen`, `setOpenService`, `aboutPhotos`, `setAboutPhotoIndex`,
   `Мои дипломы и сертификаты`, `setCertificateIndex`, `aria-expanded`, `event.preventDefault()`,
   `name="date"`, `name="time"`, `floating-note-bottom`, `href={"#service-`, `setOpenService(services[0].number)`,
   `function ServiceSubItem`, `.service-subitems`, `extraServices.map`, `Выбрать время и дату`;
   в `globals.css`: `@media (max-width: 650px)` + `@import ".../opendesign/root-ritual/tokens.css"`.
3. `ships a complete OpenDesign design-system package` → `manifest.json` + ~50 токенов.

**Поверхность регрессий для будущих изменений:** любой правки, затрагивающая
`aboutPhotos`, `setAboutPhotoIndex`, `Мои дипломы и сертификаты`, `setCertificateIndex`,
`aria-expanded`, `extraServices`, `name="date"/time`, `service-subitems`, `type Language`,
переключение языка, import/globals.css или мобильный брейкпоинт, «споткнётся» о тест #2.
Оба новых коммита ни один охраняемый токен ни не добавляют, ни не удаляют → оба зелёные.

### C. Инвентарь «мёртвых точек / плейсхолдеров» (не блокирует, но — перед продом)

| Пункт | Где | Состояние | Действие |
|---|---|---|---|
| `about-08.jpg` ≡ `about-03.jpg` | md5 `c553f1c1…` (273 KB) | дубликат | заменить на реальный слайд 8 |
| `about-09.jpg` ≡ `about-06.jpg` | md5 `e4a74205…` (192 KB) | дубликат | заменить на реальный слайд 9 |
| Тяжёлые PNG | `about-01.png` 1.88 MB, `about-02.png` 2.17 MB, `hero-hair.png` 1.0 MB | вес | `next/image` / сжатие |
| `certificates = []` | `page.tsx:913` | пусто | заполнить или спрятать слайдер |
| Ссылки Журнала → `#journal` | `page.tsx:1674,1693` | self/dead | добавить роут статьи или убрать ссылки |
| Instagram-плейсхолдер | `page.tsx:1629` (strip) + `:1825` (footer) | плейсхолдер | вставить реальный профиль |
| Форма записи `onSubmit` | `page.tsx:1209/1723` | только UI | подключить реальный приём заявок |
| Удалён импорт Geist | `app/layout.tsx` | разрешено `6402fe1` | оставить удалённым (или вернуть, если задуман) |
| `@next/next/no-img-element` ×6 | `page.tsx:1216,1307,1403,1483,1651,1819` | warnings | перейти на `next/image` |

> **Вывод по рискам:** оба неpushнутых коммита — низко-рисковые, тесты зелёные
> (`npm test` 3/3, `npm run lint` 0 ошибок, 6 известных warnings). Основное влияние
> будущих правок сосредоточено в одном файле `app/page.tsx`; тест #2 — главный
> «барьер» и покрывает почти все клиентские интеракции.

### Canvas — сгенерированные варианты (Superdesign)
- **V1 · Production-ready polish** — доводка до прод-состояния без смены языка:
  https://p.superdesign.dev/draft/bcf214b6-9bf2-4869-b7dd-c444fb087356
  (7 credits · draft `bcf214b6`)
- **V2 · Bolder editorial direction** — альтернативная, более выразительная редакция
  в той же дизайн-системе:
  https://p.superdesign.dev/draft/5de2ce08-76ed-4f55-8405-ce19ddd2afb0
  (6 credits · draft `5de2ce08`)
- Канва проекта:
  https://superdesign.dev/teams/6a493359-ac8b-4904-ae21-ce761e8d2c87/projects/7581a039-1f2c-428b-97e1-054f1e93fd05
