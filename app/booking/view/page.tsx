// /booking/view?id=…&v=… — the client's booking page (linked from emails and
// SMS / Instagram messages). Shows the status; for a proposal it offers Accept
// / Decline as form POSTs, and for a confirmed visit the calendar links.
import type { Metadata } from "next";
import Link from "next/link";
import type { Booking } from "@/db/schema";
import {
  bookingContext,
  findBookingByToken,
  icsUrl,
  proposalExpired,
  toPayload,
} from "@/lib/bookings";
import { buildInviteFromPayload } from "@/lib/email";
import { formatSlot, LOCATION, pickLanguage, viewCopy } from "@/lib/messages";
import { BookingNotice, BookingShell, firstParam } from "../booking-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Запись · OZ SPA",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ViewBookingPage({ searchParams }: Props) {
  const params = await searchParams;
  const id = Number(firstParam(params.id));
  const token = firstParam(params.v);
  const done = firstParam(params.done);
  const error = firstParam(params.error);

  let row: Booking | null = null;
  let unavailable = false;
  try {
    row = await findBookingByToken(id, token, "view");
  } catch {
    unavailable = true;
  }

  if (!row) {
    const text = unavailable ? viewCopy.unavailable : viewCopy.notFound;
    return (
      <BookingShell>
        <p className="eyebrow">OZ SPA</p>
        <h1>
          {viewCopy.title.ru} / {viewCopy.title.en}
        </h1>
        <p>{text.ru}</p>
        <p>{text.en}</p>
      </BookingShell>
    );
  }

  const lang = pickLanguage(row.language);
  const ctx = bookingContext();
  const payload = toPayload(row);
  const expired = proposalExpired(row, ctx.proposalTtlHours);
  const doneText =
    done === "accepted" ? viewCopy.doneAccepted[lang] : done ? viewCopy.doneDeclined[lang] : "";
  const errorText = error
    ? error === "slot_taken"
      ? viewCopy.errorSlotTaken[lang]
      : error === "expired"
        ? viewCopy.proposalExpired[lang]
        : viewCopy.errorGeneric[lang]
    : "";

  return (
    <BookingShell>
      <p className="eyebrow">OZ SPA</p>
      <h1>{viewCopy.title[lang]}</h1>
      {doneText ? <BookingNotice tone="ok">{doneText}</BookingNotice> : null}
      {errorText ? <BookingNotice tone="error">{errorText}</BookingNotice> : null}

      <dl className="booking-facts">
        <dt>{viewCopy.service[lang]}</dt>
        <dd>{row.service || "—"}</dd>
        <dt>{row.status === "proposed" ? viewCopy.requested[lang] : viewCopy.when[lang]}</dt>
        <dd>{formatSlot(row.date, row.time, lang)}</dd>
        <dt>{viewCopy.where[lang]}</dt>
        <dd>{LOCATION[lang]}</dd>
      </dl>

      {row.status === "pending" ? <p>{viewCopy.pending[lang]}</p> : null}

      {row.status === "proposed" && row.proposedDate && row.proposedTime ? (
        <>
          <p>{viewCopy.proposedLead[lang]}</p>
          <p className="booking-slot">{formatSlot(row.proposedDate, row.proposedTime, lang)}</p>
          {expired ? (
            <p>{viewCopy.proposalExpired[lang]}</p>
          ) : (
            <form
              className="booking-actions"
              method="post"
              action={`/api/bookings/${row.id}/respond`}
            >
              <input type="hidden" name="token" value={token} />
              <button className="button button-dark" type="submit" name="decision" value="accept">
                {viewCopy.accept[lang]} <span>↗</span>
              </button>
              <button className="button button-outline" type="submit" name="decision" value="decline">
                {viewCopy.decline[lang]}
              </button>
            </form>
          )}
        </>
      ) : null}

      {row.status === "confirmed" ? (
        <>
          <p className="booking-slot">{viewCopy.confirmed[lang]}</p>
          <div className="booking-actions">
            <a
              className="button button-dark"
              href={buildInviteFromPayload(payload).calendarUrl}
              target="_blank"
              rel="noreferrer"
            >
              {viewCopy.addGoogle[lang]} <span>↗</span>
            </a>
            <a className="button button-outline" href={icsUrl(ctx, row.id, token)}>
              {viewCopy.addApple[lang]}
            </a>
          </div>
        </>
      ) : null}

      {row.status === "declined" || row.status === "cancelled" ? (
        <>
          <p>{row.status === "declined" ? viewCopy.declined[lang] : viewCopy.cancelled[lang]}</p>
          <p className="booking-links">
            <Link className="text-link" href="/#booking">
              {viewCopy.bookAgain[lang]} <span>↗</span>
            </Link>
          </p>
        </>
      ) : null}
    </BookingShell>
  );
}
