"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker at /sw.js on the client.
 * Safe no-op on insecure origins (non-localhost/non-HTTPS) or when SW is unsupported.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Ignore: registration can fail on insecure origins or first load.
      });
    }
  }, []);

  return null;
}
