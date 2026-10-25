import { describe, expect, it } from "vitest";
import type { WorkoutExerciseState } from "@/components/workout/types";
import {
  canCompleteWorkoutSet,
  countIncompleteWorkoutSets,
  countSkippedWorkoutSets,
  findFirstSkippedWorkoutTarget,
  findNextIncompleteExercise,
  isCompletedWorkoutSet,
  isExerciseIncomplete,
  isLastOpenWorkoutSet,
  isSkippedWorkoutSet,
  resolveAdvanceAfterSet,
  resolveSkippedAfterEdit,
  resolveSetSaveIssue,
} from "@/lib/workout-skipped-sets";

function set(done: boolean, skipped = false) {
  return { reps: done ? 8 : null, weight: done ? 50 : 0, done, skipped };
}

describe("workout-skipped-sets", () => {
  it("wykrywa pominiętą serię po fladze i po pustym wykonaniu", () => {
    expect(
      isSkippedWorkoutSet({ done: true, skipped: true, reps: 8, weight: 50 }),
    ).toBe(true);
    expect(
      isSkippedWorkoutSet({ done: true, reps: null, weight: 0 }),
    ).toBe(true);
    expect(
      isSkippedWorkoutSet({ done: true, reps: 8, weight: 50 }),
    ).toBe(false);
  });

  it("zielone zaliczenie wymaga tylko powtórzeń > 0; 0 kg + powt. = masa ciała zaliczona (decyzja właściciela 005 p.7)", () => {
    expect(canCompleteWorkoutSet(0, 8)).toBe(true);
    expect(canCompleteWorkoutSet(60, null)).toBe(false);
    expect(canCompleteWorkoutSet(60, 8)).toBe(true);
    expect(
      isCompletedWorkoutSet({ done: true, reps: 8, weight: 60 }),
    ).toBe(true);
    expect(
      isCompletedWorkoutSet({ done: true, reps: 8, weight: 0 }),
    ).toBe(true);
    expect(
      isSkippedWorkoutSet({ done: true, reps: 8, weight: 0 }),
    ).toBe(false);
    expect(
      isSkippedWorkoutSet({ done: true, reps: null, weight: 0 }),
    ).toBe(true);
  });

  it("countIncompleteWorkoutSets liczy serie done=false, niezależnie od pominiętych", () => {
    const exercises: WorkoutExerciseState[] = [
      {
        id: "a",
        name: "Przysiad",
        sets: [
          { reps: 5, weight: 100, done: true, skipped: true },
          { reps: null, weight: 0, done: false },
        ],
      },
      {
        id: "b",
        name: "Pompki",
        sets: [{ reps: 12, weight: 0, done: true }],
      },
    ];
    expect(countIncompleteWorkoutSets(exercises)).toBe(1);
    expect(countSkippedWorkoutSets(exercises)).toBe(1);
  });

  it("isLastOpenWorkoutSet: true tylko gdy wszystkie inne serie są done", () => {
    const exercises: WorkoutExerciseState[] = [
      { id: "a", name: "Ćw. 1", sets: [set(true), set(false)] },
      { id: "b", name: "Ćw. 2", sets: [set(true)] },
    ];
    expect(isLastOpenWorkoutSet(exercises, "a", 1)).toBe(true);
    expect(isLastOpenWorkoutSet(exercises, "a", 0)).toBe(false);
  });

  it("liczy wiele pominiętych serii i wskazuje pierwszą", () => {
    const exercises: WorkoutExerciseState[] = [
      {
        id: "a",
        name: "Przysiad",
        sets: [
          { reps: 5, weight: 100, done: true, skipped: true },
          { reps: 5, weight: 100, done: true, skipped: true },
        ],
      },
      {
        id: "b",
        name: "Martwy ciąg",
        sets: [
          { reps: 5, weight: 120, done: true },
          { reps: 5, weight: 120, done: true, skipped: true },
        ],
      },
    ];
    expect(countSkippedWorkoutSets(exercises)).toBe(3);
    expect(findFirstSkippedWorkoutTarget(exercises)).toEqual({
      exerciseId: "a",
      exerciseName: "Przysiad",
      setIndex: 0,
    });
  });

  it("po ćwiczeniu 1 pomija już wykonane 2 i idzie do 3", () => {
    const exercises: WorkoutExerciseState[] = [
      { id: "1", name: "Ćw. 1", sets: [set(true)] },
      { id: "2", name: "Ćw. 2", sets: [set(true)] },
      { id: "3", name: "Ćw. 3", sets: [set(false)] },
      { id: "4", name: "Ćw. 4", sets: [set(true)] },
      { id: "5", name: "Ćw. 5", sets: [set(true)] },
      { id: "6", name: "Ćw. 6", sets: [set(true)] },
      { id: "7", name: "Ćw. 7", sets: [set(true)] },
    ];
    expect(isExerciseIncomplete(exercises[2]!)).toBe(true);
    expect(findNextIncompleteExercise(exercises, "1")?.id).toBe("3");
  });

  it("zawija do wcześniejszego niedokończonego ćwiczenia", () => {
    const exercises: WorkoutExerciseState[] = [
      { id: "1", name: "Ćw. 1", sets: [set(false)] },
      { id: "2", name: "Ćw. 2", sets: [set(true)] },
      { id: "3", name: "Ćw. 3", sets: [set(true)] },
    ];
    expect(findNextIncompleteExercise(exercises, "3")?.id).toBe("1");
  });

  it("zwraca null gdy wszystkie ćwiczenia są domknięte", () => {
    const exercises: WorkoutExerciseState[] = [
      { id: "1", name: "Ćw. 1", sets: [set(true)] },
      { id: "2", name: "Ćw. 2", sets: [set(true)] },
    ];
    expect(findNextIncompleteExercise(exercises, "1")).toBeNull();
  });

  it("resolveAdvanceAfterSet: kolejna seria w tym samym ćwiczeniu", () => {
    const exercises: WorkoutExerciseState[] = [
      {
        id: "a",
        name: "Przysiad",
        sets: [
          { reps: 5, weight: 100, done: true, skipped: true },
          { reps: 5, weight: 100, done: false },
          { reps: 5, weight: 100, done: false },
        ],
      },
    ];
    expect(resolveAdvanceAfterSet(exercises, "a", 0)).toEqual({
      exerciseId: "a",
      setIndex: 1,
    });
  });

  it("resolveAdvanceAfterSet: po ostatniej serii idzie do następnego niedokończonego", () => {
    const exercises: WorkoutExerciseState[] = [
      {
        id: "a",
        name: "Przysiad",
        sets: [
          { reps: 5, weight: 100, done: true },
          { reps: 5, weight: 100, done: true, skipped: true },
        ],
      },
      {
        id: "b",
        name: "Martwy",
        sets: [{ reps: 5, weight: 120, done: false }],
      },
    ];
    expect(resolveAdvanceAfterSet(exercises, "a", 1)).toEqual({
      exerciseId: "b",
      setIndex: 0,
    });
  });

  it("resolveAdvanceAfterSet: stale-bug — po pominięciu ostatniej nie wraca do siebie", () => {
    const exercises: WorkoutExerciseState[] = [
      {
        id: "a",
        name: "Przysiad",
        sets: [
          { reps: 5, weight: 100, done: true },
          { reps: 5, weight: 100, done: true, skipped: true },
        ],
      },
      {
        id: "b",
        name: "Wyciskanie",
        sets: [
          { reps: 8, weight: 60, done: false },
          { reps: 8, weight: 60, done: false },
        ],
      },
    ];
    // Świeży stan: a domknięte — musi wskazać b, nie a.
    expect(resolveAdvanceAfterSet(exercises, "a", 1)?.exerciseId).toBe("b");
  });

  it("resolveAdvanceAfterSet: domknięcie środkowej serii gdy późniejsze już done → null", () => {
    const exercises: WorkoutExerciseState[] = [
      {
        id: "a",
        name: "Przysiad",
        sets: [
          { reps: 5, weight: 100, done: true },
          { reps: 5, weight: 100, done: true },
          { reps: 5, weight: 100, done: true },
        ],
      },
      {
        id: "b",
        name: "Martwy",
        sets: [{ reps: 5, weight: 120, done: true }],
      },
    ];
    // Ostatnia otwarta była seria 1; po patchu wszystko done — koniec treningu.
    expect(resolveAdvanceAfterSet(exercises, "a", 1)).toBeNull();
  });

  it("resolveAdvanceAfterSet: pomija już zaliczone serie po bieżącej", () => {
    const exercises: WorkoutExerciseState[] = [
      {
        id: "a",
        name: "Przysiad",
        sets: [
          { reps: 5, weight: 100, done: true },
          { reps: 5, weight: 100, done: false },
          { reps: 5, weight: 100, done: true },
        ],
      },
    ];
    expect(resolveAdvanceAfterSet(exercises, "a", 0)).toEqual({
      exerciseId: "a",
      setIndex: 1,
    });
  });

  it("resolveSetSaveIssue: tylko powtórzenia blokują zaliczenie (ciężar nigdy)", () => {
    expect(resolveSetSaveIssue(0, 8)).toBeNull();
    expect(resolveSetSaveIssue(Number.NaN, 8)).toBeNull();
    expect(resolveSetSaveIssue(50, null)).toBe("reps");
    expect(resolveSetSaveIssue(50, 0)).toBe("reps");
    expect(resolveSetSaveIssue(0, null)).toBe("reps");
    expect(resolveSetSaveIssue(61.25, 8)).toBeNull();
  });

  it("canCompleteWorkoutSet zgodne z resolveSetSaveIssue", () => {
    const cases: Array<[number, number | null]> = [
      [0, 8],
      [50, null],
      [0, null],
      [50, 0],
      [50, 8],
      [-1, 8],
    ];
    for (const [w, r] of cases) {
      expect(canCompleteWorkoutSet(w, r)).toBe(resolveSetSaveIssue(w, r) === null);
    }
  });

  // 005 P2 / AC-2.2 / BR-7 / E-4: trening złożony wyłącznie z serii na masę ciała nie może
  // wywołać dialogu pominiętych (requestFinish warunkuje dialog na skippedCount + incompleteCount).
  it("trening tylko z serii na masę ciała: zero pominiętych i niewykonanych, brak celu dialogu", () => {
    const exercises: WorkoutExerciseState[] = [
      { id: "p", name: "Pompki", sets: [{ reps: 12, weight: 0, done: true }, { reps: 10, weight: 0, done: true }] },
      { id: "s", name: "Podciąganie", sets: [{ reps: 6, weight: 0, done: true, skipped: false }] },
    ];
    expect(countSkippedWorkoutSets(exercises)).toBe(0);
    expect(countIncompleteWorkoutSets(exercises)).toBe(0);
    expect(findFirstSkippedWorkoutTarget(exercises)).toBeNull();
  });

  it("seria na masę ciała z jawnym „Pomiń” nadal liczy się jako pominięta", () => {
    const exercises: WorkoutExerciseState[] = [
      { id: "p", name: "Pompki", sets: [{ reps: 12, weight: 0, done: true, skipped: true }] },
    ];
    expect(countSkippedWorkoutSets(exercises)).toBe(1);
    expect(findFirstSkippedWorkoutTarget(exercises)?.exerciseId).toBe("p");
  });
});

