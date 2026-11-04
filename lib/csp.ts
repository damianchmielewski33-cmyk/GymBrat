/**
 * Content-Security-Policy (Z29/Z56). Budowana per żądanie w `proxy.ts` (nonce dla skryptów).
 *
 * - `CSP_MODE=enforce` → pełna polityka jako `Content-Security-Policy`; domyślnie (`report-only`)
 *   pełna polityka idzie jako `Content-Security-Policy-Report-Only`, a egzekwowane jest tylko
 *   `frame-ancestors` (w Report-Only ta dyrektywa jest ignorowana).
 * - `frame-ancestors` (Z56): jawna lista originów — `FRAME_ANCESTORS_ALLOWED` (po przecinku),
 *   domyślnie origin AWP (DK-5: iframe zostaje); wartość `none` blokuje osadzanie całkowicie.
 * - Poza produkcją wysyłamy tylko `frame-ancestors` (HMR i devtools wymagają `eval`).
 */

export type CspMode = "report-only" | "enforce";
type Env = Record<string, string | undefined>;

/** Origin Akademii — AWP osadza GymBrat w iframe na /gymbrat. */
export const DEFAULT_AWP_ORIGIN = "https://akademia-wielkich-pilkarzy.vercel.app";
export const CSP_REPORT_PATH = "/api/security/csp-report";
export const CSP_REPORT_GROUP = "csp-endpoint";

export function cspMode(env: Env = process.env): CspMode {
  return env.CSP_MODE?.trim().toLowerCase() === "enforce" ? "enforce" : "report-only";
}

function safeOrigin(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : null;
  } catch {
    return null;
  }
}

/** Wartość dyrektywy `frame-ancestors`. */
export function frameAncestors(env: Env = process.env): string {
  const raw = env.FRAME_ANCESTORS_ALLOWED?.trim();
  if (raw?.toLowerCase() === "none") return "'none'";
  const listed = (raw ?? "")
    .split(",")
    .map((s) => safeOrigin(s))
    .filter((o): o is string => Boolean(o));
  const origins = listed.length > 0 ? listed : [safeOrigin(env.NEXT_PUBLIC_AWP_URL) ?? DEFAULT_AWP_ORIGIN];
  return `'self' ${[...new Set(origins)].join(" ")}`;
}

export function createNonce(): string {
  return btoa(crypto.randomUUID());
}

function connectSources(env: Env): string[] {
  const out = ["'self'"];
  // Sentry (przeglądarka) — origin z DSN; PostHog tylko gdy klucz publiczny jest ustawiony.
  const sentry = safeOrigin(env.NEXT_PUBLIC_SENTRY_DSN ?? env.SENTRY_DSN);
  if (sentry) out.push(sentry);
  if (env.NEXT_PUBLIC_POSTHOG_KEY?.trim()) {
    out.push(safeOrigin(env.NEXT_PUBLIC_POSTHOG_HOST) ?? "https://eu.i.posthog.com");
  }
  return out;
}

export type CspHeaders = {
  /** Pełna polityka (do nagłówka żądania — Next odczytuje z niej nonce — i do odpowiedzi). */
  full: string;
  /** Minimalna polityka zawsze egzekwowana: tylko `frame-ancestors`. */
  frameOnly: string;
  mode: CspMode;
  /** Czy wysyłać pełną politykę (tylko produkcja). */
  sendFull: boolean;
};

export function buildCsp(opts: { nonce: string; env?: Env; isProd?: boolean }): CspHeaders {
  const env = opts.env ?? process.env;
  const isProd = opts.isProd ?? env.NODE_ENV === "production";
  const fa = frameAncestors(env);
  const full = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `frame-ancestors ${fa}`,
    // OAuth: po formularzu serwer przekierowuje do dostawcy logowania.
    "form-action 'self' https://accounts.google.com https://www.facebook.com https://facebook.com",
    `script-src 'self' 'nonce-${opts.nonce}' 'strict-dynamic'`,
    // Next/Tailwind wymagają inline styles.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://image.pollinations.ai https://gen.pollinations.ai https://images.unsplash.com https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com",
    "font-src 'self' data:",
    `connect-src ${connectSources(env).join(" ")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self' blob: data:",
    `report-uri ${CSP_REPORT_PATH}`,
    `report-to ${CSP_REPORT_GROUP}`,
  ].join("; ");
  return { full, frameOnly: `frame-ancestors ${fa}`, mode: cspMode(env), sendFull: isProd };
}

/** Ustawia nagłówki CSP odpowiedzi (nie ruszając reszty nagłówków). */
export function applyCspHeaders(headers: Headers, csp: CspHeaders): void {
  if (csp.sendFull && csp.mode === "enforce") {
    headers.set("Content-Security-Policy", csp.full);
    headers.delete("Content-Security-Policy-Report-Only");
    return;
  }
  headers.set("Content-Security-Policy", csp.frameOnly);
  if (csp.sendFull) headers.set("Content-Security-Policy-Report-Only", csp.full);
}
