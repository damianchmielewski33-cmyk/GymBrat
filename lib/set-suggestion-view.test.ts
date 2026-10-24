import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkoutExerciseState } from "@/components/workout/types";
import type { LiveCoachTip } from "@/lib/live-set-coach";

const tipMock = vi.hoisted(() => ({
  buildLiveCoachTipForOpenSet: vi.fn(),
}));
vi.mock("@/lib/live-set-coach", () => tipMock);

import { SET_PROGRESSION_RULES } from "@/lib/set-progression-suggestion";
import {
  buildSetSuggestionView,
  DEFAULT_SUGGESTION_REASON,
  resolveSuggestionDirection,
  suggestionReasonForRule,
  type SuggestionDirection,
} from "@/lib/set-suggestion-view";

function tip(
  apply: LiveCoachTip["apply"],
  reason = "Ostatnio lekko",
  rule?: string,
): LiveCoachTip {
  return {
    id: "t",
    tone: "progress",
    body: "",
    prefix: "",
    highlight: null,
    suffix: "",
    apply,
    decision: "",
    reason,
    readiness: 0,
    confidence: 0,
    rule,
  };
}

function exercise(
  over: Partial<WorkoutExerciseState> = {},
): WorkoutExerciseState {
  return {
    id: "a",
    name: "Wyciskanie",
    sets: [
      { reps: 8, weight: 0, done: false },
      { reps: 8, weight: 0, done: false },
    ],
    ...over,
  };
}

beforeEach(() => {
  tipMock.buildLiveCoachTipForOpenSet.mockReset();
  tipMock.buildLiveCoachTipForOpenSet.mockReturnValue(null);
});

describe("resolveSuggestionDirection", () => {
  it("up / down / hold z porównania ciężarów", () => {
    expect(resolveSuggestionDirection(70, 65)).toBe("up");
    expect(resolveSuggestionDirection(60, 65)).toBe("down");
    expect(resolveSuggestionDirection(65, 65)).toBe("hold");
    expect(resolveSuggestionDirection(65.005, 65)).toBe("hold");
    expect(resolveSuggestionDirection(61.25, 61.24)).toBe("hold");
    expect(resolveSuggestionDirection(61.25, 61)).toBe("up");
  });

  it("brak odniesienia -> hold", () => {
    expect(resolveSuggestionDirection(70, null)).toBe("hold");
    expect(resolveSuggestionDirection(70, undefined)).toBe("hold");
    expect(resolveSuggestionDirection(70, 0)).toBe("hold");
    expect(resolveSuggestionDirection(70, -5)).toBe("hold");
    expect(resolveSuggestionDirection(70, Number.NaN)).toBe("hold");
  });
});

