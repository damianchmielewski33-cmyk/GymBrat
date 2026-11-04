import { describe, expect, it } from "vitest";
import {
  buildPrAchievementImagePrompt,
  formatPrDateLabel,
  formatPrWeightLabel,
  getPrAchievementImageUrl,
} from "@/lib/pr-achievement-image";

describe("pr-achievement-image", () => {
  it("buduje URL Pollinations bez tekstu w promptcie", () => {
    const url = getPrAchievementImageUrl({
      exerciseName: "Wyciskanie na ławce",
      valueKg: 145,
      atMs: Date.UTC(2026, 8, 27),
    });
    expect(url.startsWith("/api/recipe-image?")).toBe(true);
    expect(url).toContain("mode=raw");
    expect(url).not.toContain("image.pollinations.ai");
    expect(buildPrAchievementImagePrompt({ exerciseName: "Bench", valueKg: 100 })).toMatch(
      /no text/i,
    );
  });

  it("formatuje datę i ciężar jak na grafice", () => {
    expect(formatPrWeightLabel(145)).toBe("145 KG");
    expect(formatPrWeightLabel(102.5)).toBe("102,5 KG");
    expect(formatPrDateLabel(Date.UTC(2026, 8, 27, 12, 0, 0))).toMatch(/27\.09\.2026/);
  });

  it("Z27: URL i prompt nie zawierają nazwy ćwiczenia ani ciężaru; seed nie zależy od nich", () => {
    const a = getPrAchievementImageUrl({ exerciseName: "Martwy ciąg Jana Kowalskiego", valueKg: 217.5, atMs: Date.UTC(2026, 8, 27) });
    const b = getPrAchievementImageUrl({ exerciseName: "Przysiad", valueKg: 60, atMs: Date.UTC(2026, 8, 27) });
    expect(a).toBe(b);
    const decoded = decodeURIComponent(a).toLowerCase();
    for (const secret of ["martwy", "kowalski", "217", "przysiad"]) {
      expect(decoded).not.toContain(secret);
    }
    expect(buildPrAchievementImagePrompt({ exerciseName: "Sekret", valueKg: 999 })).not.toMatch(/sekret|999/i);
  });
});
