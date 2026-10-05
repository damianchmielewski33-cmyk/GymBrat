import { describe, expect, it } from "vitest";
import {
  extractCardioExtrasFromSessionJson,
  normalizeCardioExtras,
} from "@/lib/cardio-utils";

describe("cardio extras", () => {
  it("normalizuje metryki i liczy tempo", () => {
    const extras = normalizeCardioExtras(
      { distanceKm: 5, avgHr: 130.4, calories: 320.2, steps: 6000.8 },
      40,
    );
    expect(extras.distanceKm).toBe(5);
    expect(extras.avgHr).toBe(130);
    expect(extras.calories).toBe(320);
    expect(extras.steps).toBe(6001);
    expect(extras.paceMinPerKm).toBe(8);
  });

  it("czyta cardio_log", () => {
    const extras = extractCardioExtrasFromSessionJson(
      {
        kind: "cardio_log",
        title: "Bieżnia",
        distanceKm: 3.2,
        calories: 210,
        steps: 4000,
        avgHr: 128,
      },
      28,
    );
    expect(extras.distanceKm).toBe(3.2);
    expect(extras.calories).toBe(210);
    expect(extras.steps).toBe(4000);
    expect(extras.paceMinPerKm).toBeCloseTo(28 / 3.2, 5);
  });

  it("czyta cardio z completed_session po siłowym", () => {
    const extras = extractCardioExtrasFromSessionJson(
      {
        kind: "completed_session",
        title: "Push",
        cardioMinutes: 15,
        cardio: {
          distanceKm: 2,
          calories: 150,
          steps: 2500,
          avgHr: 120,
        },
      },
      15,
    );
    expect(extras.distanceKm).toBe(2);
    expect(extras.calories).toBe(150);
    expect(extras.steps).toBe(2500);
    expect(extras.paceMinPerKm).toBe(7.5);
  });
});
