/**
 * Suspicious data detector — nie ignoruje danych; obniża confidence.
 */

import { setE1rm } from "@/lib/live-coach/e1rm-trend";
import type { SuspiciousReport } from "@/lib/live-coach/types";
import { hasEffortConflict } from "@/lib/set-effort";

export type SuspiciousInput = {
  weight: number;
  reps: number | null;
  rir?: number | null;
  rpe?: number | null;
  /** Poprzedni top ciężar (historia). */
  priorTopKg?: number | null;
  /** Poprzedni best e1RM. */
  priorBestE1rm?: number | null;
  isWeightPr?: boolean;
  isRepPr?: boolean;
};

export function detectSuspiciousSet(input: SuspiciousInput): SuspiciousReport {
  const reasons: string[] = [];
  let penalty = 0;

  const w = Math.max(0, Number(input.weight) || 0);
  const reps =
    input.reps != null && Number.isFinite(input.reps) && input.reps > 0
      ? Math.round(input.reps)
      : null;
  const rir = input.rir;
  const rpe = input.rpe;

  if (hasEffortConflict({ rir, rpe })) {
    reasons.push("konflikt RIR/RPE");
    penalty += 25;
  }

  // RPE10 + RIR5 (lub RIR≥4 przy RPE≥9)
  if (
    rpe != null &&
    rir != null &&
    Number.isFinite(rpe) &&
    Number.isFinite(rir)
  ) {
    if (rpe >= 10 && rir >= 4) {
      reasons.push("RPE10 przy wysokim RIR");
      penalty += 30;
    } else if (rpe >= 9 && rir >= 5) {
      reasons.push("RPE wysokie przy RIR5");
      penalty += 28;
    }
  }

  // PR ciężaru + PR powtórzeń + RIR4+
  if (
    input.isWeightPr &&
    input.isRepPr &&
    rir != null &&
    Number.isFinite(rir) &&
    rir >= 4
  ) {
    reasons.push("PR ciężaru i powtórzeń przy RIR4+");
    penalty += 35;
  }

  // Nagły skok ciężaru 15%+
  const prior = input.priorTopKg;
  if (
    prior != null &&
    prior > 0 &&
    w > 0 &&
    w >= prior * 1.15
  ) {
    reasons.push("skok ciężaru ≥15%");
    penalty += 20;
  }

  // Nagły skok e1RM 15%+
  const priorE = input.priorBestE1rm;
  if (priorE != null && priorE > 0 && reps != null && w > 0) {
    const e = setE1rm(w, reps);
    if (e >= priorE * 1.15) {
      reasons.push("skok e1RM ≥15%");
      penalty += 18;
    }
  }

  // Podejrzanie wysoki RIR przy bardzo wysokim obciążeniu vs historia
  if (
    rir != null &&
    rir >= 4 &&
    prior != null &&
    prior > 0 &&
    w >= prior * 1.08
  ) {
    reasons.push("wysoki RIR przy nowym ciężarze");
    penalty += 12;
  }

  penalty = Math.min(60, penalty);
  return {
    suspicious: reasons.length > 0,
    reasons,
    confidencePenalty: penalty,
  };
}
