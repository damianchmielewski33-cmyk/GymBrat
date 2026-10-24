import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkoutExerciseState } from "@/components/workout/types";
import type { LiveCoachTip } from "@/lib/live-set-coach";

const tipMock = vi.hoisted(() => ({
  buildLiveCoachTipForOpenSet: vi.fn(),
}));
vi.mock("@/lib/live-set-coach", () => tipMock);

import {
  buildSetSuggestionView,
  resolveSuggestionDirection,
} from "@/lib/set-suggestion-view";

function tip(
  apply: LiveCoachTip["apply"],
  reason = "Ostatnio lekko",
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
      reason: "Ostatnio lekko",
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

  it("pusty powód porady -> null", () => {
    tipMock.buildLiveCoachTipForOpenSet.mockReturnValue(
      tip({ weightKg: 50, reps: 8 }, "  "),
    );
    expect(buildSetSuggestionView(exercise(), 0)?.reason).toBeNull();
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
