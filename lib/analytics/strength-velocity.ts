import {
  ANALYTICS_MUSCLE_GROUPS,
  regionToAnalyticsGroup,
} from "@/lib/analytics/muscle-groups";
import { inWindow, pctDelta, round1 } from "@/lib/analytics/math";
import type {
  AnalyticsMuscleGroupId,
  ExerciseSessionPoint,
  StrengthVelocitySnapshot,
  VelocityWindow,
} from "@/lib/analytics/types";
import type { MuscleRegionId } from "@/lib/resolve-exercise-muscles";

function velocityWindow(
  points: ExerciseSessionPoint[],
  today: string,
  pick: (p: ExerciseSessionPoint) => number,
): VelocityWindow {
  const calc = (days: number): number | null => {
    const inWin = points.filter((p) => inWindow(p.date, today, days));
    if (inWin.length < 2) return null;
    const mid = Math.floor(inWin.length / 2);
    const a =
      inWin.slice(0, mid).reduce((s, p) => s + pick(p), 0) /
      Math.max(1, mid);
    const b =
      inWin.slice(mid).reduce((s, p) => s + pick(p), 0) /
      Math.max(1, inWin.length - mid);
    return pctDelta(a, b);
  };
  return {
    days7: calc(7),
    days30: calc(30),
    days90: calc(90),
  };
}

export function computeStrengthVelocity(args: {
  exercises: Array<{
    exerciseKey: string;
    name: string;
    points: ExerciseSessionPoint[];
    primaryRegion?: MuscleRegionId | null;
  }>;
  today: string;
}): StrengthVelocitySnapshot {
  const exercises = args.exercises
    .filter((e) => e.points.length >= 2)
    .map((e) => ({
      exerciseKey: e.exerciseKey,
      name: e.name,
      e1rmPct: velocityWindow(e.points, args.today, (p) => p.bestE1rm),
      volumePct: velocityWindow(e.points, args.today, (p) => p.volumeKg),
    }))
    .slice(0, 24);

  const byMuscleMap = new Map<
    AnalyticsMuscleGroupId,
    { volumes: number[]; points: ExerciseSessionPoint[] }
  >();
  for (const g of ANALYTICS_MUSCLE_GROUPS) {
    byMuscleMap.set(g.id, { volumes: [], points: [] });
  }
  for (const e of args.exercises) {
    const gid = regionToAnalyticsGroup(e.primaryRegion ?? null);
    if (!gid) continue;
    const bucket = byMuscleMap.get(gid)!;
    bucket.points.push(...e.points);
  }

  const byMuscle = ANALYTICS_MUSCLE_GROUPS.map((g) => {
    const bucket = byMuscleMap.get(g.id)!;
    return {
      id: g.id,
      label: g.label,
      volumePct: velocityWindow(bucket.points, args.today, (p) => p.volumeKg),
    };
  }).filter((r) => r.volumePct.days30 != null || r.volumePct.days90 != null);

  return { exercises, byMuscle };
}

export function formatVelocityPct(n: number | null): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "" : "";
  return `${sign}${round1(n)}%`;
}
