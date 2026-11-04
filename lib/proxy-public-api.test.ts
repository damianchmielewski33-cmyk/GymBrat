import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isProxyPublicApiPath } from "@/lib/proxy-public-api";

/**
 * Z16: każda trasa `app/api/**\/route.ts` jest albo świadomie publiczna (jawna lista niżej,
 * zgodna z `lib/proxy-public-api.ts`), albo chroniona sesją w `proxy.ts`.
 * Nowa trasa wywoływana z zewnątrz (webhook) bez wpisu tutaj i w `proxy-public-api.ts` → test czerwony.
 */

/** Trasy bez sesji NextAuth. Każda sama się uwierzytelnia (sekret/podpis) albo jest z założenia publiczna. */
const EXPECTED_PUBLIC_ROUTES = new Set([
  "/api/analytics/page-view",
  "/api/android/download",
  "/api/android/version",
  "/api/branding",
  "/api/branding/asset/[slot]",
  "/api/branding/manifest",
  "/api/catalog-meal-image/[id]",
  "/api/client-errors",
  "/api/cron/cleanup",
  "/api/cron/package-expiry",
  "/api/cron/reminders",
  "/api/csrf",
  "/api/payments/hotpay/notify",
  "/api/security/csp-report",
  "/api/version",
]);

/** Wyłączone z `proxy.ts` przez `config.matcher` (`api/auth`, `api/android`) — nie przechodzą przez proxy. */
const MATCHER_EXCLUDED_PREFIXES = ["/api/auth/", "/api/android/"];

const API_ROOT = path.resolve(__dirname, "../app/api");

function collectRoutes(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      collectRoutes(full, out);
    } else if (name === "route.ts") {
      const rel = path.relative(API_ROOT, path.dirname(full)).split(path.sep).join("/");
      out.push(rel ? `/api/${rel}` : "/api");
    }
  }
  return out;
}

/** `/api/x/[id]/y` → `/api/x/sample/y` (dynamiczne segmenty). */
function concretePath(route: string): string {
  return route.replace(/\[\.\.\.[^\]]+\]|\[[^\]]+\]/g, "sample");
}

describe("trasy API vs proxy (publiczne tylko jawnie)", () => {
  const routes = collectRoutes(API_ROOT).sort();

  it("znajduje trasy API", () => {
    expect(routes.length).toBeGreaterThan(20);
    expect(routes).toContain("/api/payments/hotpay/notify");
  });

  it("zbiór tras bez sesji w proxy równa się jawnej liście", () => {
    const publicInProxy = routes.filter((route) => {
      const p = concretePath(route);
      return isProxyPublicApiPath(p) || MATCHER_EXCLUDED_PREFIXES.some((x) => `${p}/`.startsWith(x));
    });
    const unexpected = publicInProxy.filter((r) => !EXPECTED_PUBLIC_ROUTES.has(r));
    const missing = routes.filter(
      (r) => EXPECTED_PUBLIC_ROUTES.has(r) && !publicInProxy.includes(r),
    );
    // `api/auth/[...nextauth]` jest poza listą oczekiwanych — obsługuje je matcher, nie ta lista.
    expect(unexpected.filter((r) => r !== "/api/auth/[...nextauth]")).toEqual([]);
    expect(missing).toEqual([]);
  });

  it("webhook HotPay jest na liście publicznej (inaczej płatność daje 401)", () => {
    expect(isProxyPublicApiPath("/api/payments/hotpay/notify")).toBe(true);
  });

  it("trasy płatności użytkownika nie są publiczne", () => {
    expect(isProxyPublicApiPath("/api/package/checkout")).toBe(false);
    expect(isProxyPublicApiPath("/api/package/status")).toBe(false);
    expect(isProxyPublicApiPath("/api/payments/hotpay/notify/extra")).toBe(false);
    expect(isProxyPublicApiPath("/api/payments")).toBe(false);
  });
});
