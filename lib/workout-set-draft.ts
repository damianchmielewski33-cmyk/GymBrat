/**
 * Szkic pól serii na ekranie aktywnego treningu (ADR 0003, D3/D4):
 * parsowanie i przycinanie wpisów, wartość początkowa (BR-7) i kroki ciężaru (P-4).
 * Nic tu nie zapisuje do store — wynik trafia tylko do pól szkicu.
 */

import type { WorkoutSetState } from "@/components/workout/types";
import { round2, type WeightStep } from "@/lib/weight-step";
import {
  hasExternalWeight,
  hasPerformedReps,
  isCompletedWorkoutSet,
} from "@/lib/workout-skipped-sets";

export const MAX_WEIGHT_KG = 999;
export const MAX_REPS = 99;

/** round2 (0,01 kg — kroki 1,25 / 0,25 nie mogą zniknąć), 0..MAX_WEIGHT_KG. */
export function clampWeight(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_WEIGHT_KG, round2(n)));
}

/** Całkowite, 0..MAX_REPS. */
export function clampReps(n: number | null): number {
  if (n == null || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_REPS, Math.round(n)));
}

/** "," -> ".", "" -> null, nieliczba -> null. */
export function parseWeightInput(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return clampWeight(n);
}

export function parseRepsInput(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return clampReps(n);
}

export type SetDraftSource =
  | "set"
  | "suggestion"
  | "lastSession"
  | "previousSet"
  | "empty";

export type InitialSetDraft = {
  /** null = puste pole */
  weightKg: number | null;
  reps: number | null;
  /** Do testów i aria; nie do logów. */
  source: SetDraftSource;
};

function positiveReps(reps: number | null | undefined): number | null {
  return hasPerformedReps(reps) ? clampReps(reps!) : null;
}

/**
 * Najbliższa wcześniejsza zapisana (`isCompletedWorkoutSet`) seria przed `setIndex`
 * (źródło 4 z BR-7).
 */
export function findPreviousCompletedSet(
  sets: WorkoutSetState[],
  setIndex: number,
): WorkoutSetState | null {
  for (let i = Math.min(setIndex, sets.length) - 1; i >= 0; i--) {
    const s = sets[i]!;
    if (isCompletedWorkoutSet(s)) return s;
  }
  return null;
}

/**
 * BR-7 + D3. Kolejność: (1) seria (`done` albo ciężar > 0), (2) sugestia,
 * (3) seria z poprzedniego treningu z ciężarem > 0, (4) wcześniejsza zapisana seria
 * w sesji, (5) brak. `set.reps > 0` ma pierwszeństwo przed powtórzeniami ze źródła.
 */
export function resolveInitialSetDraft(args: {
  set: WorkoutSetState;
  suggestion: { weightKg: number; reps: number | null } | null;
  lastSessionSet: WorkoutSetState | null;
  /** Najbliższa wcześniejsza zapisana seria tego ćwiczenia w sesji. */
  previousSessionSet: WorkoutSetState | null;
}): InitialSetDraft {
  const { set, suggestion, lastSessionSet, previousSessionSet } = args;
  const setReps = positiveReps(set.reps);

  if (set.done || hasExternalWeight(set.weight)) {
    return {
      weightKg: hasExternalWeight(set.weight) ? clampWeight(set.weight) : null,
      reps: setReps,
      source: "set",
    };
  }

  const candidates: Array<{
    source: Exclude<SetDraftSource, "set" | "empty">;
    weightKg: number | null | undefined;
    reps: number | null | undefined;
  }> = [
    {
      source: "suggestion",
      weightKg: suggestion?.weightKg,
      reps: suggestion?.reps,
    },
    {
      source: "lastSession",
      weightKg: lastSessionSet?.weight,
      reps: lastSessionSet?.reps,
    },
    {
      source: "previousSet",
      weightKg: previousSessionSet?.weight,
      reps: previousSessionSet?.reps,
    },
  ];

  for (const c of candidates) {
    if (hasExternalWeight(c.weightKg)) {
      return {
        weightKg: clampWeight(c.weightKg!),
        reps: setReps ?? positiveReps(c.reps),
        source: c.source,
      };
    }
  }

  return { weightKg: null, reps: setReps, source: "empty" };
}

/**
 * F2 (bramka prawna 004, LR-3): czy bieżący szkic pola to dokładnie ta wartość
 * początkowa, którą zwrócił `resolveInitialSetDraft` przy wejściu na serię —
 * czyli użytkownik niczego nie zmienił (nie wpisał, nie użył stepperów/szybkich
 * przycisków). `flushDraft` w `guided-session-layout.tsx` używa tego, żeby nie
 * zapisywać niepotwierdzonej podpowiedzi do store/chmury przy nawigacji, blurze
 * czy otwarciu menu.
 */
export function isDraftUnchangedFromInitial(
  draft: { weight: number; reps: number | null },
  initial: InitialSetDraft,
): boolean {
  const initialWeight = initial.weightKg ?? 0;
  const initialReps = initial.reps != null && initial.reps > 0 ? initial.reps : null;
  return draft.weight === initialWeight && draft.reps === initialReps;
}

/** P-4 / D4: steppery = 1 krok, szybkie przyciski = 2 kroki. */
export function resolveWeightAdjustSteps(step: WeightStep): {
  stepperKg: number;
  quickKg: number;
} {
  return { stepperKg: step.stepKg, quickKg: round2(2 * step.stepKg) };
}
