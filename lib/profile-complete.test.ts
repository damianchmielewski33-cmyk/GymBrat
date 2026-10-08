import { describe, expect, it } from "vitest";
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
