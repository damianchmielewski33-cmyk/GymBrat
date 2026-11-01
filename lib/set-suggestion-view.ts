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

/** Neutralny powód, gdy reguła jest nieznana albo nie pasuje do kierunku. */
export const DEFAULT_SUGGESTION_REASON = "na podstawie ostatnich serii";

/**
 * Powody na ekranie wg `rule` silnika progresji (UX 004 §5.3). Teksty silnika
 * (rozkazujące / oceniające) nie trafiają do widoku. `directions` pilnuje, by
 * powód nie przeczył kierunkowi (BR-5); dla „hold” komponent dopisuje
 * „ten sam ciężar · ”, więc tekst nie powtarza tej etykiety.
 */
const REASON_BY_RULE: Record<
  string,
  { text: string; directions: readonly SuggestionDirection[] }
> = {
  top_of_range_easy: { text: "zakres zrobiony z zapasem", directions: ["up"] },
  top_of_range_reps_only: {
    text: "2 treningi na górze zakresu",
    directions: ["up", "down", "hold"],
  },
  in_range_add_reps: { text: "+1 powt.", directions: ["hold"] },
  layoff_reduce: { text: "lżej po dłuższej przerwie", directions: ["down"] },
  stagnation_deload: { text: "lżej, nowy cykl zakresu", directions: ["down"] },
  below_range_or_hard: {
    text: "lżej, ostatnio bez zapasu",
    directions: ["down"],
  },
};

/** Czysta funkcja: kod reguły + kierunek -> krótki neutralny powód (nigdy tekst silnika). */
export function suggestionReasonForRule(
  rule: string | null | undefined,
  direction: SuggestionDirection,
): string {
  const entry =
    rule && Object.hasOwn(REASON_BY_RULE, rule) ? REASON_BY_RULE[rule] : undefined;
  return entry && entry.directions.includes(direction)
    ? entry.text
    : DEFAULT_SUGGESTION_REASON;
}

export type SetSuggestionView = {
  /** > 0 */
  weightKg: number;
  /** null, gdy silnik nie podał powtórzeń. */
  reps: number | null;
  direction: SuggestionDirection;
  /** round2(S - B); 0 przy "hold". Do tekstu „+5 kg” / „−5 kg”. */
  deltaKg: number;
  /** Ciężar odniesienia B (lastSessionSets[i].weight) albo null. */
  referenceKg: number | null;
  /** Bezpieczny, neutralny powód (suggestionReasonForRule); null przy źródle suggestedWeights. */
  reason: string | null;
  /** Kod reguły silnika progresji; null, gdy brak (np. suggestedWeights, porada spoza progresji). */
  rule: string | null;
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
  let rule: string | null;
  let source: SetSuggestionView["source"];

  if (apply && isPositiveKg(apply.weightKg)) {
    weightKg = round2(apply.weightKg);
    reps = apply.reps > 0 ? apply.reps : null;
    rule = tip?.rule?.trim() || null;
    source = "liveCoach";
  } else {
    const suggested = exercise.suggestedWeights?.[setIndex];
    if (!isPositiveKg(suggested)) return null;
    weightKg = round2(suggested);
    const suggestedReps = exercise.suggestedReps?.[setIndex];
    reps = suggestedReps != null && suggestedReps > 0 ? suggestedReps : null;
    rule = null;
    source = "progression";
  }

  const direction = resolveSuggestionDirection(weightKg, referenceKg);
  const reason =
    source === "liveCoach" ? suggestionReasonForRule(rule, direction) : null;
  const deltaKg =
    direction === "hold" || referenceKg == null
      ? 0
      : round2(weightKg - referenceKg);

  return { weightKg, reps, direction, deltaKg, referenceKg, reason, rule, source };
}
