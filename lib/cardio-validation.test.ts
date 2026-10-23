import { describe, expect, it } from "vitest";
import { validateCardioMetrics } from "@/lib/cardio-utils";

describe("validateCardioMetrics", () => {
  it("akceptuje poprawny wpis i zaokrągla wartości", () => {
    const r = validateCardioMetrics({
      minutes: 30.4,
      distanceKm: "4,5".replace(",", "."),
      avgHr: 131.6,
      maxHr: 160,
      calories: 280.4,
      steps: 5000,
    });
    expect(r).toMatchObject({
      ok: true,
      minutes: 30,
      distanceKm: 4.5,
      avgHr: 132,
      maxHr: 160,
      calories: 280,
      steps: 5000,
    });
  });

  it("odrzuca NaN, 0 i >24 h minut", () => {
    expect(validateCardioMetrics({ minutes: Number.NaN }).ok).toBe(false);
    expect(validateCardioMetrics({ minutes: "abc" }).ok).toBe(false);
    expect(validateCardioMetrics({ minutes: 0 }).ok).toBe(false);
    expect(validateCardioMetrics({ minutes: 24 * 60 + 1 }).ok).toBe(false);
    expect(validateCardioMetrics({ minutes: 24 * 60 }).ok).toBe(true);
  });

  it("puste i niedodatnie pola opcjonalne → null", () => {
    const r = validateCardioMetrics({
      minutes: 20,
      distanceKm: "",
      avgHr: 0,
      calories: null,
    });
    expect(r).toMatchObject({
      ok: true,
      distanceKm: null,
      avgHr: null,
      calories: null,
    });
  });

  it("odrzuca nierealne tętno, kalorie i dystans", () => {
    expect(validateCardioMetrics({ minutes: 20, avgHr: 20 }).ok).toBe(false);
    expect(validateCardioMetrics({ minutes: 20, maxHr: 300 }).ok).toBe(false);
    expect(validateCardioMetrics({ minutes: 20, calories: 25_000 }).ok).toBe(false);
    // 5000 kcal w 30 min = ~167 kcal/min — literówka
    expect(validateCardioMetrics({ minutes: 30, calories: 5000 }).ok).toBe(false);
    expect(validateCardioMetrics({ minutes: 60, calories: 600 }).ok).toBe(true);
    expect(validateCardioMetrics({ minutes: 20, distanceKm: 900 }).ok).toBe(false);
    expect(validateCardioMetrics({ minutes: 20, steps: 900_000 }).ok).toBe(false);
  });
});
