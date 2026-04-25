import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { workouts, weightLogs } from "@/db/schema";
import { getLatestBodyReportMetrics } from "@/lib/body-reports";
import {
  estimated1RM,
  safeNormalizeExercises,
  safeParseCompletedSession,
} from "@/lib/workout-history";

export type WeightPoint = { date: string; kg: number };
export type VolumePoint = { date: string; kg: number };
export type StrengthPoint = { date: string; score: number };
export type RelativeStrengthPoint = { date: string; ratio: number };

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function clampNonNegative(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function safeRound1(n: number): number {
  return Math.round(n * 10) / 10;
}

function volumeAndStrengthFromWorkoutExercises(exercises: unknown): {
  volumeKg: number;
  strengthScore: number;
  bestE1rmAny: number;
  totalRepsDone: number;
} {
  const ex = safeNormalizeExercises(exercises);
  let volumeKg = 0;
  let strengthScore = 0;
  let bestE1rmAny = 0;
  let totalRepsDone = 0;

  for (const e of ex) {
    let bestForExercise = 0;
    for (const s of e.sets ?? []) {
      const reps = typeof s.reps === "number" && Number.isFinite(s.reps) ? Math.round(s.reps) : null;
      const weight = typeof s.weight === "number" && Number.isFinite(s.weight) ? s.weight : Number(s.weight ?? 0);
      const w = clampNonNegative(weight);
      const done = Boolean(s.done) && reps != null && reps > 0 && w > 0;
      if (!done) continue;

      totalRepsDone += reps!;
      volumeKg += reps! * w;
      const e1rm = estimated1RM(w, reps!);
      bestForExercise = Math.max(bestForExercise, e1rm);
      bestE1rmAny = Math.max(bestE1rmAny, e1rm);
    }
    strengthScore += bestForExercise;
  }

  return { volumeKg, strengthScore, bestE1rmAny, totalRepsDone };
}

export async function getProgressAnalysisData(userId: string) {
  const db = getDb();
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const from = new Date(now - 90 * DAY_MS);

  const [recentWorkouts, weighIns, latestBodyReport] = await Promise.all([
    db
      .select({
        date: workouts.date,
        exercisesJson: workouts.exercises,
      })
      .from(workouts)
      .where(and(eq(workouts.userId, userId), gte(workouts.date, dayKey(from))))
      .orderBy(desc(workouts.date))
      .limit(250),
    db
      .select({
        recordedAt: weightLogs.recordedAt,
        weightKg: weightLogs.weightKg,
      })
      .from(weightLogs)
      .where(and(eq(weightLogs.userId, userId), gte(weightLogs.recordedAt, from)))
      .orderBy(desc(weightLogs.recordedAt))
      .limit(200),
    getLatestBodyReportMetrics(userId),
  ]);

  const volumeByDay = new Map<string, number>(); // kg
  const strengthByDay = new Map<string, number>();
  const bestE1rmByDay = new Map<string, number>();
  const repsByDay = new Map<string, number>();

  for (const w of recentWorkouts) {
    const parsed = safeParseCompletedSession(w.exercisesJson);
    if (!parsed) continue;

    const key = String(w.date);
    const { volumeKg, strengthScore, bestE1rmAny, totalRepsDone } = volumeAndStrengthFromWorkoutExercises(parsed.exercises);
    if (totalRepsDone <= 0) continue;

    volumeByDay.set(key, (volumeByDay.get(key) ?? 0) + volumeKg);
    strengthByDay.set(key, Math.max(strengthByDay.get(key) ?? 0, strengthScore));
    bestE1rmByDay.set(key, Math.max(bestE1rmByDay.get(key) ?? 0, bestE1rmAny));
    repsByDay.set(key, (repsByDay.get(key) ?? 0) + totalRepsDone);
  }

  const weights: WeightPoint[] = weighIns
    .slice()
    .reverse()
    .map((w) => ({ date: dayKey(w.recordedAt), kg: Number(w.weightKg) }));

  const volume: VolumePoint[] = Array.from(volumeByDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, kg]) => ({ date, kg: safeRound1(kg) }));

  const strength: StrengthPoint[] = Array.from(strengthByDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, score]) => ({ date, score: safeRound1(score) }));

  const lastWeightFromWeighIns = weights.length ? weights[weights.length - 1].kg : null;
  const lastWeight = (latestBodyReport?.weightKg ?? lastWeightFromWeighIns) ?? null;
  const relativeStrength: RelativeStrengthPoint[] =
    lastWeight != null && lastWeight > 0
      ? strength.map((p) => ({ date: p.date, ratio: safeRound1(p.score / lastWeight) }))
      : [];

  const [totals] = await db
    .select({
      totalWorkouts: sql<number>`cast(count(*) as integer)`,
    })
    .from(workouts)
    .where(eq(workouts.userId, userId));

  const firstWeight = weights.length ? weights[0].kg : null;
  const deltaWeight =
    lastWeight != null && firstWeight != null ? Math.round((lastWeight - firstWeight) * 10) / 10 : null;

  const lastVolume = volume.length ? volume[volume.length - 1].kg : 0;
  const lastStrength = strength.length ? strength[strength.length - 1].score : 0;
  const lastBestE1rm = bestE1rmByDay.size
    ? safeRound1(
        Array.from(bestE1rmByDay.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .at(-1)?.[1] ?? 0,
      )
    : 0;
  const lastReps = repsByDay.size
    ? Number(
        Array.from(repsByDay.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .at(-1)?.[1] ?? 0,
      )
    : 0;
  const avgLoadPerRep = lastReps > 0 ? safeRound1(lastVolume / lastReps) : null;

  return {
    series: { weights, volume, strength, relativeStrength },
    stats: {
      totalSessions: Number(totals?.totalWorkouts ?? 0),
      lastWeightKg: lastWeight,
      weightDeltaKg90d: deltaWeight,
      latestDailyVolumeKg: lastVolume,
      latestStrengthScore: lastStrength,
      latestBestE1rm: lastBestE1rm,
      latestAvgLoadPerRepKg: avgLoadPerRep,
      lastBodyReportAt: latestBodyReport?.createdAt ?? null,
      lastWaistCm: latestBodyReport?.waistCm ?? null,
      lastChestCm: latestBodyReport?.chestCm ?? null,
      lastThighCm: latestBodyReport?.thighCm ?? null,
    },
  };
}

