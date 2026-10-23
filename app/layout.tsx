import type { Metadata, Viewport } from "next";
import { PwaRegister } from "./pwa-register";
import "./globals.css";

// Next 16 keeps themeColor in the viewport export (not in metadata).
export const viewport: Viewport = {
  themeColor: "#c66d4e",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "OZ SPA — trichology · восстановление волос",
  description: "Scalp care and hair restoration. Бережная работа с кожей головы и длиной волос.",
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "OZ SPA",
    title: "OZ SPA — trichology · восстановление волос",
    description: "Scalp care and hair restoration. Бережная работа с кожей головы и длиной волос.",
  },
  twitter: {
    card: "summary",
    title: "OZ SPA — trichology · восстановление волос",
    description: "Scalp care and hair restoration.",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">{children}<PwaRegister /></body>
    </html>
  );
}
