import type { WorkoutExerciseState } from "@/components/workout/types";

export type SkippedWorkoutTarget = {
  exerciseId: string;
  exerciseName: string;
  setIndex: number;
};

/** Seria z powtórzeniami — ciężar 0 = masa ciała (pompki, podciąganie, plank…). */
export function hasPerformedReps(reps: number | null | undefined): boolean {
  return reps != null && Number.isFinite(reps) && reps > 0;
}

/** Seria z dodatkowym obciążeniem (kg). */
export function hasExternalWeight(weight: number | null | undefined): boolean {
  return weight != null && Number.isFinite(weight) && weight > 0;
}

/**
 * Seria zaliczona bez realnego wykonania (flaga pomiń albo brak powtórzeń).
 * Decyzja właściciela (005, p.7 / ADR 0004 p.6): 0 kg + powtórzenia > 0 (masa ciała)
 * jest ZALICZONA, nie pominięta. Ciężar nigdy nie blokuje zaliczenia.
 */
export function isSkippedWorkoutSet(set: {
  done: boolean;
  skipped?: boolean;
  reps: number | null;
  weight: number;
}): boolean {
  if (!set.done) return false;
  if (set.skipped) return true;
  return !hasPerformedReps(set.reps);
}

/** Prawdziwie wykonana seria (zielona kropka) — nie pominięta, z ciężarem i powtórzeniami. */
export function isCompletedWorkoutSet(set: {
  done: boolean;
  skipped?: boolean;
  reps: number | null;
  weight: number;
}): boolean {
  return set.done && !isSkippedWorkoutSet(set);
}

export type SetSaveIssue = "reps";

/**
 * BR-8 / P-2 (po decyzji właściciela 005 p.7): zapis serii wymaga tylko powtórzeń > 0.
 * Ciężar 0 kg jest poprawny (masa ciała) i nigdy nie blokuje zaliczenia. null = dane kompletne.
 */
export function resolveSetSaveIssue(
  weight: number,
  reps: number | null,
): SetSaveIssue | null {
  if (!hasPerformedReps(reps)) return "reps";
  return null;
}

/**
 * Czy dane wystarczą do zielonego zaliczenia (nie pominięcia).
 * Ta sama reguła co `resolveSetSaveIssue` — przy niekompletnych danych UI pokazuje
 * komunikat walidacji zamiast zapisu.
 */
export function canCompleteWorkoutSet(weight: number, reps: number | null): boolean {
  return resolveSetSaveIssue(weight, reps) === null;
}

/**
 * Edycja wartości serii już zaliczonej (done): flaga `skipped` wynika z danych.
 * Komplet (ciężar > 0 i powtórzenia > 0) = zapisana, brak ciężaru lub powtórzeń = pominięta.
 * undefined = patch nie dotyka wartości albo seria nie jest zaliczona (flaga bez zmian).
 */
export function resolveSkippedAfterEdit(
  current: { weight: number; reps: number | null; done: boolean } | undefined,
  patch: { weight?: number; reps?: number | null; done?: boolean; skipped?: boolean },
): boolean | undefined {
  if (!current?.done || patch.done === false || patch.skipped !== undefined) return undefined;
  if (patch.weight === undefined && patch.reps === undefined) return undefined;
  const weight = patch.weight !== undefined ? patch.weight : current.weight;
  const reps = patch.reps !== undefined ? patch.reps : current.reps;
  return !canCompleteWorkoutSet(weight, reps);
}

/**
 * Pierwsza pominięta seria albo pierwsze niedokończone ćwiczenie —
 * do powrotu z dialogu „wszystkie serie”.
 */
export function findFirstSkippedWorkoutTarget(
  exercises: WorkoutExerciseState[],
): SkippedWorkoutTarget | null {
  for (const ex of exercises) {
    for (let i = 0; i < ex.sets.length; i++) {
      const s = ex.sets[i]!;
      if (isSkippedWorkoutSet(s)) {
        return {
          exerciseId: ex.id,
          exerciseName: ex.name,
          setIndex: i,
        };
      }
    }
  }
  for (const ex of exercises) {
    const setIndex = ex.sets.findIndex((s) => !s.done);
    if (setIndex >= 0) {
      return {
        exerciseId: ex.id,
        exerciseName: ex.name,
        setIndex,
      };
    }
  }
  return null;
}

