import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ROOT / RITUAL — trichology · восстановление волос",
  description: "Scalp care and hair restoration. Бережная работа с кожей головы и длиной волос.",
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "ROOT / RITUAL",
    title: "ROOT / RITUAL — trichology · восстановление волос",
    description: "Scalp care and hair restoration. Бережная работа с кожей головы и длиной волос.",
  },
  twitter: {
    card: "summary",
    title: "ROOT / RITUAL — trichology · восстановление волос",
    description: "Scalp care and hair restoration.",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