describe("resolveSkippedAfterEdit (edycja zapisanej serii)", () => {
  const saved = { weight: 60, reps: 8, done: true };

  it("zapisana → wyczyść ciężar z powtórzeniami ⇒ wciąż zapisana (masa ciała, decyzja 005 p.7)", () => {
    const cleared = resolveSkippedAfterEdit(saved, { weight: 0 });
    expect(cleared).toBe(false);
    const afterClear = { weight: 0, reps: 8, done: true };
    expect(resolveSkippedAfterEdit(afterClear, { weight: 62.5 })).toBe(false);
  });

  it("wyczyszczenie powtórzeń ⇒ pominięta (ciężar nie wystarcza bez powtórzeń)", () => {
    expect(resolveSkippedAfterEdit(saved, { reps: null })).toBe(true);
  });

  it("pominięta seria bez nowych danych pozostaje pominięta", () => {
    const skipped = { weight: 0, reps: null, done: true };
    expect(resolveSkippedAfterEdit(skipped, { weight: 0 })).toBe(true);
    expect(resolveSkippedAfterEdit(skipped, { rir: 1 } as never)).toBeUndefined();
  });

  it("nie dotyka serii niezaliczonej ani jawnego skipped", () => {
    expect(resolveSkippedAfterEdit({ weight: 0, reps: null, done: false }, { weight: 50 })).toBeUndefined();
    expect(resolveSkippedAfterEdit(saved, { weight: 0, skipped: true })).toBeUndefined();
  });
});
