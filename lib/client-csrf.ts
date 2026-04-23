"use client";

import { CSRF_COOKIE_NAME } from "@/lib/csrf-constants";

function readXsrfFromDocumentCookie(): string {
  if (typeof document === "undefined") return "";
  const prefix = `${CSRF_COOKIE_NAME}=`;
  const parts = document.cookie.split("; ");
  for (const p of parts) {
    if (p.startsWith(prefix)) {
      return decodeURIComponent(p.slice(prefix.length));
    }
  }
  return "";
}

/** Nagłówki double-submit dla `fetch` (tylko w przeglądarce). */
export function getXsrfHeaders(): Record<string, string> {
  const v = readXsrfFromDocumentCookie();
  return v ? { "x-xsrf-token": v } : {};
}

/** Gwarantuje ustawiony cookie CSRF (GET /api/csrf). */
export async function ensureCsrfCookie(): Promise<void> {
  if (typeof document === "undefined") return;
  if (readXsrfFromDocumentCookie()) return;
  await fetch("/api/csrf", { credentials: "include" });
  if (!readXsrfFromDocumentCookie()) {
    await fetch("/api/csrf", { credentials: "include" });
  }
}
