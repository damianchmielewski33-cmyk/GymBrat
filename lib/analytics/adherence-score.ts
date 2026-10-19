import { clamp, mean, round0 } from "@/lib/analytics/math";
import type { AdherenceSnapshot, ConsistencySnapshot } from "@/lib/analytics/types";

export function computeAdherenceScore(args: {
  consistency: ConsistencySnapshot;
  /** Średnia calorieAdherencePct z ostatnich tygodni (null = brak celów). */
  dietAdherencePct: number | null;
  /** Cardio minutes / weekly goal × 100 (bieżący tydzień). */
  cardioAdherencePct: number | null;
}): AdherenceSnapshot {
  const trainingPct = clamp(args.consistency.week.scorePct, 0, 100);
  const dietPct =
    args.dietAdherencePct != null
      ? clamp(round0(args.dietAdherencePct), 0, 120)
      : null;
  const cardioPct =
    args.cardioAdherencePct != null
      ? clamp(round0(args.cardioAdherencePct), 0, 150)
      : null;

  const parts: number[] = [trainingPct];
  if (dietPct != null) parts.push(Math.min(100, dietPct));
  if (cardioPct != null) parts.push(Math.min(100, cardioPct));
  const overallPct = round0(mean(parts) ?? trainingPct);

  return {
    trainingPct,
    dietPct: dietPct != null ? Math.min(100, dietPct) : null,
    cardioPct: cardioPct != null ? Math.min(100, cardioPct) : null,
    overallPct: clamp(overallPct, 0, 100),
  };
}
