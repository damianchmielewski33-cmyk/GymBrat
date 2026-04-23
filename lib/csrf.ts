import { randomBytes, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { CSRF_COOKIE_NAME } from "@/lib/csrf-constants";

export { CSRF_COOKIE_NAME };

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

function allowedOrigins(): Set<string> {
  const out = new Set<string>();
  const add = (raw?: string | null) => {
    const t = raw?.trim();
    if (!t) return;
    try {
      out.add(new URL(t).origin);
    } catch {
      /* ignore */
    }
  };
  add(process.env.NEXTAUTH_URL);
  add(process.env.NEXT_PUBLIC_APP_URL);
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) add(`https://${vercel}`);
  const extra = process.env.CSRF_ALLOWED_ORIGINS?.split(",") ?? [];
  for (const x of extra) add(x.trim());
  if (out.size === 0 && process.env.NODE_ENV !== "production") {
    add("http://localhost:3000");
    add("http://127.0.0.1:3000");
  }
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
  if (origin && !isAllowedRequestOrigin(origin)) {
    return NextResponse.json({ error: "Niedozwolone Origin" }, { status: 403 });
  }

  const cookieTok = parseCookieHeader(req.headers.get("cookie"), CSRF_COOKIE_NAME);
  const headerTok =
    req.headers.get("x-xsrf-token") ??
    req.headers.get("x-csrf-token") ??
    "";

  if (!cookieTok || !headerTok || !timingSafeEqStrings(cookieTok, headerTok)) {
    return NextResponse.json({ error: "CSRF" }, { status: 403 });
  }

  return null;
}

/**
 * Publiczny endpoint analytics — bez sesji; wymuszamy sensowny Origin / Sec-Fetch-Site.
 */
export function assertAnalyticsOrigin(req: Request): NextResponse | null {
  const origin = req.headers.get("origin");
  if (origin && !isAllowedRequestOrigin(origin)) {
    return NextResponse.json({ error: "Niedozwolone Origin" }, { status: 403 });
  }
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite && !["same-origin", "same-site"].includes(secFetchSite)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export function newCsrfToken(): string {
  return randomBytes(32).toString("hex");
}
