import { describe, expect, it } from "vitest";
import {
  applyDeload,
  buildSetProgressionSuggestion,
  formatLastSetLine,
  formatRepRangeLabel,
  resolveRepRange,
  suggestedWeightFromProgression,
} from "@/lib/set-progression-suggestion";
import { HARD_RIR, EASY_RIR, HARD_RPE, EASY_RPE } from "@/lib/set-effort";

describe("set-progression-suggestion", () => {
  it("zakres z celu planu: 10 → 8-10; siła 4 → 3-4", () => {
    expect(resolveRepRange(10)).toEqual({ min: 8, max: 10 });
    expect(formatRepRangeLabel({ min: 8, max: 10 })).toBe("8-10");
    expect(resolveRepRange(4)).toEqual({ min: 3, max: 4 });
    expect(resolveRepRange(3)).toEqual({ min: 2, max: 3 });
    expect(resolveRepRange(2)).toEqual({ min: 1, max: 2 });
  });

  it("góra zakresu po 2 łatwych → +ciężar i dół zakresu", () => {
    const s = buildSetProgressionSuggestion({
      last: { weight: 36, reps: 10, rir: 3 },
      priorSets: [{ weight: 36, reps: 10, rir: 3 }],
      targetReps: 10,
    });
    expect(s).not.toBeNull();
    expect(s!.weightKg).toBe(38.5);
    expect(s!.reps).toBe(8);
    expect(s!.highlight).toBe("38,5 kg × 8");
    expect(s!.fullText).toContain("góra zakresu");
    expect(s!.fullText.startsWith("Dziś spróbuj ")).toBe(true);
  });

  it("góra zakresu z jedną łatwą → brak +kg (need more easy)", () => {
    const s = buildSetProgressionSuggestion({
      last: { weight: 36, reps: 10, rir: 3 },
      targetReps: 10,
    });
    expect(s).toBeNull();
  });

  it("góra zakresu z RIR=1 (warn) → brak +kg", () => {
    const s = buildSetProgressionSuggestion({
      last: { weight: 36, reps: 10, rir: 1 },
      targetReps: 10,
    });
    expect(s).toBeNull();
  });

  it("poniżej góry → więcej powtórzeń (nawet przy easy — bez easy_anywhere)", () => {
    const s = buildSetProgressionSuggestion({
      last: { weight: 60, reps: 8, rir: 3 },
      targetReps: 10,
    });
    expect(s).not.toBeNull();
    expect(s!.kind).toBe("reps");
    expect(s!.weightKg).toBe(60);
    expect(s!.reps).toBe(9);
    expect(s!.fullText).toContain("więcej powtórzeń");
  });

  it("mid-range RIR 2 → +reps", () => {
    const s = buildSetProgressionSuggestion({
      last: { weight: 36, reps: 8, rir: 2 },
      targetReps: 10,
    });
    expect(s).not.toBeNull();
    expect(s!.kind).toBe("reps");
    expect(s!.weightKg).toBe(36);
    expect(s!.reps).toBe(9);
  });

  it("konflikt RIR/RPE → null (hold)", () => {
    expect(
      buildSetProgressionSuggestion({
        last: { weight: 60, reps: 10, rir: 5, rpe: 10 },
        priorSets: [{ weight: 60, reps: 10, rir: 4 }],
        targetReps: 10,
      }),
    ).toBeNull();
  });

  it("deload %: max(2.5, 5%)", () => {
    expect(applyDeload(40)).toBe(37.5);
    expect(applyDeload(100)).toBe(95);
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

  it("suggestedWeightFromProgression przy górze + 2 easy", () => {
    expect(
      suggestedWeightFromProgression({
        last: { weight: 36, reps: 10, rir: 3 },
        priorSets: [{ weight: 36, reps: 10, rir: 3 }],
        targetReps: 10,
      }),
    ).toBe(38.5);
  });

  it("wspólne progi HARD/EASY", () => {
    expect(HARD_RIR).toBe(0);
    expect(EASY_RIR).toBe(3);
    expect(HARD_RPE).toBe(9);
    expect(EASY_RPE).toBe(6);
  });
});
