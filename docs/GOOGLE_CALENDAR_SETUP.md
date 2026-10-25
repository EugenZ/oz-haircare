# Google Calendar + Gmail: настройка server-created события

Этот раздел объясняет, как включить **серверно создаваемое событие в Google
Calendar** для «Записи на встречу», а также отправку письма-подтверждения
клиенту и уведомления Ольге (`olilka.zhgirova@gmail.com`).

Код уже готов (`lib/google.ts`, `lib/email.ts`, `lib/bookings.ts`,
`app/api/bookings/**`). Нужно только получить OAuth-доступ и вписать 3 секрета
в `.env.local` (файл уже в gitignore, в репозиторий не попадает).

## Как это работает

1. Клиент отправляет заявку → `POST /api/bookings`. Заявка сохраняется в Neon
   со статусом `pending`, **событие в календаре пока не создаётся**.
2. Ольге (`BOOKING_NOTIFY_EMAIL`) приходит письмо со ссылкой
   `/booking/manage?id=…&t=…`. Клиенту (если оставил email) — «заявка получена».
3. На странице заявки Ольга выбирает: **Подтвердить**, **Отклонить** или
   **Предложить другое время** (формы `POST /api/bookings/:id/confirm|decline|propose`;
   сама страница по GET ничего не меняет — почтовые сканеры её открывают безопасно).
4. При подтверждении (или когда клиент принимает предложенное время на
   `/booking/view`) сервер меняет refresh token на access token и создаёт событие
   `POST https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events`
   с детерминированным `id` (повтор не создаст дубль).
5. Клиент получает письмо «Запись подтверждена» с вложением `.ics` и ссылками
   Google Calendar / Apple Calendar (`/api/bookings/:id/ics`), а SMS / Instagram
   ставится в очередь для Apple Shortcuts («Команды» на iPhone Ольги): SMS
   уходит автоматически, Instagram — в одно касание (см. `docs/IPHONE_SHORTCUTS.md`).
6. По умолчанию клиент **не** добавляется в `attendees`. С
   `GOOGLE_INVITE_ATTENDEE=true` он добавляется, и Google сам шлёт ему
   приглашение (`sendUpdates=all`) — тогда у клиента будет два приглашения.
7. Если Google НЕ настроен — подтверждение всё равно работает, просто без
   события в календаре Ольги; клиент получает ссылку «Добавить в календарь» + `.ics`.

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
| `GOOGLE_INVITE_ATTENDEE` | добавлять клиента в attendees | нет (default `false`) |
| `BOOKING_NOTIFY_EMAIL` | ящик meeting (Ольга) | для уведомления |
| `EMAIL_API_URL` / `EMAIL_API_KEY` / `EMAIL_FROM` | REST-отправщик писем (Resend) | для писем |
| `SITE_URL` | базовый адрес для ссылок в письмах / SMS | да, в проде |

Без Google-секретов форма всё равно работает: заявка ждёт подтверждения, а
клиенту после подтверждения отдаётся ссылка «Добавить в календарь» + `.ics`.

## Защита от повторной записи (double-booking)

Слот считается занятым, если в календаре Ольги (`GOOGLE_CALENDAR_ID`, по
умолчанию `primary`) есть событие **или** в базе есть подтверждённая
(`confirmed`) запись на это время. Заявки `pending` / `proposed` слот **не**
блокируют: на одно время может прийти несколько заявок. Когда одна из них
подтверждена, на странице остальных кнопка «Подтвердить» неактивна и показано
«время уже занято» — можно предложить другое время или отклонить. Частичный
уникальный индекс `bookings_confirmed_slot_idx` не даёт подтвердить два
бронирования на один слот даже при гонке.

1. **Форма.** При выборе даты клиентский запрос идёт на
   `GET /api/bookings/availability?date=YYYY-MM-DD&slots=10:00,11:00,…`.
   Сервер вызывает `events.list` календаря (см. `lib/google.ts` →
   `fetchBusySlotsForDay`) и возвращает занятые слоты; форма блокирует их
   (`disabled`) и подписывает «занято» / «busy». Показ занятых слотов не влияет
   на `alt`/доступность формы.
2. **Серверная защита.** `POST /api/bookings` перед сохранением снова
   проверяет слот (календарь + подтверждённые записи). Если время уже занято —
   ответ `409` с сообщением «Это время уже занято…». Та же проверка
   повторяется при подтверждении, предложении и принятии предложения.
3. **Fail-open.** Если Google не настроен или `events.list` временно не отвечает,
   форма показывает все слоты (не блокирует запись), а сервер пропускает заявку
   с предупреждением в логе.

Никаких новых переменных окружения не требуется — используются те же
`GOOGLE_OAUTH_*` / `GOOGLE_CALENDAR_ID`.
