import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { trainingSessions, weightLogs } from "@/db/schema";

export type WeightPoint = { date: string; kg: number };
export type VolumePoint = { date: string; reps: number };
export type StrengthPoint = { date: string; score: number };

type ParsedExercise = {
  id?: string;
  name?: string;
  sets?: Array<{ reps?: number; done?: boolean }>;
};

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function safeParseExercises(json: string | null): ParsedExercise[] {
  if (!json) return [];
  try {
    const x = JSON.parse(json) as unknown;
    if (!Array.isArray(x)) return [];
    return x as ParsedExercise[];
  } catch {
    return [];
  }
}

export async function getProgressAnalysisData(userId: string) {
  const db = getDb();
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const from = new Date(now - 90 * DAY_MS);

  const sessions = await db
    .select({
      startedAt: trainingSessions.startedAt,
      exerciseDataJson: trainingSessions.exerciseDataJson,
      cardioMinutes: trainingSessions.cardioMinutes,
    })
    .from(trainingSessions)
    .where(and(eq(trainingSessions.userId, userId), gte(trainingSessions.startedAt, from)))
    .orderBy(desc(trainingSessions.startedAt))
    .limit(200);

  const weighIns = await db
    .select({
      recordedAt: weightLogs.recordedAt,
      weightKg: weightLogs.weightKg,
    })
    .from(weightLogs)
    .where(and(eq(weightLogs.userId, userId), gte(weightLogs.recordedAt, from)))
    .orderBy(desc(weightLogs.recordedAt))
    .limit(200);

  const volumeByDay = new Map<string, number>();
  const strengthByDay = new Map<string, number>();

  for (const s of sessions) {
    const key = dayKey(s.startedAt);
    const ex = safeParseExercises(s.exerciseDataJson);

    let repsTotal = 0;
    let bestSet = 0;
    for (const e of ex) {
      for (const set of e.sets ?? []) {
        const reps = Math.max(0, Math.round(Number(set.reps ?? 0)));
        const done = Boolean(set.done);
        if (done) {
          repsTotal += reps;
          bestSet = Math.max(bestSet, reps);
        }
      }
    }

    if (repsTotal > 0) {
      volumeByDay.set(key, (volumeByDay.get(key) ?? 0) + repsTotal);
      strengthByDay.set(key, Math.max(strengthByDay.get(key) ?? 0, bestSet));
    }
  }

  const weights: WeightPoint[] = weighIns
    .slice()
    .reverse()
    .map((w) => ({ date: dayKey(w.recordedAt), kg: Number(w.weightKg) }));

  const volume: VolumePoint[] = Array.from(volumeByDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, reps]) => ({ date, reps }));

  const strength: StrengthPoint[] = Array.from(strengthByDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, score]) => ({ date, score }));

  const [totals] = await db
    .select({
      totalSessions: sql<number>`cast(count(*) as integer)`,
      totalCardio: sql<number>`coalesce(sum(${trainingSessions.cardioMinutes}), 0)`,
    })
    .from(trainingSessions)
    .where(eq(trainingSessions.userId, userId));

  const lastWeight = weights.length ? weights[weights.length - 1].kg : null;
  const firstWeight = weights.length ? weights[0].kg : null;
  const deltaWeight =
    lastWeight != null && firstWeight != null ? Math.round((lastWeight - firstWeight) * 10) / 10 : null;

  const lastVolume = volume.length ? volume[volume.length - 1].reps : 0;
  const lastStrength = strength.length ? strength[strength.length - 1].score : 0;

  return {
    series: { weights, volume, strength },
    stats: {
      totalSessions: Number(totals?.totalSessions ?? 0),
      totalCardioMinutes: Number(totals?.totalCardio ?? 0),
      lastWeightKg: lastWeight,
      weightDeltaKg90d: deltaWeight,
      latestDailyVolumeReps: lastVolume,
      latestStrengthScore: lastStrength,
    },
  };
}

