# Google Calendar + Gmail: настройка server-created события

Этот раздел объясняет, как включить **серверно создаваемое событие в Google
Calendar** для «Записи на встречу», а также отправку письма-подтверждения
клиенту и уведомления Ольге (`olilka.zhgirova@gmail.com`).

Код уже готов (`lib/google.ts`, `lib/email.ts`, `app/api/bookings/route.ts`).
Нужно только получить OAuth-доступ и вписать 3 секрета в `.env.local`
(файл уже в gitignore, в репозиторий не попадает).

## Как это работает

1. Клиент отправляет заявку → `POST /api/bookings`.
2. Если заданы `GOOGLE_OAUTH_CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN`,
   сервер меняет refresh token на access token и создаёт событие
   `POST https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events`.
3. Клиент добавляется в `attendees` → **Google сам шлёт ему письмо-приглашение**
   в календарь (это и есть «invite пользователю»).
4. Параллельно (если задан `EMAIL_API_URL`) на ящик meeting
   (`BOOKING_NOTIFY_EMAIL`) и клиенту уходит HTML-подтверждение со ссылкой
   на созданное событие.
5. Если Google НЕ настроен — всё деградирует gracefully: клиент получает
   ссылку «Добавить в календарь» (Google Calendar render link) + `.ics`.

## Что нужно сделать в Google Cloud

1. **Проект.** https://console.cloud.google.com → «New project».
2. **API.** APIs & Services → Library → включить:
   - `Google Calendar API` (обязательно для события).
   - `Gmail API` (только если отправлять письма через Gmail API; см. ниже —
     по умолчанию письма идут через REST-отправщик, Gmail API не обязателен).
3. **Consent screen.** APIs & Services → OAuth consent screen.
   - User type: `External` (для личного `@gmail.com`).
   - Add `olilka.zhgirova@gmail.com` в «Test users» (пока статус = Test).
4. **Credentials → Create credentials → OAuth client → Web application.**
   - Authorized JavaScript origins:
     - `https://ВАШ_САЙТ` (публичный домен)
     - `http://localhost:3000` (для локальной разработки)
   - Сохраните `Client ID` и `Client secret`.
5. **Refresh token (разово).** Самый простой способ — OAuth 2.0 Playground:
   https://developers.google.com/oauthplayground
   - «Use your own OClints» → вставить `Client ID`.
   - Scope: `https://www.googleapis.com/auth/calendar`
     (добавить `https://www.googleapis.com/auth/gmail.send` — только если
      будете писать письма через Gmail API).
   - «Authorize credentials» → «Exchange code for tokens».
   - **Поставьте галочку «Include a refresh token in the response»** и
     скопируйте `refresh_token` (он длинный, начинается на `1//…`).
   - Refresh token живёт долго (не истекает), им и работаем на сервере.
6. **Записать секреты в `.env.local`** (уже есть заготовки):
   ```
   GOOGLE_OAUTH_CLIENT_ID=…
   GOOGLE_OAUTH_CLIENT_SECRET=…
   GOOGLE_OAUTH_REFRESH_TOKEN=1//…
   GOOGLE_CALENDAR_ID=primary
   ```
   `GOOGLE_CALENDAR_ID` — `primary` (личный календарь) или конкретный id
   календаря (виден в ссылке календаря: `…/calendar/embed?src=ID` или
   через Calendar API `calendars.get`).

## Важные оговорки (личный @gmail.com)

- **Нет domain-wide delegation.** Для личного `@gmail.com` работает ТОЛЬКО
  user refresh token (как выше) — сервисного аккаунта недостаточно.
- **Gmail API = sensitive access.** Если отправлять письма через Gmail API,
  проект нужно вести к «Production» (Google verification / OAuth consent
  verification), иначе письма уходят только к test users. Для письма Ольге
  и клиенту проще и быстрее использовать REST-отправщик (`EMAIL_API_URL`,
  например Resend) — Gmail API тогда не нужен.
- **События в календаре** не требуют этой верификации — `calendar` scope
  достаточно, события создаются сразу.

## Переменные окружения (кратко)

| Переменная | Зачем | Обязательна |
|---|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth client | для события |
| `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth client | для события |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | доступ от имени аккаунта | для события |
| `GOOGLE_CALENDAR_ID` | куда создавать (`primary`) | нет (default `primary`) |
| `BOOKING_NOTIFY_EMAIL` | ящик meeting (Ольга) | для уведомления |
| `EMAIL_API_URL` / `EMAIL_API_KEY` / `EMAIL_FROM` | REST-отправщик писем | для писем |
| `SITE_URL` | ссылка на сайт в письме | нет |

Без Google-секретов форма всё равно работает: клиенту отдаётся ссылка
«Добавить в календарь» + `.ics`.

## Защита от повторной записи (double-booking)

Когда OAuth настроен, календарь Ольги (`GOOGLE_CALENDAR_ID`, по умолчанию
`primary`) становится источником правды о занятости:

1. **Форма.** При выборе даты клиентский запрос идёт на
   `GET /api/bookings/availability?date=YYYY-MM-DD&slots=10:00,11:00,…`.
   Сервер вызывает `events.list` календаря (см. `lib/google.ts` →
   `fetchBusySlotsForDay`) и возвращает занятые слоты; форма блокирует их
   (`disabled`) и подписывает «занято» / «busy». Показ занятых слотов не влияет
   на `alt`/доступность формы.
2. **Серверная защита.** `POST /api/bookings` перед сохранением и созданием
   события снова проверяет выбранный слот через тот же `events.list`. Если время
   уже занято — ответ `409` с сообщением «Это время уже занято…» и событие не
   создаётся.
3. **Fail-open.** Если Google не настроен или `events.list` временно не отвечает,
   форма показывает все слоты (не блокирует запись), а сервер пропускает заявку
   с предупреждением в логе.

Никаких новых переменных окружения не требуется — используются те же
`GOOGLE_OAUTH_*` / `GOOGLE_CALENDAR_ID`.
