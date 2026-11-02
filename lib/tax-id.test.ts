import { describe, expect, it } from "vitest";
import { isValidNip, normalizeNip } from "@/lib/tax-id";

describe("NIP", () => {
  it("normalizuje myślniki, spacje i prefiks PL", () => {
    expect(normalizeNip("PL 526-10-40-678")).toBe("5261040678");
  });
  it("akceptuje poprawny NIP i odrzuca błędną sumę kontrolną lub długość", () => {
    expect(isValidNip("5261040828")).toBe(true);
    expect(isValidNip("526-104-08-28")).toBe(true);
    expect(isValidNip("5261040829")).toBe(false);
    expect(isValidNip("123")).toBe(false);
    expect(isValidNip("abcdefghij")).toBe(false);
  });
});
