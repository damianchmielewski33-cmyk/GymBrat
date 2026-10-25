/**
 * Druga linia pod wierszem ćwiczenia na ekranie „Trening zakończony” (005, sekcja 8.5):
 * wszystkie serie w kolejności, nie tylko najlepsza — żeby pominięte i niewykonane serie
 * były widoczne, nie tylko ukryte w sumie tonażu.
 */
import type { WorkoutExerciseState } from "@/components/workout/types";
import { formatKgPl } from "@/lib/set-progression-suggestion";
import { isCountedPerformedSet } from "@/lib/workout-session-calculations";
import { isSkippedWorkoutSet } from "@/lib/workout-skipped-sets";

export type SetLineState = "best" | "done" | "skipped" | "incomplete";

export type SetLineEntry = {
  ordinal: number;
  /** „80×8”, „12 powt.”, „pominięta”, „niewykonana” — bez jednostki kg (jest w linii 1). */
  label: string;
  state: SetLineState;
};

/**
 * Indeks najlepszej serii ćwiczenia wg tej samej reguły co `bestSetsFromSession`
 * (e1RM dla serii z obciążeniem, najwięcej powtórzeń dla masy ciała). `null` = brak
 * zaliczonej serii w ćwiczeniu.
 */
export function bestSetIndexInExercise(
  sets: WorkoutExerciseState["sets"],
  estimated1RM: (weight: number, reps: number) => number,
): number | null {
  let bestIndex: number | null = null;
  let bestWeightedE1rm = -1;
  let bestBodyweightReps = -1;
  let anyWeighted = false;
  sets.forEach((s, i) => {
    if (!isCountedPerformedSet(s)) return;
    const reps = s.reps;
    if (reps == null || !(reps > 0)) return;
    if (s.weight > 0) {
      anyWeighted = true;
      const e1rm = estimated1RM(s.weight, reps);
      if (e1rm > bestWeightedE1rm) {
        bestWeightedE1rm = e1rm;
        bestIndex = i;
      }
    } else if (!anyWeighted && reps > bestBodyweightReps) {
      bestBodyweightReps = reps;
      bestIndex = i;
    }
  });
  return bestIndex;
}

export function allSetsLineFromSession(
  sets: WorkoutExerciseState["sets"],
  estimated1RM: (weight: number, reps: number) => number,
): SetLineEntry[] {
  const bestIndex = bestSetIndexInExercise(sets, estimated1RM);
  return sets.map((s, i) => {
    const ordinal = i + 1;
    if (isSkippedWorkoutSet(s)) {
      return { ordinal, label: "pominięta", state: "skipped" };
    }
    if (!s.done) {
      return { ordinal, label: "niewykonana", state: "incomplete" };
    }
    const label =
      s.weight > 0 ? `${formatKgPl(s.weight)}×${s.reps}` : `${s.reps} powt.`;
    return { ordinal, label, state: i === bestIndex ? "best" : "done" };
  });
}
