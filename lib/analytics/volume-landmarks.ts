import { daysBetweenDateKeys } from "@/lib/local-date";
import type {
  AnalyticsMuscleGroupId,
  MuscleGroupRow,
} from "@/lib/analytics/types";

/**
 * Orientacyjne tygodniowe zakresy serii efektywnych na grupę (hipertrofia).
 * `min` ≈ minimum skutecznej objętości, `max` ≈ górna granica rozsądnej objętości.
 */
export const WEEKLY_SET_TARGETS: Record<
  AnalyticsMuscleGroupId,
  { min: number; max: number }
> = {
  klatka: { min: 10, max: 20 },
  plecy: { min: 10, max: 20 },
  barki: { min: 8, max: 16 },
  biceps: { min: 6, max: 14 },
  triceps: { min: 6, max: 14 },
  nogi: { min: 10, max: 20 },
  posladki: { min: 6, max: 16 },
  lydki: { min: 8, max: 16 },
  brzuch: { min: 6, max: 16 },
};

export type VolumeStatus = "none" | "below" | "ok" | "above";

export function volumeStatus(
  group: AnalyticsMuscleGroupId,
  weeklyEffectiveSets: number,
): VolumeStatus {
  const t = WEEKLY_SET_TARGETS[group];
  if (!t || weeklyEffectiveSets <= 0) return "none";
  if (weeklyEffectiveSets < t.min) return "below";
  if (weeklyEffectiveSets > t.max) return "above";
  return "ok";
}

export type MuscleRecoveryState = "never" | "recovering" | "ready" | "rested";

/**
 * Regeneracja per grupa: <2 dni od treningu = jeszcze się regeneruje (48 h),
 * 2–3 dni = gotowa, 4+ dni = wypoczęta (można trenować, bodziec słabnie).
 */
export function muscleRecoveryState(
  lastTrainedDate: string | null,
  today: string,
): { state: MuscleRecoveryState; daysSince: number | null } {
  if (!lastTrainedDate) return { state: "never", daysSince: null };
  const d = Math.max(0, daysBetweenDateKeys(lastTrainedDate, today));
  if (d < 2) return { state: "recovering", daysSince: d };
  if (d <= 3) return { state: "ready", daysSince: d };
  return { state: "rested", daysSince: d };
}

export type PushPullBalance = {
  pushSets: number;
  pullSets: number;
  /** pull / push; null gdy brak pchania. */
  ratio: number | null;
  status: "balanced" | "push_heavy" | "pull_heavy" | "insufficient";
};

/** Pchanie (klatka, barki, triceps) vs ciągnięcie (plecy, biceps) z 30 dni. */
export function pushPullBalance(rows: MuscleGroupRow[]): PushPullBalance {
  const sets = (id: AnalyticsMuscleGroupId) =>
    rows.find((r) => r.id === id)?.days30.effectiveSets ?? 0;
  const push = sets("klatka") + sets("barki") + sets("triceps");
  const pull = sets("plecy") + sets("biceps");
  if (push + pull < 12) {
    return { pushSets: push, pullSets: pull, ratio: null, status: "insufficient" };
  }
  const ratio = push > 0 ? pull / push : null;
  const status =
    ratio == null
      ? "pull_heavy"
      : ratio < 0.8
        ? "push_heavy"
        : ratio > 1.5
          ? "pull_heavy"
          : "balanced";
  return {
    pushSets: Math.round(push),
    pullSets: Math.round(pull),
    ratio: ratio != null ? Math.round(ratio * 100) / 100 : null,
    status,
  };
}
