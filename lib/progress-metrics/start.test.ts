import { describe, expect, it } from "vitest";
import { resolveProgressStart } from "@/lib/progress-metrics/start";

describe("resolveProgressStart", () => {
  const weights = [
    { date: "2026-01-01", kg: 90 },
    { date: "2026-02-01", kg: 88 },
    { date: "2026-03-01", kg: 86 },
  ];

  it("custom start photo wygrywa", () => {
    const s = resolveProgressStart({
      weights,
      hasCustomStartPhoto: true,
      customStartPhoto: {
        date: "2026-02-01",
        weightKg: 87.5,
        waistCm: 90,
      },
      firstReportWithPhoto: {
        date: "2026-01-01",
        weightKg: 90,
        waistCm: 95,
      },
    });
    expect(s.isCustomPhotoStart).toBe(true);
    expect(s.date).toBe("2026-02-01");
    expect(s.weightKg).toBe(87.5);
    expect(s.waistCm).toBe(90);
  });

  it("bez custom → pierwszy raport ze zdjęciem", () => {
    const s = resolveProgressStart({
      weights,
      hasCustomStartPhoto: false,
      customStartPhoto: null,
      firstReportWithPhoto: {
        date: "2026-01-15",
        weightKg: 89,
        waistCm: 94,
      },
    });
    expect(s.isCustomPhotoStart).toBe(false);
    expect(s.date).toBe("2026-01-15");
    expect(s.weightKg).toBe(89);
  });

  it("bez zdjęć → pierwszy punkt wagi", () => {
    const s = resolveProgressStart({
      weights,
      hasCustomStartPhoto: false,
      customStartPhoto: null,
      firstReportWithPhoto: null,
    });
    expect(s.date).toBe("2026-01-01");
    expect(s.weightKg).toBe(90);
    expect(s.waistCm).toBeNull();
  });
});
