import { describe, expect, it } from "vitest";
import { applyCspHeaders, buildCsp, cspMode, DEFAULT_AWP_ORIGIN, frameAncestors } from "@/lib/csp";

describe("csp (Z29/Z56)", () => {
  it("tryb domyślnie report-only; enforce tylko z CSP_MODE=enforce", () => {
    expect(cspMode({})).toBe("report-only");
    expect(cspMode({ CSP_MODE: "enforce" })).toBe("enforce");
    expect(cspMode({ CSP_MODE: " ENFORCE " })).toBe("enforce");
    expect(cspMode({ CSP_MODE: "1" })).toBe("report-only");
  });

  it("frame-ancestors: domyślnie self + AWP; własna lista; none; ignoruje śmieci", () => {
    expect(frameAncestors({})).toBe(`'self' ${DEFAULT_AWP_ORIGIN}`);
    expect(frameAncestors({ NEXT_PUBLIC_AWP_URL: "https://awp.example.com/gymbrat" })).toBe("'self' https://awp.example.com");
    expect(frameAncestors({ FRAME_ANCESTORS_ALLOWED: "https://a.example.com, https://b.example.com/x" })).toBe(
      "'self' https://a.example.com https://b.example.com",
    );
    expect(frameAncestors({ FRAME_ANCESTORS_ALLOWED: "none" })).toBe("'none'");
    expect(frameAncestors({ FRAME_ANCESTORS_ALLOWED: "javascript:alert(1), nie-url" })).toBe(`'self' ${DEFAULT_AWP_ORIGIN}`);
  });

  it("polityka: nonce + strict-dynamic, bez unsafe-inline/eval w script-src, object-src none", () => {
    const { full } = buildCsp({ nonce: "abc", env: {}, isProd: true });
    const script = full.split("; ").find((d) => d.startsWith("script-src"))!;
    expect(script).toBe("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(full).toContain("object-src 'none'");
    expect(full).toContain("default-src 'self'");
  });

  it("connect-src: Sentry z DSN i PostHog tylko przy kluczu", () => {
    const base = buildCsp({ nonce: "n", env: {}, isProd: true }).full;
    expect(base).toContain("connect-src 'self'");
    expect(base).not.toContain("posthog");
    const withAll = buildCsp({
      nonce: "n",
      env: { NEXT_PUBLIC_SENTRY_DSN: "https://k@o1.ingest.sentry.io/1", NEXT_PUBLIC_POSTHOG_KEY: "phc_x" },
      isProd: true,
    }).full;
    expect(withAll).toContain("https://o1.ingest.sentry.io");
    expect(withAll).toContain("https://eu.i.posthog.com");
  });

  it("report-only: egzekwowane tylko frame-ancestors, pełna polityka w Report-Only", () => {
    const h = new Headers();
    applyCspHeaders(h, buildCsp({ nonce: "n", env: {}, isProd: true }));
    expect(h.get("Content-Security-Policy")).toBe(`frame-ancestors 'self' ${DEFAULT_AWP_ORIGIN}`);
    expect(h.get("Content-Security-Policy-Report-Only")).toContain("script-src");
  });

  it("enforce: pełna polityka jako Content-Security-Policy, bez Report-Only", () => {
    const h = new Headers({ "Content-Security-Policy-Report-Only": "x" });
    applyCspHeaders(h, buildCsp({ nonce: "n", env: { CSP_MODE: "enforce" }, isProd: true }));
    expect(h.get("Content-Security-Policy")).toContain("script-src");
    expect(h.get("Content-Security-Policy-Report-Only")).toBeNull();
  });

  it("poza produkcją tylko frame-ancestors (HMR)", () => {
    const h = new Headers();
    applyCspHeaders(h, buildCsp({ nonce: "n", env: { CSP_MODE: "enforce" }, isProd: false }));
    expect(h.get("Content-Security-Policy")).toMatch(/^frame-ancestors /);
    expect(h.get("Content-Security-Policy-Report-Only")).toBeNull();
  });
});