describe("buildSetSuggestionView", () => {
  it("Live Coach ma pierwszeństwo przed suggestedWeights; kierunek up", () => {
    tipMock.buildLiveCoachTipForOpenSet.mockReturnValue(
      tip({ weightKg: 70, reps: 8 }),
    );
    const ex = exercise({
      suggestedWeights: [67.5, 67.5],
      lastSessionSets: [{ reps: 8, weight: 65, done: true }, null],
    });
    expect(buildSetSuggestionView(ex, 0)).toEqual({
      weightKg: 70,
      reps: 8,
      direction: "up",
      deltaKg: 5,
      referenceKg: 65,
      reason: DEFAULT_SUGGESTION_REASON,
      rule: null,
      source: "liveCoach",
    });
    expect(tipMock.buildLiveCoachTipForOpenSet).toHaveBeenCalledWith(ex, 0);
  });

  it("deload (kind=reps, deltaKg=0 w silniku) z niższym ciężarem -> down", () => {
    tipMock.buildLiveCoachTipForOpenSet.mockReturnValue(
      tip({ weightKg: 58.75, reps: 10 }),
    );
    const ex = exercise({
      lastSessionSets: [{ reps: 8, weight: 65, done: true }],
    });
    const view = buildSetSuggestionView(ex, 0);
    expect(view?.direction).toBe("down");
    expect(view?.deltaKg).toBe(-6.25);
  });

  it("równy ciężar -> hold z deltaKg 0", () => {
    tipMock.buildLiveCoachTipForOpenSet.mockReturnValue(
      tip({ weightKg: 65, reps: 8 }),
    );
    const ex = exercise({
      lastSessionSets: [{ reps: 8, weight: 65, done: true }],
    });
    const view = buildSetSuggestionView(ex, 0);
    expect(view?.direction).toBe("hold");
    expect(view?.deltaKg).toBe(0);
  });

  it("bez porady: suggestedWeights, reps i reason null; brak odniesienia -> hold", () => {
    expect(
      buildSetSuggestionView(exercise({ suggestedWeights: [null, 62.5] }), 1),
    ).toEqual({
      weightKg: 62.5,
      reps: null,
      direction: "hold",
      deltaKg: 0,
      referenceKg: null,
      reason: null,
      rule: null,
      source: "progression",
    });
  });

  it("porada bez apply albo z 0 kg przechodzi do suggestedWeights", () => {
    tipMock.buildLiveCoachTipForOpenSet.mockReturnValue(
      tip({ weightKg: 0, reps: 8 }),
    );
    expect(
      buildSetSuggestionView(exercise({ suggestedWeights: [50] }), 0)?.source,
    ).toBe("progression");
    tipMock.buildLiveCoachTipForOpenSet.mockReturnValue(tip(null));
    expect(
      buildSetSuggestionView(exercise({ suggestedWeights: [50] }), 0)?.weightKg,
    ).toBe(50);
  });

  it("surowy tekst silnika nigdy nie trafia do widoku; reguła jest przekazana", () => {
    tipMock.buildLiveCoachTipForOpenSet.mockReturnValue(
      tip(
        { weightKg: 60, reps: 8 },
        "sprzeczny RIR/RPE — nie ufamy danym",
        "layoff_reduce",
      ),
    );
    const view = buildSetSuggestionView(
      exercise({ lastSessionSets: [{ reps: 8, weight: 65, done: true }] }),
      0,
    );
    expect(view?.rule).toBe("layoff_reduce");
    expect(view?.reason).toBe("lżej po dłuższej przerwie");
  });

  it("hold + in_range_add_reps: powód bez duplikatu „ten sam ciężar”", () => {
    tipMock.buildLiveCoachTipForOpenSet.mockReturnValue(
      tip({ weightKg: 65, reps: 9 }, "stabilny blok — ten sam ciężar", "in_range_add_reps"),
    );
    const view = buildSetSuggestionView(
      exercise({ lastSessionSets: [{ reps: 8, weight: 65, done: true }] }),
      0,
    );
    expect(view?.direction).toBe("hold");
    expect(view?.reason).toBe("+1 powt.");
    expect(view?.reason).not.toMatch(/ten sam/i);
  });

  it("pusta / nieznana reguła -> neutralny tekst domyślny", () => {
    for (const rule of ["  ", "nieznana", "constructor", undefined]) {
      tipMock.buildLiveCoachTipForOpenSet.mockReturnValue(
        tip({ weightKg: 50, reps: 8 }, "ostatnia sesja bardzo twarda", rule),
      );
      expect(buildSetSuggestionView(exercise(), 0)?.reason).toBe(
        DEFAULT_SUGGESTION_REASON,
      );
    }
  });

  it("brak sugestii -> null (suggestedWeights 0 / null / brak)", () => {
    expect(buildSetSuggestionView(exercise(), 0)).toBeNull();
    expect(
      buildSetSuggestionView(exercise({ suggestedWeights: [0, null] }), 0),
    ).toBeNull();
    expect(
      buildSetSuggestionView(exercise({ suggestedWeights: [0, null] }), 1),
    ).toBeNull();
  });

  it("indeks poza zakresem -> null bez wołania Live Coach", () => {
    expect(
      buildSetSuggestionView(exercise({ suggestedWeights: [50] }), 5),
    ).toBeNull();
    expect(buildSetSuggestionView(exercise(), -1)).toBeNull();
    expect(tipMock.buildLiveCoachTipForOpenSet).not.toHaveBeenCalled();
  });

  it("inne ćwiczenie używa danych tego ćwiczenia", () => {
    const a = exercise({
      id: "a",
      suggestedWeights: [100],
      lastSessionSets: [{ reps: 5, weight: 95, done: true }],
    });
    const b = exercise({
      id: "b",
      suggestedWeights: [20],
      lastSessionSets: [{ reps: 12, weight: 22, done: true }],
    });
    expect(buildSetSuggestionView(a, 0)?.direction).toBe("up");
    const view = buildSetSuggestionView(b, 0);
    expect(view?.weightKg).toBe(20);
    expect(view?.referenceKg).toBe(22);
    expect(view?.direction).toBe("down");
  });
});

