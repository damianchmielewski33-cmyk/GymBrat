import { describe, expect, it } from "vitest";
import {
  CARDIO_INPUT_LIMITS,
  resolveCardioLogDate,
  validateCardioMetrics,
} from "@/lib/cardio-utils";

describe("validateCardioMetrics (ADR 0009)", () => {
  it("akceptuje poprawny wpis całkowitych minut i zaokrągla opcjonalne", () => {
    const r = validateCardioMetrics({
      minutes: "30",
      distanceKm: "4,5",
      avgHr: "132",
      maxHr: "160",
      calories: "280",
      steps: "5000",
      effortScore: "6",
    });
    expect(r).toMatchObject({
      ok: true,
      values: {
        minutes: 30,
        distanceKm: 4.5,
        avgHr: 132,
        maxHr: 160,
        calories: 280,
        steps: 5000,
        effortScore: 6,
      },
    });
  });

  it("odrzuca minuty niecałkowite zamiast cicho ucinać", () => {
    const r = validateCardioMetrics({ minutes: "1,5" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fieldErrors[0]?.field).toBe("minutes");
      expect(r.fieldErrors[0]?.message).toMatch(/całkowit/i);
    }
  });

  it("odrzuca puste, 0 i >600 minut (fieldErrors)", () => {
    expect(validateCardioMetrics({ minutes: "" }).ok).toBe(false);
    expect(validateCardioMetrics({ minutes: "abc" }).ok).toBe(false);
    expect(validateCardioMetrics({ minutes: "0" }).ok).toBe(false);
    expect(
      validateCardioMetrics({ minutes: String(CARDIO_INPUT_LIMITS.minutesMax + 1) })
        .ok,
    ).toBe(false);
    expect(
      validateCardioMetrics({ minutes: String(CARDIO_INPUT_LIMITS.minutesMax) })
        .ok,
    ).toBe(true);
  });

  it("puste opcjonalne → null; 0 / śmieci → błąd pola (nie ciche null)", () => {
    const empty = validateCardioMetrics({
      minutes: "20",
      distanceKm: "",
      avgHr: "",
      calories: null,
    });
    expect(empty).toMatchObject({
      ok: true,
      values: { distanceKm: null, avgHr: null, calories: null },
    });

    const zero = validateCardioMetrics({ minutes: "20", avgHr: "0" });
    expect(zero.ok).toBe(false);
    if (!zero.ok) {
      expect(zero.fieldErrors.some((e) => e.field === "avgHr")).toBe(true);
    }

    const garbage = validateCardioMetrics({ minutes: "20", avgHr: "125 bpm" });
    expect(garbage.ok).toBe(false);
  });

  it("odrzuca nierealne tętno, kalorie, dystans i max < śr.", () => {
    expect(validateCardioMetrics({ minutes: "20", avgHr: "20" }).ok).toBe(
      false,
    );
    expect(validateCardioMetrics({ minutes: "20", maxHr: "300" }).ok).toBe(
      false,
    );
    expect(
      validateCardioMetrics({ minutes: "20", calories: "25000" }).ok,
    ).toBe(false);
    expect(
      validateCardioMetrics({ minutes: "30", calories: "5000" }).ok,
    ).toBe(false);
    expect(
      validateCardioMetrics({ minutes: "60", calories: "600" }).ok,
    ).toBe(true);
    expect(
      validateCardioMetrics({ minutes: "20", distanceKm: "900" }).ok,
    ).toBe(false);
    expect(
      validateCardioMetrics({ minutes: "20", steps: "900000" }).ok,
    ).toBe(false);

    const hrOrder = validateCardioMetrics({
      minutes: "30",
      avgHr: "140",
      maxHr: "120",
    });
    expect(hrOrder.ok).toBe(false);
    if (!hrOrder.ok) {
      expect(hrOrder.fieldErrors.some((e) => e.field === "maxHr")).toBe(true);
    }
  });

  it("waliduje wysiłek 1–10", () => {
    expect(
      validateCardioMetrics({ minutes: "20", effortScore: "11" }).ok,
    ).toBe(false);
    expect(
      validateCardioMetrics({ minutes: "20", effortScore: "7" }).ok,
    ).toBe(true);
  });

  it("resolveCardioLogDate: dziś, przyszłość, za daleko wstecz", () => {
    expect(resolveCardioLogDate("").ok).toBe(true);
    expect(resolveCardioLogDate("2099-01-01").ok).toBe(false);
    expect(resolveCardioLogDate("2000-01-01").ok).toBe(false);
  });
});
