/**
 * Model sugestii ciężaru dla serii (ADR 0003, D1): jedno źródło dla ekranu serii
 * i „Następnie” na przerwie. Kierunek wynika z porównania ciężarów (BR-5),
 * a nie z `kind` / `deltaKg` / `tone` silnika progresji.
 */

import type { WorkoutExerciseState } from "@/components/workout/types";
import { buildLiveCoachTipForOpenSet } from "@/lib/live-set-coach";
import { round2 } from "@/lib/weight-step";

export type SuggestionDirection = "up" | "down" | "hold";

/** Tolerancja porównania ciężarów (zaokrąglenia round2). */
export const SUGGESTION_WEIGHT_EPSILON_KG = 0.01;

function isPositiveKg(kg: number | null | undefined): kg is number {
  return kg != null && Number.isFinite(kg) && kg > 0;
}

/**
 * BR-5: kierunek wynika z porównania ciężarów, nie z kind/deltaKg/tone.
 * Brak odniesienia (null, <= 0) albo |S - B| <= epsilon -> "hold".
 */
export function resolveSuggestionDirection(
  suggestedKg: number,
  referenceKg: number | null | undefined,
): SuggestionDirection {
  if (!isPositiveKg(referenceKg) || !Number.isFinite(suggestedKg)) {
    return "hold";
  }
  const diff = round2(suggestedKg - referenceKg);
  if (Math.abs(diff) <= SUGGESTION_WEIGHT_EPSILON_KG) return "hold";
  return diff > 0 ? "up" : "down";
}

export type SetSuggestionView = {
  /** > 0 */
  weightKg: number;
  /** null przy źródle suggestedWeights. */
  reps: number | null;
  direction: SuggestionDirection;
  /** round2(S - B); 0 przy "hold". Do tekstu „+5 kg” / „−5 kg”. */
  deltaKg: number;
  /** Ciężar odniesienia B (lastSessionSets[i].weight) albo null. */
  referenceKg: number | null;
  /** Krótki powód z Live Coach; null przy źródle suggestedWeights. */
  reason: string | null;
  source: "liveCoach" | "progression";
};

/**
 * Jedno źródło sugestii dla serii: Live Coach apply (> 0), potem suggestedWeights[i] (> 0).
 * null = brak sugestii (chip nie jest renderowany).
 * Deterministyczna, bez efektów ubocznych; ekran serii i „Następnie” wołają ją tak samo.
 */
export function buildSetSuggestionView(
  exercise: WorkoutExerciseState,
  setIndex: number,
): SetSuggestionView | null {
  if (setIndex < 0 || setIndex >= exercise.sets.length) return null;

  const lastWeight = exercise.lastSessionSets?.[setIndex]?.weight;
  const referenceKg = isPositiveKg(lastWeight) ? lastWeight : null;

  const tip = buildLiveCoachTipForOpenSet(exercise, setIndex);
  const apply = tip?.apply ?? null;

  let weightKg: number;
  let reps: number | null;
  let reason: string | null;
  let source: SetSuggestionView["source"];

  if (apply && isPositiveKg(apply.weightKg)) {
    weightKg = round2(apply.weightKg);
    reps = apply.reps > 0 ? apply.reps : null;
    const r = tip?.reason?.trim();
    reason = r ? r : null;
    source = "liveCoach";
  } else {
    const suggested = exercise.suggestedWeights?.[setIndex];
    if (!isPositiveKg(suggested)) return null;
    weightKg = round2(suggested);
    reps = null;
    reason = null;
    source = "progression";
  }

  const direction = resolveSuggestionDirection(weightKg, referenceKg);
  const deltaKg =
    direction === "hold" || referenceKg == null
      ? 0
      : round2(weightKg - referenceKg);

  return { weightKg, reps, direction, deltaKg, referenceKg, reason, source };
}
