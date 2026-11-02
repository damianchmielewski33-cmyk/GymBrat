/**
 * Trasy `/api/**`, które `proxy.ts` przepuszcza BEZ sesji NextAuth.
 * Każda z nich musi sama się uwierzytelniać (sekret, podpis) albo być z założenia publiczna.
 * Lista jest jedynym źródłem dla `proxy.ts` i testu `proxy-public-api.test.ts`
 * (nowa trasa publiczna wymaga dopisku tutaj i w teście).
 */

/** Prefiksy (z końcowym `/`) lub dokładne ścieżki. */
const PUBLIC_API_PREFIXES = [
  /** Anonimowe zliczanie wejść — bez JWT (por. tracker klienta). */
  "/api/analytics/",
  /** Aktualizacje APK: natywna aplikacja Android nie ma sesji NextAuth. */
  "/api/android/",
  /** Crony (Vercel Cron, GitHub Actions, systemd): każda trasa sprawdza `CRON_SECRET`. */
  "/api/cron/",
  /** Trwałe grafiki katalogu (wygenerowane przy imporcie) — publiczne dla <img>. */
  "/api/catalog-meal-image/",
] as const;

const PUBLIC_API_EXACT = new Set([
  /** Branding / PWA ikony — publiczne (login, favicon, WebView bez sesji). */
  "/api/branding",
  /** Publiczny provenance wdrożenia. */
  "/api/version",
  /** Token CSRF (double-submit) — publiczny GET. */
  "/api/csrf",
  /** CSP raporty (Report-Only) — publiczny POST z przeglądarki. */
  "/api/security/csp-report",
  /** Błędy z przeglądarki → logi serwera; mogą wystąpić też na /login. */
  "/api/client-errors",
  /**
   * Webhook HotPay: wywołuje go serwer płatności, bez sesji. Trasa sama weryfikuje
   * skrót SHA-256 powiadomienia (`verifyHotpayNotificationHash`) i kwotę zamówienia.
   * Nie dodawać do `ANONYMOUS_PUBLIC_PATHS` (to ścieżki stron, nie API).
   */
  "/api/payments/hotpay/notify",
]);

export function isProxyPublicApiPath(pathname: string): boolean {
  if (PUBLIC_API_EXACT.has(pathname)) return true;
  if (pathname.startsWith("/api/branding/")) return true;
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
