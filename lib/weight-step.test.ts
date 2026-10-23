import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEIGHT_STEP,
  resolveWeightStep,
  round2,
  roundHoldKg,
  sanitizeExplicitStepKg,
} from "@/lib/weight-step";

describe("weight-step — resolveWeightStep", () => {
  it("domyślnie sztanga/talerze: 2,5 kg, mikro 1,25 kg", () => {
    expect(resolveWeightStep({ name: "Wyciskanie sztangi" })).toEqual(
      DEFAULT_WEIGHT_STEP,
    );
    expect(resolveWeightStep({})).toEqual({ stepKg: 2.5, minStepKg: 1.25 });
    expect(resolveWeightStep({ name: "" })).toEqual(DEFAULT_WEIGHT_STEP);
  });

  it("hantle: 2 kg (PL, EN i skrót DB)", () => {
    for (const name of ["Wyciskanie hantli", "Dumbbell Row", "Incline DB Press"]) {
      expect(resolveWeightStep({ name })).toEqual({ stepKg: 2, minStepKg: 2 });
    }
  });

  it("kettlebell: 4 kg", () => {
    expect(resolveWeightStep({ name: "Kettlebell swing" })).toEqual({
      stepKg: 4,
      minStepKg: 4,
    });
  });

  it("maszyny / wyciągi: 2,5 kg bez mikro-kroku", () => {
    for (const name of ["Wyciskanie na maszynie", "Lat pulldown", "Leg press", "Wyciąg górny"]) {
      expect(resolveWeightStep({ name })).toEqual({ stepKg: 2.5, minStepKg: 2.5 });
    }
  });

  it("jawny krok ćwiczenia wygrywa z heurystyką nazwy", () => {
    expect(
      resolveWeightStep({ name: "Wyciskanie hantli", explicitStepKg: 5 }),
    ).toEqual({ stepKg: 5, minStepKg: 5 });
    expect(resolveWeightStep({ name: "Sztanga", explicitStepKg: 1.25 })).toEqual({
      stepKg: 1.25,
      minStepKg: 1.25,
    });
  });

  it("nieprawidłowy jawny krok jest ignorowany", () => {
    for (const bad of [0, -2, NaN, Infinity, 0.1, 25, null, undefined]) {
      expect(sanitizeExplicitStepKg(bad as number | null | undefined)).toBeNull();
      expect(
        resolveWeightStep({ name: "Wyciskanie hantli", explicitStepKg: bad as number }),
      ).toEqual({ stepKg: 2, minStepKg: 2 });
    }
  });

  it("sanitize zaokrągla do 2 miejsc", () => {
    expect(sanitizeExplicitStepKg(1.254)).toBe(1.25);
    expect(sanitizeExplicitStepKg(0.25)).toBe(0.25);
    expect(sanitizeExplicitStepKg(20)).toBe(20);
  });
});

describe("weight-step — zaokrąglenia", () => {
  it("round2 zachowuje ćwierćkilogramy", () => {
    expect(round2(37.25)).toBe(37.25);
    expect(round2(36 + 1.25)).toBe(37.25);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(NaN)).toBe(0);
  });

  it("roundHoldKg czyści szum, ale nie ściąga do pełnych talerzy", () => {
    expect(roundHoldKg(36)).toBe(36);
    expect(roundHoldKg(36.1)).toBe(36);
    expect(roundHoldKg(37.25)).toBe(37.25);
    expect(roundHoldKg(0)).toBe(0);
    expect(roundHoldKg(-5)).toBe(0);
  });
});
