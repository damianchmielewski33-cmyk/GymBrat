import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateTotpSecret, otpauthUri, totpAt, verifyTotp } from "@/lib/totp";

// Wektory testowe RFC 6238 (SHA-1, sekret ASCII "12345678901234567890"), kody 6-cyfrowe.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("totp (Z32)", () => {
  it("base32 round-trip", () => {
    const buf = Buffer.from("GymBrat-2FA!");
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });

  it.each([
    [59, "287082"],
    [1111111109, "081804"],
    [1234567890, "005924"],
  ])("RFC 6238: t=%d → %s", (t, code) => {
    expect(totpAt(RFC_SECRET, t * 1000)).toBe(code);
  });

  it("verifyTotp akceptuje okno ±1 krok, odrzuca dalsze i nieprawidłowy format", () => {
    const now = 1234567890_000;
    const code = totpAt(RFC_SECRET, now);
    expect(verifyTotp(RFC_SECRET, code, now).ok).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, now + 30_000).ok).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, now + 90_000).ok).toBe(false);
    expect(verifyTotp(RFC_SECRET, "12345", now).ok).toBe(false);
    expect(verifyTotp(RFC_SECRET, "abcdef", now).ok).toBe(false);
  });

  it("zużyty krok nie może być użyty ponownie (anty-replay)", () => {
    const now = 1234567890_000;
    const first = verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, now), now);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, now), now, { lastStep: first.step }).ok).toBe(false);
  });

  it("generateTotpSecret daje 32 znaki base32; otpauth zawiera wydawcę i sekret", () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    const uri = otpauthUri({ secret: s, account: "a@b.pl", issuer: "GymBrat" });
    expect(uri).toContain("otpauth://totp/GymBrat:a%40b.pl");
    expect(uri).toContain(`secret=${s}`);
  });
});