export function countSkippedWorkoutSets(exercises: WorkoutExerciseState[]): number {
  let n = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (isSkippedWorkoutSet(s)) n += 1;
    }
  }
  return n;
}

/** Serie jeszcze niewykonane (done=false) — osobny licznik od pominiętych (ADR 0004 p.4/6). */
export function countIncompleteWorkoutSets(exercises: WorkoutExerciseState[]): number {
  let n = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (!s.done) n += 1;
    }
  }
  return n;
}

/**
 * Czy `exerciseId`/`setIndex` jest ostatnią jeszcze otwartą (niezaliczoną) serią całej
 * sesji — do etykiety „Zakończ ostatnią serię i zapisz” (005, sekcja 4) liczonej
 * PRZED zapisem tej serii (wszystkie inne serie muszą być już `done`).
 */
export function isLastOpenWorkoutSet(
  exercises: WorkoutExerciseState[],
  exerciseId: string,
  setIndex: number,
): boolean {
  for (const ex of exercises) {
    for (let i = 0; i < ex.sets.length; i++) {
      if (ex.id === exerciseId && i === setIndex) continue;
      if (!ex.sets[i]!.done) return false;
    }
  }
  return true;
}

/** Ćwiczenie z co najmniej jedną serią jeszcze niezaliczoną (done=false). */
export function isExerciseIncomplete(ex: WorkoutExerciseState): boolean {
  return ex.sets.some((s) => !s.done);
}

/**
 * Następne niedokończone ćwiczenie po `afterExerciseId` (kolejność planu, z zawinięciem).
 * Pomija ćwiczenia, w których wszystkie serie mają już done=true.
 */
export function findNextIncompleteExercise(
  exercises: WorkoutExerciseState[],
  afterExerciseId: string,
): WorkoutExerciseState | null {
  if (exercises.length === 0) return null;
  const startIdx = exercises.findIndex((e) => e.id === afterExerciseId);
  const from = startIdx >= 0 ? startIdx + 1 : 0;
  for (let offset = 0; offset < exercises.length; offset++) {
    const i = (from + offset) % exercises.length;
    if (startIdx >= 0 && i === startIdx) continue;
    const ex = exercises[i]!;
    if (isExerciseIncomplete(ex)) return ex;
  }
  return null;
}

export type AdvanceAfterSetTarget = {
  exerciseId: string;
  setIndex: number;
};

/**
 * Dokąd przejść po zaliczeniu / pominięciu serii.
 * Wymaga **świeżego** stanu exercises (po patchu) — inaczej zostajesz na domkniętym ćwiczeniu.
 * Pomija serie już z `done=true` (kolejność poza sekwencją / domknięcie „środkowej” ostatniej otwartej).
 */
export function resolveAdvanceAfterSet(
  exercises: WorkoutExerciseState[],
  exerciseId: string,
  setIndex: number,
): AdvanceAfterSetTarget | null {
  const ex = exercises.find((e) => e.id === exerciseId);
  if (!ex) return null;

  for (let i = setIndex + 1; i < ex.sets.length; i++) {
    if (!ex.sets[i]!.done) {
      return { exerciseId, setIndex: i };
    }
  }

  // Wcześniejsza otwarta seria w tym samym ćwiczeniu (poza kolejnością).
  const stillOpen = ex.sets.findIndex((s) => !s.done);
  if (stillOpen >= 0) {
    return { exerciseId, setIndex: stillOpen };
  }

  const nextEx = findNextIncompleteExercise(exercises, exerciseId);
  if (!nextEx) return null;
  const open = nextEx.sets.findIndex((s) => !s.done);
  return {
    exerciseId: nextEx.id,
    setIndex: open >= 0 ? open : 0,
  };
}
