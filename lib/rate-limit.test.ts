import { describe, expect, it } from "vitest";
import {
  checkRateLimit,
  clientIpFromHeaders,
  isRateLimited,
  resetRateLimit,
  trustedIpHeaderName,
} from "@/lib/rate-limit";

describe("checkRateLimit (in-memory)", () => {
  it("allows under limit", () => {
    const k = `test:${Math.random()}`;
    expect(checkRateLimit(k, 3, 60_000).ok).toBe(true);
    expect(checkRateLimit(k, 3, 60_000).ok).toBe(true);
    expect(checkRateLimit(k, 3, 60_000).ok).toBe(true);
  });

  it("blocks when bucket full", () => {
    const k = `test:${Math.random()}`;
    expect(checkRateLimit(k, 2, 60_000).ok).toBe(true);
    expect(checkRateLimit(k, 2, 60_000).ok).toBe(true);
    const third = checkRateLimit(k, 2, 60_000);
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.retryAfterSec).toBeGreaterThan(0);
  });
});

describe("clientIpFromHeaders (Z30: zaufane IP)", () => {
  const prod = { NODE_ENV: "production" };
  const h = (o: Record<string, string>) => new Headers(o);

  it("produkcja: bierze x-real-ip, ignoruje podrobiony x-forwarded-for", () => {
    expect(clientIpFromHeaders(h({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.2.3.4" }), prod)).toBe("9.9.9.9");
  });

  it("produkcja: sam x-forwarded-for nie wyznacza klucza (spoofing) → unknown", () => {
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "1.2.3.4" }), prod)).toBe("unknown");
  });

  it("TRUSTED_IP_HEADER zmienia nagłówek; niepoprawna nazwa wraca do domyślnej", () => {
    const env = { ...prod, TRUSTED_IP_HEADER: "CF-Connecting-IP" };
    expect(trustedIpHeaderName(env)).toBe("cf-connecting-ip");
    expect(clientIpFromHeaders(h({ "cf-connecting-ip": "7.7.7.7", "x-real-ip": "9.9.9.9" }), env)).toBe("7.7.7.7");
    expect(trustedIpHeaderName({ TRUSTED_IP_HEADER: "zły nagłówek!" })).toBe("x-real-ip");
  });

  it("poza produkcją dopuszcza x-forwarded-for (dev/testy), bez nagłówków → local", () => {
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }), { NODE_ENV: "development" })).toBe("1.2.3.4");
    expect(clientIpFromHeaders(h({}), { NODE_ENV: "test" })).toBe("local");
  });
});

describe("isRateLimited / resetRateLimit (blokada tylko po porażkach, DK-22)", () => {
  it("nie zużywa próby; blokuje dopiero po wyczerpaniu limitu; reset zdejmuje blokadę", async () => {
    const k = `admin-fail:${Math.random()}`;
    expect(await isRateLimited(k, 2, 60_000)).toBe(false);
    expect(await isRateLimited(k, 2, 60_000)).toBe(false); // sprawdzenie nie zużywa
    checkRateLimit(k, 2, 60_000);
    expect(await isRateLimited(k, 2, 60_000)).toBe(false);
    checkRateLimit(k, 2, 60_000);
    expect(await isRateLimited(k, 2, 60_000)).toBe(true);
    await resetRateLimit(k, 2, 60_000);
    expect(await isRateLimited(k, 2, 60_000)).toBe(false);
  });
});
