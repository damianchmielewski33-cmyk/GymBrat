import { describe, expect, it } from "vitest";
import { getAwpOrigin, isTrustedAwpOrigin, DEFAULT_AWP_ORIGIN } from "@/lib/awp-origin";
import { isValidAwpPin } from "@/lib/awp-account";

describe("awp-origin", () => {
  it("zwraca domyślny origin Akademii", () => {
    const prev = process.env.NEXT_PUBLIC_AWP_URL;
    delete process.env.NEXT_PUBLIC_AWP_URL;
    expect(getAwpOrigin()).toBe(DEFAULT_AWP_ORIGIN);
    if (prev !== undefined) process.env.NEXT_PUBLIC_AWP_URL = prev;
  });

  it("uznaje kanoniczny origin AWP", () => {
    expect(isTrustedAwpOrigin(DEFAULT_AWP_ORIGIN)).toBe(true);
    expect(isTrustedAwpOrigin("https://evil.example")).toBe(false);
    expect(isTrustedAwpOrigin(null)).toBe(false);
  });
});

describe("awp-account pin", () => {
  it("akceptuje PIN 4–6 cyfr jak w Akademii", () => {
    expect(isValidAwpPin("1234")).toBe(true);
    expect(isValidAwpPin("123456")).toBe(true);
    expect(isValidAwpPin("12")).toBe(false);
    expect(isValidAwpPin("abcdef")).toBe(false);
  });
});
