import { randomBytes, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { CSRF_COOKIE_NAME } from "@/lib/csrf-constants";

export { CSRF_COOKIE_NAME };

/** Kanoniczna produkcja GymBrat (Vercel). */
export const GYMBRAT_PRODUCTION_ORIGIN = "https://gym-brat.vercel.app";

/** AWP osadza GymBrat — analytics może mieć Origin z Akademii. */
export const DEFAULT_AWP_ORIGIN = "https://akademia-wielkich-pilkarzy.vercel.app";

const LOCAL_DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
] as const;

function parseCookieHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split("; ");
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq === -1) continue;
    const k = p.slice(0, eq);
    if (k === name) {
      return decodeURIComponent(p.slice(eq + 1));
    }
  }
  return null;
}

function addOrigin(out: Set<string>, raw?: string | null) {
  const t = raw?.trim();
  if (!t) return;
  try {
    out.add(new URL(t).origin);
  } catch {
    /* ignore */
  }
}

function awpOriginFromEnv(): string {
  const raw = process.env.NEXT_PUBLIC_AWP_URL?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      /* ignore */
    }
  }
  return DEFAULT_AWP_ORIGIN;
}

function allowedOrigins(): Set<string> {
  const out = new Set<string>();
  addOrigin(out, process.env.NEXTAUTH_URL);
  addOrigin(out, process.env.NEXT_PUBLIC_APP_URL);
  addOrigin(out, GYMBRAT_PRODUCTION_ORIGIN);
  /** Host bez schematu (typowe zmienne Vercel) → https://… */
  const addHost = (host?: string | null) => {
    const t = host?.trim();
    if (!t) return;
    addOrigin(out, t.includes("://") ? t : `https://${t}`);
  };
  addHost(process.env.VERCEL_URL);
  addHost(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  addHost(process.env.VERCEL_BRANCH_URL);
  const extra = process.env.CSRF_ALLOWED_ORIGINS?.split(",") ?? [];
  for (const x of extra) addOrigin(out, x.trim());
  if (process.env.NODE_ENV !== "production") {
    for (const o of LOCAL_DEV_ORIGINS) addOrigin(out, o);
  }
  return out;
}

/** Allowlista Origin dla publicznego analytics (same-site + osadzenie AWP). */
function analyticsAllowedOrigins(): Set<string> {
  const out = allowedOrigins();
  addOrigin(out, awpOriginFromEnv());
  addOrigin(out, DEFAULT_AWP_ORIGIN);
  for (const o of LOCAL_DEV_ORIGINS) addOrigin(out, o);
  const extra = process.env.ANALYTICS_ALLOWED_ORIGINS?.split(",") ?? [];
  for (const x of extra) addOrigin(out, x.trim());
  return out;
}

export function isAllowedRequestOrigin(origin: string | null): boolean {
  if (!origin || origin === "null") return true;
  const allowed = allowedOrigins();
  /** W produkcji bez allowlist ryzykowne jest przepuszczanie dowolnego Origin. */
  if (allowed.size === 0) return process.env.NODE_ENV !== "production";
  try {
    return allowed.has(new URL(origin).origin);
  } catch {
    return false;
  }
}

function isSameOriginRequest(req: Request, origin: string): boolean {
  try {
    return new URL(origin).origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}

function isAnalyticsAllowedOrigin(req: Request, origin: string): boolean {
  if (isSameOriginRequest(req, origin)) return true;
  try {
    return analyticsAllowedOrigins().has(new URL(origin).origin);
  } catch {
    return false;
  }
}

/** Soft-fail analytics: pusty 204 zamiast 403/500 (Android WebView potrafi pokazać body jako „stronę”). */
function analyticsSoftReject(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

function timingSafeEqStrings(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Ochrona CSRF (double-submit cookie + allowlista Origin).
 * Zwraca `NextResponse` z błędem albo `null`, gdy OK.
 */
export function assertCsrf(req: Request): NextResponse | null {
  const method = req.method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return null;

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      // Always allow same-origin requests, even if env allowlist is stale/misconfigured.
      const reqOrigin = new URL(req.url).origin;
      const gotOrigin = new URL(origin).origin;
      if (gotOrigin !== reqOrigin && !isAllowedRequestOrigin(origin)) {
        return NextResponse.json(
          {
            error:
              "Żądanie pochodzi z niedozwolonej witryny. Otwórz aplikację z adresu ustawionego w konfiguracji (np. produkcja lub localhost) i spróbuj ponownie.",
          },
          { status: 403 },
        );
      }
    } catch {
      if (!isAllowedRequestOrigin(origin)) {
        return NextResponse.json(
          {
            error:
              "Żądanie pochodzi z niedozwolonej witryny. Otwórz aplikację z adresu ustawionego w konfiguracji (np. produkcja lub localhost) i spróbuj ponownie.",
          },
          { status: 403 },
        );
      }
    }
  }

  const cookieTok = parseCookieHeader(req.headers.get("cookie"), CSRF_COOKIE_NAME);
  const headerTok =
    req.headers.get("x-xsrf-token") ??
    req.headers.get("x-csrf-token") ??
    "";

  if (!cookieTok || !headerTok || !timingSafeEqStrings(cookieTok, headerTok)) {
    return NextResponse.json(
      {
        error:
          "Sesja bezpieczeństwa wygasła lub okno było otwarte zbyt długo. Odśwież stronę i wykonaj czynność jeszcze raz.",
      },
      { status: 403 },
    );
  }

  return null;
}

/**
 * Publiczny endpoint analytics — bez sesji; Origin / Sec-Fetch-Site.
 * Przy odrzuceniu zwraca 204 (soft-fail), nie 403 — zepsuty WebView czasem
 * nawiguje główną ramkę na POST /api/analytics/* i pokazuje JSON jako błąd strony.
 */
export function assertAnalyticsOrigin(req: Request): NextResponse | null {
  const origin = req.headers.get("origin");
  if (origin && origin !== "null") {
    if (!isAnalyticsAllowedOrigin(req, origin)) {
      return analyticsSoftReject();
    }
    return null;
  }
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") {
    return analyticsSoftReject();
  }
  return null;
}

export function newCsrfToken(): string {
  return randomBytes(32).toString("hex");
}
