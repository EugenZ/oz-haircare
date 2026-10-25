// Client-facing booking copy shared by the server: SMS / Instagram message
// templates (delivered from Olga's iPhone via the outbox) and the public
// booking status page. Same `Localized` shape as the `copy` object in
// app/page.tsx.

export type Language = "ru" | "en";
export type Localized = { ru: string; en: string };

export const PRACTICE_NAME = "OZ SPA";
export const LOCATION: Localized = {
  ru: "Лос Анджелес · очно",
  en: "Los Angeles · in person",
};

export function pickLanguage(value: unknown): Language {
  return value === "en" ? "en" : "ru";
}

// "2026-11-02" + "10:00" -> "пн, 2 ноября, 10:00" / "Mon, 2 November, 10:00".
export function formatSlot(date: string, time: string, language: Language): string {
  const day = new Date(`${date}T00:00:00Z`).toLocaleDateString(
    language === "ru" ? "ru-RU" : "en-GB",
    { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" },
  );
  return `${day}, ${time}`;
}

export type ClientMessageKind = "confirmed" | "proposed" | "declined";

export type ClientMessageInput = {
  name: string;
  language: Language;
  slot: string; // formatted, e.g. formatSlot(...)
  previousSlot?: string; // the originally requested slot (proposals)
  url: string; // the client's booking page / site link
};

// Plain-text message for SMS / Instagram DM.
export function clientMessageText(
  kind: ClientMessageKind,
  input: ClientMessageInput,
): string {
  const { name, language, slot, previousSlot, url } = input;
  if (language === "en") {
    if (kind === "confirmed") {
      return `Hi ${name}! Olga (${PRACTICE_NAME}) confirmed your visit: ${slot}, ${LOCATION.en}. Details and add to calendar: ${url}`;
    }
    if (kind === "proposed") {
      return `Hi ${name}! Unfortunately ${previousSlot ?? "the requested time"} doesn't work. Olga (${PRACTICE_NAME}) suggests ${slot}. Please accept or decline here: ${url}`;
    }
    return `Hi ${name}! Unfortunately Olga (${PRACTICE_NAME}) can't see you at ${slot}. You're welcome to pick another time: ${url}`;
  }
  if (kind === "confirmed") {
    return `Здравствуйте, ${name}! Ольга (${PRACTICE_NAME}) подтвердила вашу запись: ${slot}, ${LOCATION.ru}. Детали и добавить в календарь: ${url}`;
  }
  if (kind === "proposed") {
    return `Здравствуйте, ${name}! К сожалению, ${previousSlot ?? "выбранное время"} не получится. Ольга (${PRACTICE_NAME}) предлагает ${slot}. Подтвердите или отклоните: ${url}`;
  }
  return `Здравствуйте, ${name}! К сожалению, Ольга (${PRACTICE_NAME}) не сможет принять вас ${slot}. Вы можете выбрать другое время: ${url}`;
}

// Public booking status page (/booking/view).
export const viewCopy = {
  title: { ru: "Ваша запись", en: "Your booking" },
  service: { ru: "Услуга", en: "Service" },
  when: { ru: "Когда", en: "When" },
  where: { ru: "Где", en: "Where" },
  notFound: {
    ru: "Запись не найдена или ссылка устарела.",
    en: "Booking not found or the link has expired.",
  },
  unavailable: {
    ru: "Сервис временно недоступен. Попробуйте позже.",
    en: "The service is temporarily unavailable. Please try again later.",
  },
  pending: {
    ru: "Заявка ожидает подтверждения Ольги.",
    en: "Your request is waiting for Olga's confirmation.",
  },
  proposedLead: {
    ru: "Выбранное время не получилось. Ольга предлагает другое:",
    en: "The requested time doesn't work. Olga suggests another one:",
  },
  requested: { ru: "Вы выбирали", en: "You requested" },
  accept: { ru: "Принять время", en: "Accept this time" },
  decline: { ru: "Отказаться", en: "Decline" },
  proposalExpired: {
    ru: "Срок ответа на предложение истёк — пожалуйста, оставьте новую заявку на сайте.",
    en: "This proposal has expired — please send a new request on the website.",
  },
  confirmed: { ru: "Запись подтверждена.", en: "Your visit is confirmed." },
  addGoogle: { ru: "Google Calendar", en: "Google Calendar" },
  addApple: { ru: "Apple Calendar (.ics)", en: "Apple Calendar (.ics)" },
  declined: {
    ru: "К сожалению, Ольга не сможет принять вас в это время.",
    en: "Unfortunately Olga can't see you at this time.",
  },
  cancelled: {
    ru: "Вы отказались от предложенного времени. Ольга получила ваш ответ.",
    en: "You declined the proposed time. Olga has been notified.",
  },
  bookAgain: { ru: "Выбрать другое время", en: "Choose another time" },
  doneAccepted: {
    ru: "Спасибо! Время подтверждено.",
    en: "Thank you! The time is confirmed.",
  },
  doneDeclined: { ru: "Ответ отправлен.", en: "Your answer has been sent." },
  errorSlotTaken: {
    ru: "Это время уже занято. Ольга свяжется с вами.",
    en: "This time has just been taken. Olga will get in touch.",
  },
  errorGeneric: {
    ru: "Не удалось выполнить действие. Попробуйте ещё раз.",
    en: "Something went wrong. Please try again.",
  },
} satisfies Record<string, Localized>;
