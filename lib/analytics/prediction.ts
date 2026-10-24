import { clamp, linearRegression, round1 } from "@/lib/analytics/math";
import { daysBetweenDateKeys } from "@/lib/local-date";
import type {
  ExerciseSessionPoint,
  PredictionConfidence,
  PredictionItem,
} from "@/lib/analytics/types";

function confidenceOf(n: number, r2: number): PredictionConfidence {
  if (n >= 16 && r2 >= 0.55) return "high";
  if (n >= 10 && r2 >= 0.35) return "medium";
  return "low";
}

function projectSeries(
  points: ExerciseSessionPoint[],
  pick: (p: ExerciseSessionPoint) => number,
  horizonDays: number,
): { now: number; future: number; r2: number } | null {
  if (points.length < 8) return null;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const t0 = sorted[0]!.date;
  const xs = sorted.map((p) => ({
    x: daysBetweenDateKeys(t0, p.date),
    y: pick(p),
  }));
  const reg = linearRegression(xs);
  if (!reg) return null;
  const last = xs[xs.length - 1]!;
  const now = last.y;
  const future = reg.a + reg.b * (last.x + horizonDays);
  return {
    now: round1(Math.max(0, now)),
    future: round1(Math.max(0, future)),
    r2: reg.r2,
  };
}

export function predictExercise(args: {
  exerciseKey: string;
  name: string;
  points: ExerciseSessionPoint[];
}): PredictionItem | null {
  const pts = args.points.filter(
    (p) => p.bestE1rm > 0 || p.volumeKg > 0,
  );
  if (pts.length < 8) return null;

  const e30 = projectSeries(pts, (p) => p.bestE1rm, 30);
  const e90 = projectSeries(pts, (p) => p.bestE1rm, 90);
  const t30 = projectSeries(pts, (p) => p.volumeKg, 30);
  const t90 = projectSeries(pts, (p) => p.volumeKg, 90);
  if (!e30 || !e90 || !t30 || !t90) return null;

  const r2 = (e30.r2 + t30.r2) / 2;
  const confidence = confidenceOf(pts.length, r2);

  return {
    exerciseKey: args.exerciseKey,
    name: args.name,
    sampleCount: pts.length,
    confidence,
    e1rmNow: e30.now,
    e1rm30d: e30.future,
    e1rm90d: e90.future,
    tonnageNow: t30.now,
    tonnage30d: t30.future,
    tonnage90d: t90.future,
  };
}

export function computePredictions(args: {
  exercises: Array<{
    exerciseKey: string;
    name: string;
    points: ExerciseSessionPoint[];
  }>;
  limit?: number;
}): PredictionItem[] {
  const out: PredictionItem[] = [];
  for (const ex of args.exercises) {
    const p = predictExercise(ex);
    if (p) out.push(p);
  }
  out.sort((a, b) => b.sampleCount - a.sampleCount);
  return out.slice(0, args.limit ?? 8);
}

export function clampPredictionDisplay(n: number): number {
  return clamp(n, 0, 10000);
}
