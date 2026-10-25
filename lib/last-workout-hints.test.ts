import { describe, expect, it } from "vitest";
import type {
  ExerciseCoachContext,
  ExerciseRecentSessionSnap,
  WorkoutExerciseState,
} from "@/components/workout/types";
import {
  mergeHintsIntoExercises,
  roundToPlateStep,
  suggestWeightFromLastSet,
  type LastPlanHintsMap,
} from "@/lib/last-workout-hints";

function snap(over: Partial<ExerciseRecentSessionSnap> = {}): ExerciseRecentSessionSnap {
  return {
    topKg: 36,
    bestReps: 10,
    bestE1rm: 48,
    avgRir: null,
    volumeKg: 1080,
    minRepsAtTop: 10,
    setsAtTop: 3,
    effortLogged: false,
    ...over,
  };
}

function hints(
  sets: Array<{ reps: number; weight: number; rir?: number | null; rpe?: number | null }>,
  recent: ExerciseRecentSessionSnap[],
): LastPlanHintsMap {
  const coachContext: ExerciseCoachContext = {
    daysSinceLastSession: 3,
    recentSessionCount: recent.length,
    avgTopSetWeightKg: 36,
    stagnant: false,
    recentSessions: recent,
  };
  return {
    e1: {
      sets: sets.map((s) => ({ done: true, ...s })),
      coachContext,
    },
  };
}

function exercise(over: Partial<WorkoutExerciseState> = {}): WorkoutExerciseState {
  return {
    id: "e1",
    name: "Incline Barbell Press",
    targetReps: 10,
    targetRir: 1,
    sets: [
      { reps: null, weight: 0, done: false },
      { reps: null, weight: 0, done: false },
    ],
    ...over,
  };
}

const threeAtTop = [
  { reps: 10, weight: 36 },
  { reps: 10, weight: 36 },
  { reps: 10, weight: 36 },
];

describe("last-workout-hints — chipy ciężaru", () => {
  it("roundToPlateStep jest nadal dostępne z tego modułu (jedno źródło)", () => {
    expect(roundToPlateStep(36, 2.5)).toBe(35);
    expect(roundToPlateStep(37, 2.5)).toBe(37.5);
    expect(roundToPlateStep(0)).toBe(0);
  });

  it("RIR 2 × 2 na górze zakresu → chip z dokładką", () => {
    const w = suggestWeightFromLastSet(
      { weight: 36, reps: 10, rir: 2 },
      10,
      { priorSets: [{ weight: 36, reps: 10, rir: 2 }] },
    );
    expect(w).toBe(38.5);
  });

  it("hold zachowuje ciężar roboczy (bez ściągania do pełnych talerzy)", () => {
    expect(suggestWeightFromLastSet({ weight: 36, reps: 9, rir: 0 }, 10)).toBe(36);
    expect(suggestWeightFromLastSet({ weight: 37.25, reps: 10 }, 10)).toBe(37.25);
  });

  it("hantle: chip rośnie o 2 kg", () => {
    const w = suggestWeightFromLastSet(
      { weight: 20, reps: 10, rir: 3 },
      10,
      {
        exerciseName: "Wyciskanie hantli",
        priorSets: [{ weight: 20, reps: 10, rir: 3 }],
      },
    );
    expect(w).toBe(22);
  });
});

describe("last-workout-hints — mergeHintsIntoExercises", () => {
  it("2 treningi ze wszystkimi seriami na górze, bez RIR/RPE → chip +kg", () => {
    const [out] = mergeHintsIntoExercises(
      [exercise()],
      hints(threeAtTop, [snap(), snap()]),
    );
    expect(out!.suggestedWeights).toEqual([38.5, 38.5]);
  });

  it("jeden taki trening → chip utrzymuje ciężar", () => {
    const [out] = mergeHintsIntoExercises(
      [exercise()],
      hints(threeAtTop, [snap()]),
    );
    expect(out!.suggestedWeights).toEqual([36, 36]);
  });

  it("realnie logowany wysiłek w jednej z sesji wyłącza ścieżkę z powtórzeń", () => {
    const [out] = mergeHintsIntoExercises(
      [exercise()],
      hints(threeAtTop, [snap({ effortLogged: true }), snap()]),
    );
    expect(out!.suggestedWeights).toEqual([36, 36]);
  });

  it("seria poniżej góry zakresu w historii → bez dokładki", () => {
    const [out] = mergeHintsIntoExercises(
      [exercise()],
      hints(threeAtTop, [snap({ minRepsAtTop: 9 }), snap()]),
    );
    expect(out!.suggestedWeights?.[0]).toBe(36);
  });

  it("twarda ostatnia seria (RIR 0) nie jest przykryta ścieżką z powtórzeń", () => {
    const [out] = mergeHintsIntoExercises(
      [exercise()],
      hints(
        [
          { reps: 10, weight: 36 },
          { reps: 10, weight: 36 },
          { reps: 10, weight: 36, rir: 0 },
        ],
        [snap(), snap()],
      ),
    );
    // chip pierwszej serii patrzy na ostatnią serię bloku — do upadku, więc hold
    expect(out!.suggestedWeights?.[0]).toBe(36);
  });

  it("jawny krok ćwiczenia (maszyna +5) trafia do chipa", () => {
    const [out] = mergeHintsIntoExercises(
      [exercise({ weightStepKg: 5 })],
      hints(threeAtTop, [snap(), snap()]),
    );
    expect(out!.suggestedWeights?.[0]).toBe(41);
  });

  it("ćwiczenie bez historii zostaje bez zmian", () => {
    const ex = exercise({ id: "inne" });
    const [out] = mergeHintsIntoExercises([ex], hints(threeAtTop, [snap(), snap()]));
    expect(out).toBe(ex);
  });

  it("V-2: niezapisana wartość początkowa (done: false) nie wpływa na podpowiedź kolejnego treningu", () => {
    const hintsMap: LastPlanHintsMap = {
      e1: {
        sets: [
          { reps: 10, weight: 36, done: true },
          { reps: 10, weight: 36, done: true },
          // Seria niezaliczona — wartość z pola to tylko podpowiedź/draft,
          // użytkownik jej nie potwierdził. Nie może zasilać kolejnej sugestii.
          { reps: 20, weight: 999, done: false },
        ],
        coachContext: {
          daysSinceLastSession: 3,
          recentSessionCount: 1,
          avgTopSetWeightKg: 36,
          stagnant: false,
          recentSessions: [snap()],
        },
      },
    };
    const [out] = mergeHintsIntoExercises([exercise()], hintsMap);
    // lastSessionSets nie zawiera draftu 999 kg / 20 powtórzeń.
    expect(out!.lastSessionSets?.every((s) => s == null || s.weight !== 999)).toBe(
      true,
    );
    // Sugestia liczona tylko z dwóch zaliczonych serii (bez draftu).
    expect(out!.suggestedWeights).toEqual([36, 36]);
  });
});
