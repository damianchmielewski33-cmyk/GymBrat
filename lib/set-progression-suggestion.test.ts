import { describe, expect, it } from "vitest";
import {
  buildSetProgressionSuggestion,
  formatLastSetLine,
  formatRepRangeLabel,
  resolveRepRange,
  suggestedWeightFromProgression,
} from "@/lib/set-progression-suggestion";

describe("set-progression-suggestion", () => {
  it("zakres z celu planu: 10 → 8-10", () => {
    expect(resolveRepRange(10)).toEqual({ min: 8, max: 10 });
    expect(formatRepRangeLabel({ min: 8, max: 10 })).toBe("8-10");
  });

  it("góra zakresu → +ciężar i dół zakresu", () => {
    const s = buildSetProgressionSuggestion({
      last: { weight: 36, reps: 10, rir: 1 },
      targetReps: 10,
    });
    expect(s).not.toBeNull();
    expect(s!.weightKg).toBe(38.5);
    expect(s!.reps).toBe(8);
    expect(s!.highlight).toBe("38,5 kg × 8");
    expect(s!.fullText).toContain("góra zakresu");
    expect(s!.fullText.startsWith("Dziś spróbuj ")).toBe(true);
  });

  it("poniżej góry → więcej powtórzeń", () => {
    const s = buildSetProgressionSuggestion({
      last: { weight: 36, reps: 8, rir: 2 },
      targetReps: 10,
    });
    expect(s).not.toBeNull();
    expect(s!.kind).toBe("reps");
    expect(s!.weightKg).toBe(36);
    expect(s!.reps).toBe(9);
    expect(s!.fullText).toContain("więcej powtórzeń");
  });

  it("duży zapas → +ciężar", () => {
    const s = buildSetProgressionSuggestion({
      last: { weight: 60, reps: 8, rir: 3 },
      targetReps: 10,
    });
    expect(s).not.toBeNull();
    expect(s!.weightKg).toBe(62.5);
    expect(s!.fullText).toContain("duży zapas");
  });

  it("brak historii → null", () => {
    expect(
      buildSetProgressionSuggestion({ last: null, targetReps: 10 }),
    ).toBeNull();
  });

  it("formatuje Ostatnio", () => {
    expect(formatLastSetLine({ weight: 36, reps: 10 })).toBe(
      "Ostatnio 36 kg × 10",
    );
  });

  it("suggestedWeightFromProgression przy górze zakresu", () => {
    expect(
      suggestedWeightFromProgression({
        last: { weight: 36, reps: 10 },
        targetReps: 10,
      }),
    ).toBe(38.5);
  });
});
