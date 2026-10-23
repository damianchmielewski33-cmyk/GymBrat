import { describe, expect, it } from "vitest";
import {
  applyDeload,
  buildSetProgressionSuggestion,
  bumpWeightByPlate,
  formatKgPl,
  formatLastSetLine,
  formatRepRangeLabel,
  qualifiesRepsOnlyBump,
  resolveRepRange,
  suggestedWeightFromProgression,
  type RepsOnlySessionSnap,
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

  it("wspólne progi HARD/EASY (RIR ≥ 2 = zapas wystarczający do dokładki)", () => {
    expect(HARD_RIR).toBe(0);
    expect(EASY_RIR).toBe(2);
    // RPE = 10 − RIR
    expect(HARD_RPE).toBe(10);
    expect(EASY_RPE).toBe(8);
  });
});

describe("RIR ≥ 2 odblokowuje dokładkę", () => {
  it("dwie serie z RIR 2 na górze zakresu → +ciężar", () => {
    const s = buildSetProgressionSuggestion({
      last: { weight: 36, reps: 10, rir: 2 },
      priorSets: [{ weight: 36, reps: 10, rir: 2 }],
      targetReps: 10,
    });
    expect(s).not.toBeNull();
    expect(s!.kind).toBe("weight");
    expect(s!.weightKg).toBe(38.5);
    expect(s!.rule).toBe("top_of_range_easy");
  });

  it("jedna seria z RIR 2 nadal nie wystarcza (potrzeba 2 łatwych)", () => {
    expect(
      buildSetProgressionSuggestion({
        last: { weight: 36, reps: 10, rir: 2 },
        targetReps: 10,
      }),
    ).toBeNull();
  });

  it("izolacja nadal wymaga 3 łatwych serii (RIR 2 × 2 to za mało)", () => {
    const base = {
      exerciseName: "Wznosy bokiem",
      targetReps: 12,
    };
    expect(
      buildSetProgressionSuggestion({
        ...base,
        last: { weight: 8, reps: 12, rir: 2 },
        priorSets: [{ weight: 8, reps: 12, rir: 2 }],
      }),
    ).toBeNull();
    const s = buildSetProgressionSuggestion({
      ...base,
      last: { weight: 8, reps: 12, rir: 2 },
      priorSets: [
        { weight: 8, reps: 12, rir: 2 },
        { weight: 8, reps: 12, rir: 3 },
      ],
    });
    expect(s).not.toBeNull();
    expect(s!.kind).toBe("weight");
  });

  it("RPE ≤ 8 jako fallback = łatwa seria; RPE 9 = na styk", () => {
    expect(
      buildSetProgressionSuggestion({
        last: { weight: 36, reps: 10, rpe: 8 },
        priorSets: [{ weight: 36, reps: 10, rpe: 8 }],
        targetReps: 10,
      })?.kind,
    ).toBe("weight");
    expect(
      buildSetProgressionSuggestion({
        last: { weight: 36, reps: 10, rpe: 9 },
        priorSets: [{ weight: 36, reps: 10, rpe: 9 }],
        targetReps: 10,
      }),
    ).toBeNull();
  });

  it("RIR 2 przy RPE 10 to konflikt — bez dokładki", () => {
    expect(
      buildSetProgressionSuggestion({
        last: { weight: 36, reps: 10, rir: 2, rpe: 10 },
        priorSets: [{ weight: 36, reps: 10, rir: 2, rpe: 10 }],
        targetReps: 10,
      }),
    ).toBeNull();
  });
});

describe("profil ruchu zamiast stałych progów", () => {
  it("izolacja z celem RIR 0–1: seria do upadku nie wymusza deloadu", () => {
    const s = buildSetProgressionSuggestion({
      last: { weight: 20, reps: 12, rir: 0 },
      targetReps: 12,
      exerciseName: "Uginanie ze sztangą",
      includeDeload: true,
    });
    // brak „zejdź z ciężarem” — seria zgodna z planem
    expect(s).toBeNull();
  });

  it("ten sam RIR 0 na wyciskaniu leżąc (cel RIR 1) → deload", () => {
    const s = buildSetProgressionSuggestion({
      last: { weight: 80, reps: 8, rir: 0 },
      targetReps: 8,
      exerciseName: "Wyciskanie sztangi leżąc (bench)",
      includeDeload: true,
    });
    expect(s).not.toBeNull();
    expect(s!.weightKg).toBeLessThan(80);
    expect(s!.rule).toBe("below_range_or_hard");
  });

  it("cel RIR 0 z planu obniża próg „twardej” serii", () => {
    const s = buildSetProgressionSuggestion({
      last: { weight: 80, reps: 8, rir: 0 },
      targetReps: 8,
      exerciseName: "Wyciskanie sztangi leżąc (bench)",
      targetRir: 0,
      includeDeload: true,
    });
    expect(s).toBeNull();
  });
});

