import { describe, expect, it } from "vitest";
import { MIN_PURCHASE_AGE, MIN_USER_AGE } from "@/lib/min-age";
import { isUserBodyProfileComplete } from "@/lib/profile-complete";

describe("isUserBodyProfileComplete", () => {
  it("wymaga pełnych danych jak przy rejestracji", () => {
    expect(
      isUserBodyProfileComplete({
        firstName: "Jan",
        lastName: "Kowalski",
        weightKg: 80,
        heightCm: 180,
        age: 28,
        activityLevel: "medium",
      }),
    ).toBe(true);
  });

  it("odrzuca profil po samym Google (bez parametrów ciała)", () => {
    expect(
      isUserBodyProfileComplete({
        firstName: "Jan",
        lastName: "Kowalski",
        weightKg: null,
        heightCm: null,
        age: null,
        activityLevel: null,
      }),
    ).toBe(false);
  });
});

describe("wiek 16+ (Z13)", () => {
  const base = {
    firstName: "Jan",
    lastName: "Kowalski",
    weightKg: 80,
    heightCm: 180,
    age: 30,
    activityLevel: "medium",
  };

  it("stałe: 16 dla konta, 18 dla zakupu pakietu", () => {
    expect(MIN_USER_AGE).toBe(16);
    expect(MIN_PURCHASE_AGE).toBe(18);
  });

  it("profil kompletny od 16 lat; 13-15 wraca do uzupełnienia (blokada do potwierdzenia wieku)", () => {
    expect(isUserBodyProfileComplete({ ...base, age: 16 })).toBe(true);
    expect(isUserBodyProfileComplete({ ...base, age: 15 })).toBe(false);
    expect(isUserBodyProfileComplete({ ...base, age: 13 })).toBe(false);
    expect(isUserBodyProfileComplete({ ...base, age: null })).toBe(false);
    expect(isUserBodyProfileComplete({ ...base, age: 121 })).toBe(false);
  });
});
