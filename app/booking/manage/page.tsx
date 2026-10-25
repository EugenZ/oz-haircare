// /booking/manage?id=…&t=… — Olga's page for one booking request (linked from
// the "new request" email). Rendering never changes anything (email scanners
// prefetch links); Confirm / Decline / Propose are separate form POSTs.
import type { Metadata } from "next";
import type { Booking, BookingStatus } from "@/db/schema";
import {
  bookingContext,
  findBookingByToken,
  proposalExpired,
  slotAvailability,
} from "@/lib/bookings";
import { formatSlot } from "@/lib/messages";
import { TIME_SLOTS } from "@/lib/slots";
import { slotStartsInPast, todayInPracticeZone } from "@/lib/time";
import { BookingNotice, BookingShell, firstParam } from "../booking-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Заявка · OZ SPA",
  robots: { index: false, follow: false },
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Ожидает подтверждения",
  proposed: "Предложено другое время — ждём ответа клиента",
  confirmed: "Подтверждена",
  declined: "Отклонена",
  cancelled: "Клиент отказался от предложенного времени",
};

const DONE: Record<string, string> = {
  confirmed: "Запись подтверждена: событие добавлено в календарь, клиент уведомлён.",
  declined: "Заявка отклонена, клиент уведомлён.",
  proposed: "Предложение отправлено клиенту.",
};

const ERRORS: Record<string, string> = {
  slot_taken: "Это время уже занято — предложите клиенту другое время или отклоните заявку.",
  invalid_state: "Заявка уже обработана.",
  invalid_input: "Проверьте дату и время: они должны отличаться от исходных.",
  past: "Это время уже прошло.",
  expired: "Срок предложения истёк.",
  calendar_failed: "Не удалось создать событие в Google Calendar. Попробуйте ещё раз.",
  unavailable: "База данных недоступна. Попробуйте позже.",
  not_found: "Заявка не найдена.",
};

function contactHref(row: Booking): string | null {
  if (row.contactType === "phone" && row.contactNormalized) return `tel:${row.contactNormalized}`;
  if (row.contactType === "instagram" && row.contactNormalized) {
    return `https://www.instagram.com/${row.contactNormalized}`;
  }
  return null;
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ManageBookingPage({ searchParams }: Props) {
  const params = await searchParams;
  const id = Number(firstParam(params.id));
  const token = firstParam(params.t);
  const done = firstParam(params.done);
  const error = firstParam(params.error);

  let row: Booking | null = null;
  let unavailable = false;
  try {
    row = await findBookingByToken(id, token, "manage");
  } catch {
    unavailable = true;
  }

  if (!row) {
    return (
      <BookingShell>
        <p className="eyebrow">Заявка</p>
        <h1>Не найдена.</h1>
        <p>
          {unavailable
            ? "База данных недоступна. Попробуйте позже."
            : "Заявка не найдена или ссылка неверна."}
        </p>
      </BookingShell>
    );
  }

  const ctx = bookingContext();
  const past = slotStartsInPast(row.date, row.time);
  const taken =
    row.status === "pending" && !past
      ? (await slotAvailability(row.date, row.time, ctx, row.id)).taken
      : false;
  const canConfirm = row.status === "pending" && !past && !taken;
  const actionable = row.status === "pending" || row.status === "proposed";
  const href = contactHref(row);
  const hidden = <input type="hidden" name="token" value={token} />;

  return (
    <BookingShell>
      <p className="eyebrow">Заявка #{row.id}</p>
      <h1>{row.name}</h1>
      {done && DONE[done] ? <BookingNotice tone="ok">{DONE[done]}</BookingNotice> : null}
      {error ? (
        <BookingNotice tone="error">{ERRORS[error] ?? ERRORS.unavailable}</BookingNotice>
      ) : null}

      <dl className="booking-facts">
        <dt>Статус</dt>
        <dd>{STATUS_LABEL[row.status] ?? row.status}</dd>
        <dt>Время</dt>
        <dd>{formatSlot(row.date, row.time, "ru")}</dd>
        {row.status === "proposed" && row.proposedDate && row.proposedTime ? (
          <>
            <dt>Предложено</dt>
            <dd>
              {formatSlot(row.proposedDate, row.proposedTime, "ru")}
              {proposalExpired(row, ctx.proposalTtlHours) ? " · срок ответа истёк" : ""}
            </dd>
          </>
        ) : null}
        <dt>{row.contactType === "instagram" ? "Instagram" : "Телефон"}</dt>
        <dd>
          {href ? (
            <a href={href} target="_blank" rel="noreferrer">
              {row.contact}
            </a>
          ) : (
            row.contact
          )}
        </dd>
        {row.email ? (
          <>
            <dt>Email</dt>
            <dd>{row.email}</dd>
          </>
        ) : null}
        <dt>Услуга</dt>
        <dd>{row.service || "—"}</dd>
        {row.message ? (
          <>
            <dt>Сообщение</dt>
            <dd>{row.message}</dd>
          </>
        ) : null}
        <dt>Язык</dt>
        <dd>{row.language === "en" ? "English" : "Русский"}</dd>
      </dl>

      {actionable ? (
        <>
          {row.status === "pending" && taken ? (
            <BookingNotice tone="error">
              Это время уже занято. Подтвердить нельзя — предложите другое время или отклоните.
            </BookingNotice>
          ) : null}
          {row.status === "pending" && past ? (
            <BookingNotice tone="error">Это время уже прошло.</BookingNotice>
          ) : null}
          <div className="booking-actions">
            {row.status === "pending" ? (
              <form method="post" action={`/api/bookings/${row.id}/confirm`}>
                {hidden}
                <button className="button button-dark" type="submit" disabled={!canConfirm}>
                  Подтвердить <span>↗</span>
                </button>
              </form>
            ) : null}
            <form method="post" action={`/api/bookings/${row.id}/decline`}>
              {hidden}
              <button className="button button-outline" type="submit">
                Отклонить
              </button>
            </form>
          </div>

          <form
            className="booking-propose"
            method="post"
            action={`/api/bookings/${row.id}/propose`}
          >
            {hidden}
            <p className="eyebrow">Предложить другое время</p>
            <label>
              <span>Дата</span>
              <input
                type="date"
                name="date"
                required
                min={todayInPracticeZone()}
                defaultValue={row.proposedDate ?? row.date}
              />
            </label>
            <label>
              <span>Время</span>
              <select name="time" required defaultValue={row.proposedTime ?? ""}>
                <option value="" disabled>
                  Выберите время
                </option>
                {TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </label>
            <button className="button button-outline" type="submit">
              Предложить клиенту <span>↗</span>
            </button>
          </form>
        </>
      ) : null}

      {row.status === "confirmed" && row.calendarUrl ? (
        <p className="booking-links">
          <a className="text-link" href={row.calendarUrl} target="_blank" rel="noreferrer">
            Открыть в календаре <span>↗</span>
          </a>
        </p>
      ) : null}
    </BookingShell>
  );
}
