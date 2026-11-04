import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildHotpayPaymentHash,
  formatHotpayKwota,
  hotpayConfigured,
  verifyHotpayNotificationHash,
} from "@/lib/hotpay";
import { hotpayKwotaToGrosze } from "@/lib/hotpay-amount";

const sha = (parts: string[]) => createHash("sha256").update(parts.join(";"), "utf8").digest("hex");

describe("HotPay: konfiguracja i hash", () => {
  beforeEach(() => {
    vi.stubEnv("HOTPAY_SEKRET", "sekret-testowy");
    vi.stubEnv("HOTPAY_NOTIFICATION_PASSWORD", "haslo-testowe");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("hotpayConfigured wymaga SEKRET i hasła powiadomień", () => {
    expect(hotpayConfigured()).toBe(true);
    vi.stubEnv("HOTPAY_SEKRET", "");
    expect(hotpayConfigured()).toBe(false);
    vi.stubEnv("HOTPAY_SEKRET", "s");
    vi.stubEnv("HOTPAY_NOTIFICATION_PASSWORD", "  ");
    expect(hotpayConfigured()).toBe(false);
  });

  it("buildHotpayPaymentHash: SHA-256 z HASŁO;KWOTA;NAZWA;ADRES;ID;SEKRET", () => {
    const hash = buildHotpayPaymentHash({
      kwota: "19.99",
      nazwaUslugi: "GymBrat — Miesiąc",
      adresWww: "https://x.pl/package?paid=1",
      idZamowienia: "o1",
    });
    expect(hash).toBe(
      sha(["haslo-testowe", "19.99", "GymBrat — Miesiąc", "https://x.pl/package?paid=1", "o1", "sekret-testowy"]),
    );
  });

  const base = { kwota: "19.99", idPlatnosci: "p1", idZamowienia: "o1", status: "SUCCESS", sekret: "sekret-testowy" };

  it("verifyHotpayNotificationHash: poprawny hash z SECURE", () => {
    const hash = sha(["haslo-testowe", "19.99", "p1", "o1", "SUCCESS", "1", "sekret-testowy"]);
    expect(verifyHotpayNotificationHash({ ...base, secure: "1", hash })).toBe(true);
  });

  it("verifyHotpayNotificationHash: starszy format bez SECURE", () => {
    const hash = sha(["haslo-testowe", "19.99", "p1", "o1", "SUCCESS", "sekret-testowy"]);
    expect(verifyHotpayNotificationHash({ ...base, hash })).toBe(true);
  });

  it("verifyHotpayNotificationHash: wielkość liter hasha nie ma znaczenia", () => {
    const hash = sha(["haslo-testowe", "19.99", "p1", "o1", "SUCCESS", "sekret-testowy"]).toUpperCase();
    expect(verifyHotpayNotificationHash({ ...base, hash })).toBe(true);
  });

  it("odrzuca zmienioną kwotę, status, zamówienie i zły hash", () => {
    const hash = sha(["haslo-testowe", "19.99", "p1", "o1", "SUCCESS", "sekret-testowy"]);
    expect(verifyHotpayNotificationHash({ ...base, kwota: "0.01", hash })).toBe(false);
    expect(verifyHotpayNotificationHash({ ...base, status: "FAILURE", hash })).toBe(false);
    expect(verifyHotpayNotificationHash({ ...base, idZamowienia: "o2", hash })).toBe(false);
    expect(verifyHotpayNotificationHash({ ...base, hash: "0".repeat(64) })).toBe(false);
    expect(verifyHotpayNotificationHash({ ...base, hash: "abc" })).toBe(false);
    expect(verifyHotpayNotificationHash({ ...base, hash: "" })).toBe(false);
  });

  it("bez hasła powiadomień nic nie przechodzi (fail-closed)", () => {
    const hash = sha(["haslo-testowe", "19.99", "p1", "o1", "SUCCESS", "sekret-testowy"]);
    vi.stubEnv("HOTPAY_NOTIFICATION_PASSWORD", "");
    expect(verifyHotpayNotificationHash({ ...base, hash })).toBe(false);
  });
});

describe("HotPay: kwoty", () => {
  it("formatHotpayKwota: grosze → \"3.99\"", () => {
    expect(formatHotpayKwota(399)).toBe("3.99");
    expect(formatHotpayKwota(1999)).toBe("19.99");
    expect(formatHotpayKwota(7999)).toBe("79.99");
    expect(formatHotpayKwota(5)).toBe("0.05");
    expect(formatHotpayKwota(-10)).toBe("0.00");
  });

  it("hotpayKwotaToGrosze: odwrotność formatHotpayKwota", () => {
    for (const grosze of [1, 99, 100, 399, 899, 2499, 7999, 1999]) {
      expect(hotpayKwotaToGrosze(formatHotpayKwota(grosze))).toBe(grosze);
    }
  });

  it("hotpayKwotaToGrosze: akceptuje przecinek i jedno miejsce po przecinku, odrzuca śmieci", () => {
    expect(hotpayKwotaToGrosze("19,99")).toBe(1999);
    expect(hotpayKwotaToGrosze("19.5")).toBe(1950);
    expect(hotpayKwotaToGrosze("19")).toBe(1900);
    expect(hotpayKwotaToGrosze(" 3.99 ")).toBe(399);
    for (const bad of ["", "abc", "-1", "1.999", "1e2", "0x10", "1.2.3", ".5", "19.99zł"]) {
      expect(hotpayKwotaToGrosze(bad)).toBeNull();
    }
  });
});