describe("progresja z samych powtórzeń (bez RIR/RPE)", () => {
  const range = { min: 8, max: 10 };
  const session = (over: Partial<RepsOnlySessionSnap> = {}): RepsOnlySessionSnap => ({
    topKg: 36,
    minRepsAtTop: 10,
    setsAtTop: 3,
    effortLogged: false,
    ...over,
  });

  it("2 treningi, wszystkie serie na górze zakresu → kwalifikuje", () => {
    expect(qualifiesRepsOnlyBump([session(), session()], range)).toBe(true);
  });

  it("jeden trening to za mało", () => {
    expect(qualifiesRepsOnlyBump([session()], range)).toBe(false);
  });

  it("jedna seria poniżej góry zakresu blokuje", () => {
    expect(
      qualifiesRepsOnlyBump([session({ minRepsAtTop: 9 }), session()], range),
    ).toBe(false);
  });

  it("realnie logowany RIR/RPE wyłącza ścieżkę (decyduje wysiłek)", () => {
    expect(
      qualifiesRepsOnlyBump([session({ effortLogged: true }), session()], range),
    ).toBe(false);
  });

  it("wymaga ≥ 2 serii roboczych na ciężarze top", () => {
    expect(
      qualifiesRepsOnlyBump([session({ setsAtTop: 1 }), session()], range),
    ).toBe(false);
  });

  it("zmiana ciężaru między treningami (> 2%) blokuje", () => {
    expect(
      qualifiesRepsOnlyBump([session(), session({ topKg: 30 })], range),
    ).toBe(false);
  });

  it("brak zakresu / historii → false", () => {
    expect(qualifiesRepsOnlyBump([session(), session()], null)).toBe(false);
    expect(qualifiesRepsOnlyBump(undefined, range)).toBe(false);
  });

  it("top of range bez RIR/RPE + flaga historii → +kg", () => {
    const s = buildSetProgressionSuggestion({
      last: { weight: 36, reps: 10 },
      targetReps: 10,
      repsOnlyBumpOk: true,
    });
    expect(s).not.toBeNull();
    expect(s!.kind).toBe("weight");
    expect(s!.weightKg).toBe(38.5);
    expect(s!.reps).toBe(8);
    expect(s!.rule).toBe("top_of_range_reps_only");
    expect(s!.fullText).toContain("2 treningi");
  });

  it("bez flagi historii ta sama seria → hold", () => {
    expect(
      buildSetProgressionSuggestion({
        last: { weight: 36, reps: 10 },
        targetReps: 10,
      }),
    ).toBeNull();
  });

  it("twarda seria albo konflikt blokują nawet przy fladze", () => {
    expect(
      buildSetProgressionSuggestion({
        last: { weight: 36, reps: 10, rir: 0 },
        targetReps: 10,
        repsOnlyBumpOk: true,
      })?.kind,
    ).not.toBe("weight");
    expect(
      buildSetProgressionSuggestion({
        last: { weight: 36, reps: 10, rir: 3, rpe: 10 },
        targetReps: 10,
        repsOnlyBumpOk: true,
      }),
    ).toBeNull();
  });

  it("flaga nie omija zasady „najpierw powtórzenia”", () => {
    const s = buildSetProgressionSuggestion({
      last: { weight: 36, reps: 8 },
      targetReps: 10,
      repsOnlyBumpOk: true,
    });
    expect(s!.kind).toBe("reps");
    expect(s!.weightKg).toBe(36);
  });
});

describe("krok ciężaru i deload zaokrąglony do kroku", () => {
  it("deload ląduje na ładowalnym ciężarze (62,5 → 60)", () => {
    expect(applyDeload(62.5)).toBe(60);
    expect(applyDeload(40)).toBe(37.5);
  });

  it("hantle co 2 kg: deload i dokładka zostają na wielokrotnościach 2", () => {
    expect(applyDeload(20, 2)).toBe(18);
    expect(applyDeload(100, 2)).toBe(94);
    expect(bumpWeightByPlate(20, 2)).toBe(22);
  });

  it("mikro-talerze: krok 1,25 nie jest zaokrąglany do 0,5", () => {
    expect(bumpWeightByPlate(36, 1.25)).toBe(37.25);
  });

  it("deload zawsze zdejmuje co najmniej jeden krok", () => {
    expect(applyDeload(10, 2.5)).toBe(7.5);
    expect(applyDeload(5, 5)).toBe(0);
  });

  it("dokładka z kroku ćwiczenia (hantle +2 kg)", () => {
    const s = buildSetProgressionSuggestion({
      last: { weight: 20, reps: 10, rir: 3 },
      priorSets: [{ weight: 20, reps: 10, rir: 3 }],
      targetReps: 10,
      exerciseName: "Wyciskanie hantli",
    });
    expect(s!.weightKg).toBe(22);
    expect(s!.deltaKg).toBe(2);
  });

  it("jawny krok ćwiczenia ma pierwszeństwo nad nazwą (stos maszyny +5)", () => {
    const s = buildSetProgressionSuggestion({
      last: { weight: 40, reps: 10, rir: 3 },
      priorSets: [{ weight: 40, reps: 10, rir: 3 }],
      targetReps: 10,
      exerciseName: "Wyciskanie hantli",
      weightStepKg: 5,
    });
    expect(s!.weightKg).toBe(45);
  });

  it("formatKgPl zachowuje ćwierćkilogramy (37,25)", () => {
    expect(formatKgPl(37.25)).toBe("37,25");
    expect(formatKgPl(38.5)).toBe("38,5");
    expect(formatKgPl(36)).toBe("36");
  });
});
