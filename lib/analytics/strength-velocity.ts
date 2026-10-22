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

export type VelocityPeriodKey = keyof VelocityWindow;

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

function meanVelocityWindow(windows: VelocityWindow[]): VelocityWindow {
  const meanKey = (key: VelocityPeriodKey): number | null => {
    const vals = windows
      .map((w) => w[key])
      .filter((n): n is number => n != null && Number.isFinite(n));
    if (!vals.length) return null;
    return round1(vals.reduce((a, b) => a + b, 0) / vals.length);
  };
  return {
    days7: meanKey("days7"),
    days30: meanKey("days30"),
    days90: meanKey("days90"),
  };
}

export function pickVelocity(
  window: VelocityWindow,
  key: VelocityPeriodKey,
): number | null {
  return window[key];
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

  const allPoints = args.exercises.flatMap((e) => e.points);
  const overall = {
    e1rmPct: meanVelocityWindow(exercises.map((e) => e.e1rmPct)),
    volumePct: velocityWindow(allPoints, args.today, (p) => p.volumeKg),
  };

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
  }).filter(
    (r) =>
      r.volumePct.days7 != null ||
      r.volumePct.days30 != null ||
      r.volumePct.days90 != null,
  );

  return { overall, exercises, byMuscle };
}

export function formatVelocityPct(n: number | null): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "" : "";
  return `${sign}${round1(n)}%`;
}

export function velocityTone(
  n: number | null,
): "up" | "down" | "flat" | "none" {
  if (n == null) return "none";
  if (n >= 3) return "up";
  if (n <= -3) return "down";
  return "flat";
}
