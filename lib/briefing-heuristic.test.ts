import { describe, expect, it } from "vitest";
import { buildHeuristicBriefText } from "@/lib/briefing-heuristic";

describe("buildHeuristicBriefText", () => {
  it("includes time line and cue for midday", () => {
    const text = buildHeuristicBriefText(
      {
        nutritionSummary: "1800 kcal",
        trainingSummary: "ostatnio push",
      },
      {
        linePl: "Środa, 15:00 — popołudnie.",
        hour: 15,
      },
    );
    expect(text).toContain("Środa");
    expect(text).toContain("Kalorie");
    expect(text).toContain("Na teraz");
  });

  it("prefers late-night cue", () => {
    const text = buildHeuristicBriefText({}, { linePl: "noc", hour: 23 });
    expect(text).toContain("sen");
  });
});