describe("resolveSuggestionDirection: właściwości i wartości brzegowe (zadanie 004, tester)", () => {
  it("antysymetria: zamiana ciężarów odwraca kierunek (poza tolerancją)", () => {
    const opposite = { up: "down", down: "up", hold: "hold" } as const;
    for (let a = 0.5; a <= 300; a += 7.25) {
      for (let b = 0.5; b <= 300; b += 11.5) {
        expect(resolveSuggestionDirection(a, b)).toBe(
          opposite[resolveSuggestionDirection(b, a)],
        );
      }
    }
  });

  it("tolerancja 0,01 kg: różnica 0,01 to hold, 0,02 to zmiana", () => {
    expect(resolveSuggestionDirection(65.01, 65)).toBe("hold");
    expect(resolveSuggestionDirection(64.99, 65)).toBe("hold");
    expect(resolveSuggestionDirection(65.02, 65)).toBe("up");
    expect(resolveSuggestionDirection(64.98, 65)).toBe("down");
  });

  it("wartości skrajne i nieprawidłowe: NaN, Infinity, ujemne odniesienie, bardzo duże liczby", () => {
    expect(resolveSuggestionDirection(Number.NaN, 65)).toBe("hold");
    expect(resolveSuggestionDirection(Number.POSITIVE_INFINITY, 65)).toBe("hold");
    expect(resolveSuggestionDirection(70, -5)).toBe("hold");
    expect(resolveSuggestionDirection(70, 0)).toBe("hold");
    expect(resolveSuggestionDirection(999, 998.5)).toBe("up");
  });
});

describe("suggestionReasonForRule (zadanie 004, LR-4/LR-5)", () => {
  const directions: SuggestionDirection[] = ["up", "down", "hold"];
  const forbidden = /nie ufamy|twarda|twardy|uwaga|porażk|stagnacj|zejdź|ostrzeż|\p{Extended_Pictographic}|!/iu;

  it("każda reguła silnika ma własny powód w co najmniej jednym kierunku", () => {
    for (const rule of SET_PROGRESSION_RULES) {
      const texts = directions.map((d) => suggestionReasonForRule(rule, d));
      expect(
        texts.some((t) => t !== DEFAULT_SUGGESTION_REASON),
        rule,
      ).toBe(true);
    }
  });

  it("żaden tekst nie zawiera zakazanych słów, emoji ani nie jest pusty", () => {
    const rules = [...SET_PROGRESSION_RULES, "nieznana", null, undefined, ""];
    for (const rule of rules) {
      for (const d of directions) {
        const t = suggestionReasonForRule(rule, d);
        expect(t.trim().length).toBeGreaterThan(0);
        expect(t).not.toMatch(forbidden);
      }
    }
  });

  it("hold nie powtarza etykiety „ten sam ciężar”", () => {
    for (const rule of [...SET_PROGRESSION_RULES, "nieznana", null]) {
      expect(suggestionReasonForRule(rule, "hold")).not.toMatch(/ten sam/i);
    }
  });

  it("powód nie przeczy kierunkowi: „lżej” tylko przy down", () => {
    for (const rule of SET_PROGRESSION_RULES) {
      for (const d of ["up", "hold"] as const) {
        expect(suggestionReasonForRule(rule, d)).not.toMatch(/lżej/);
      }
    }
  });

  it("nieznana reguła i prototypowe klucze -> tekst domyślny", () => {
    for (const rule of ["x", "toString", "__proto__", null, undefined]) {
      expect(suggestionReasonForRule(rule, "up")).toBe(DEFAULT_SUGGESTION_REASON);
    }
  });
});
