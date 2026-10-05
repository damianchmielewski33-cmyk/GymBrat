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
});
