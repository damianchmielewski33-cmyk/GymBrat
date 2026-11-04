import { describe, expect, it } from "vitest";
import { expiryBannerText, expiryDispatchKey, shouldShowExpiryBanner } from "@/lib/package-expiry";

describe("package-expiry", () => {
  it("baner tylko dla aktywnego pakietu przy ≤ 7 dniach", () => {
    expect(shouldShowExpiryBanner({ active: true, daysLeft: 7 })).toBe(true);
    expect(shouldShowExpiryBanner({ active: true, daysLeft: 8 })).toBe(false);
    expect(shouldShowExpiryBanner({ active: false, daysLeft: 0 })).toBe(false);
    expect(shouldShowExpiryBanner({ active: true, daysLeft: null })).toBe(false);
  });
  it("klucz deduplikacji zależy od daty końca (czas polski)", () => {
    expect(expiryDispatchKey(new Date("2026-12-01T22:30:00Z"))).toBe("2026-12-01");
    expect(expiryDispatchKey(new Date("2026-12-01T23:30:00Z"))).toBe("2026-12-02");
  });
  it("tekst banera", () => {
    expect(expiryBannerText(5)).toContain("5 dni");
    expect(expiryBannerText(1)).toContain("jutro");
  });
});
