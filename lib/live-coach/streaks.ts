/**
 * Serie twarde / „na styk” z rzędu — jedno źródło prawdy dla Live Coach
 * (tipy) i silników sygnałów (readiness).
 */

import type { WorkoutSetState } from "@/components/workout/types";
import {
  isHardEffort,
  isWarnEffort,
  type EffortContext,
} from "@/lib/set-effort";
import { isCompletedWorkoutSet } from "@/lib/workout-skipped-sets";

/** Kolejne twarde serie wstecz od `beforeIndex` (wyłącznie). */
export function countHardStreak(
  sets: WorkoutSetState[],
  beforeIndex: number,
  ctx?: EffortContext,
): number {
  let n = 0;
  for (let i = beforeIndex - 1; i >= 0; i--) {
    const s = sets[i]!;
    if (!isCompletedWorkoutSet(s)) break;
    if (!isHardEffort(s, ctx)) break;
    n += 1;
  }
  return n;
}

/** Kolejne serie „na styk” (lub twarde) wstecz — ostrzeżenie przed forsowaniem. */
export function countWarnStreak(
  sets: WorkoutSetState[],
  beforeIndex: number,
  ctx?: EffortContext,
): number {
  let n = 0;
  for (let i = beforeIndex - 1; i >= 0; i--) {
    const s = sets[i]!;
    if (!isCompletedWorkoutSet(s)) break;
    if (!isWarnEffort(s, ctx)) break;
    n += 1;
  }
  return n;
}
