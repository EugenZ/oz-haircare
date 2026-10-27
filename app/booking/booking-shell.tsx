import type { ReactNode } from "react";
import { SiteBrand } from "@/app/site-brand";

// Shared frame for the booking pages (Olga's manage page and the client's
// booking status page): logo + a single card.
export function BookingShell({ children }: { children: ReactNode }) {
  return (
    <main className="booking-page">
      <header className="booking-page-header">
        <SiteBrand href="/" ariaLabel="OZ SPA" />
      </header>
      <section className="booking-card">{children}</section>
    </main>
  );
}

export function BookingNotice({ tone, children }: { tone: "ok" | "error"; children: ReactNode }) {
  return (
    <p className={"booking-notice" + (tone === "error" ? " is-error" : "")} role="status">
      {children}
    </p>
  );
}

export function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
