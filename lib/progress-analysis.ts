import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { workouts, weightLogs } from "@/db/schema";
import { getLatestBodyReportMetrics } from "@/lib/body-reports";
import {
  estimated1RM,
  normalizeRir,
  normalizeTempo,
  safeNormalizeExercises,
  safeParseCompletedSession,
  temposMatch,
} from "@/lib/workout-history";

export type WeightPoint = { date: string; kg: number };
export type VolumePoint = { date: string; kg: number };
export type StrengthPoint = { date: string; score: number };
export type RelativeStrengthPoint = { date: string; ratio: number };
export type RirPoint = { date: string; avgRir: number };
export type SetsPoint = { date: string; sets: number; hardSets: number };

export type ExerciseLeaderboardRow = {
  name: string;
  sessions: number;
  totalVolumeKg: number;
  bestE1rm: number;
  bestWeight: number;
  avgRir: number | null;
  lastDate: string;
  prevVolumeKg: number | null;
  volumeDeltaPercent: number | null;
};

export type PeriodCompare = {
  recent30: { volumeKg: number; sessions: number; avgStrength: number; avgRir: number | null };
  prior30: { volumeKg: number; sessions: number; avgStrength: number; avgRir: number | null };
  volumeDeltaPercent: number | null;
  sessionsDelta: number | null;
  strengthDeltaPercent: number | null;
};

export type RirBucket = { label: string; count: number; pct: number };

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

function deltaPct(current: number, prev: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(prev) || prev <= 0) return null;
  return ((current - prev) / prev) * 100;
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function normalizeExerciseName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

type DayAgg = {
  volumeKg: number;
  strengthScore: number;
  bestE1rmAny: number;
  totalRepsDone: number;
  setsDone: number;
  hardSets: number;
  rirSum: number;
  rirCount: number;
  tempoCompared: number;
  tempoMatched: number;
};

function aggregateWorkoutDay(exercises: unknown): DayAgg {
  const ex = safeNormalizeExercises(exercises);
  let volumeKg = 0;
  let strengthScore = 0;
  let bestE1rmAny = 0;
  let totalRepsDone = 0;
  let setsDone = 0;
  let hardSets = 0;
  let rirSum = 0;
  let rirCount = 0;
  let tempoCompared = 0;
  let tempoMatched = 0;

  for (const e of ex) {
    let bestForExercise = 0;
    const targetTempo = normalizeTempo(e.tempo);
    for (const s of e.sets ?? []) {
      const reps =
        typeof s.reps === "number" && Number.isFinite(s.reps) ? Math.round(s.reps) : null;
      const weight =
        typeof s.weight === "number" && Number.isFinite(s.weight)
          ? s.weight
          : Number(s.weight ?? 0);
      const w = clampNonNegative(weight);
      const skipped = Boolean(s.skipped);
      const done = Boolean(s.done) && !skipped && reps != null && reps > 0 && w > 0;
      if (!done) continue;

      setsDone += 1;
      totalRepsDone += reps!;
      volumeKg += reps! * w;
      const e1rm = estimated1RM(w, reps!);
      bestForExercise = Math.max(bestForExercise, e1rm);
      bestE1rmAny = Math.max(bestE1rmAny, e1rm);

      const rir = normalizeRir(s.rir);
      if (rir != null) {
        rirSum += rir;
        rirCount += 1;
        if (rir <= 1) hardSets += 1;
      }
      const logged = normalizeTempo(s.tempo) ?? targetTempo;
      const match = temposMatch(logged, targetTempo);
      if (match != null) {
        tempoCompared += 1;
        if (match) tempoMatched += 1;
      }
    }
    strengthScore += bestForExercise;
  }

  return {
    volumeKg,
    strengthScore,
    bestE1rmAny,
    totalRepsDone,
    setsDone,
    hardSets,
    rirSum,
    rirCount,
    tempoCompared,
    tempoMatched,
  };
}

export async function getProgressAnalysisData(userId: string) {
  const db = getDb();
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const from = new Date(now - 90 * DAY_MS);
  const fromKey = dayKey(from);
  const day30 = dayKey(new Date(now - 30 * DAY_MS));
  const day60 = dayKey(new Date(now - 60 * DAY_MS));

  const [recentWorkouts, weighIns, latestBodyReport] = await Promise.all([
    db
      .select({
        date: workouts.date,
        exercisesJson: workouts.exercises,
      })
      .from(workouts)
      .where(and(eq(workouts.userId, userId), gte(workouts.date, fromKey)))
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

  const volumeByDay = new Map<string, number>();
  const strengthByDay = new Map<string, number>();
  const bestE1rmByDay = new Map<string, number>();
  const repsByDay = new Map<string, number>();
  const setsByDay = new Map<string, { sets: number; hardSets: number }>();
  const rirSumByDay = new Map<string, number>();
  const rirCountByDay = new Map<string, number>();

  let rirSum90 = 0;
  let rirCount90 = 0;
  let hardSets90 = 0;
  let setsDone90 = 0;
  let tempoCompared90 = 0;
  let tempoMatched90 = 0;
  const rirBuckets = { hard: 0, mid: 0, easy: 0 };

  type ExAcc = {
    sessions: number;
    totalVolumeKg: number;
    bestE1rm: number;
    bestWeight: number;
    rirSum: number;
    rirCount: number;
    lastDate: string;
    volumesByDate: Map<string, number>;
  };
  const byExercise = new Map<string, ExAcc>();

  let recent30 = { volumeKg: 0, sessions: 0, strengthSum: 0, rirSum: 0, rirCount: 0 };
  let prior30 = { volumeKg: 0, sessions: 0, strengthSum: 0, rirSum: 0, rirCount: 0 };

  for (const w of recentWorkouts) {
    const parsed = safeParseCompletedSession(w.exercisesJson);
    if (!parsed) continue;

    const key = String(w.date);
    const agg = aggregateWorkoutDay(parsed.exercises);
    if (agg.totalRepsDone <= 0) continue;

    volumeByDay.set(key, (volumeByDay.get(key) ?? 0) + agg.volumeKg);
    strengthByDay.set(key, Math.max(strengthByDay.get(key) ?? 0, agg.strengthScore));
    bestE1rmByDay.set(key, Math.max(bestE1rmByDay.get(key) ?? 0, agg.bestE1rmAny));
    repsByDay.set(key, (repsByDay.get(key) ?? 0) + agg.totalRepsDone);

    const prevSets = setsByDay.get(key) ?? { sets: 0, hardSets: 0 };
    setsByDay.set(key, {
      sets: prevSets.sets + agg.setsDone,
      hardSets: prevSets.hardSets + agg.hardSets,
    });

    if (agg.rirCount > 0) {
      rirSumByDay.set(key, (rirSumByDay.get(key) ?? 0) + agg.rirSum);
      rirCountByDay.set(key, (rirCountByDay.get(key) ?? 0) + agg.rirCount);
      rirSum90 += agg.rirSum;
      rirCount90 += agg.rirCount;
      hardSets90 += agg.hardSets;
    }
    setsDone90 += agg.setsDone;
    tempoCompared90 += agg.tempoCompared;
    tempoMatched90 += agg.tempoMatched;

    if (key >= day30) {
      recent30.volumeKg += agg.volumeKg;
      recent30.sessions += 1;
      recent30.strengthSum += agg.strengthScore;
      recent30.rirSum += agg.rirSum;
      recent30.rirCount += agg.rirCount;
    } else if (key >= day60) {
      prior30.volumeKg += agg.volumeKg;
      prior30.sessions += 1;
      prior30.strengthSum += agg.strengthScore;
      prior30.rirSum += agg.rirSum;
      prior30.rirCount += agg.rirCount;
    }

    const exList = safeNormalizeExercises(parsed.exercises);
    for (const e of exList) {
      const name = normalizeExerciseName(e.name ?? "");
      if (!name) continue;
      let exVol = 0;
      let exBestE1rm = 0;
      let exBestWeight = 0;
      let exRirSum = 0;
      let exRirCount = 0;
      let anyDone = false;

      for (const s of e.sets ?? []) {
        const reps =
          typeof s.reps === "number" && Number.isFinite(s.reps) ? Math.round(s.reps) : null;
        const weight =
          typeof s.weight === "number" && Number.isFinite(s.weight)
            ? s.weight
            : Number(s.weight ?? 0);
        const wKg = clampNonNegative(weight);
        const skipped = Boolean(s.skipped);
        const done = Boolean(s.done) && !skipped && reps != null && reps > 0 && wKg > 0;
        if (!done) continue;
        anyDone = true;
        exVol += reps! * wKg;
        const e1rm = estimated1RM(wKg, reps!);
        exBestE1rm = Math.max(exBestE1rm, e1rm);
        exBestWeight = Math.max(exBestWeight, wKg);
        const rir = normalizeRir(s.rir);
        if (rir != null) {
          exRirSum += rir;
          exRirCount += 1;
          if (rir <= 1) rirBuckets.hard += 1;
          else if (rir <= 3) rirBuckets.mid += 1;
          else rirBuckets.easy += 1;
        }
      }
      if (!anyDone) continue;

      const acc = byExercise.get(name) ?? {
        sessions: 0,
        totalVolumeKg: 0,
        bestE1rm: 0,
        bestWeight: 0,
        rirSum: 0,
        rirCount: 0,
        lastDate: key,
        volumesByDate: new Map<string, number>(),
      };
      acc.sessions += 1;
      acc.totalVolumeKg += exVol;
      acc.bestE1rm = Math.max(acc.bestE1rm, exBestE1rm);
      acc.bestWeight = Math.max(acc.bestWeight, exBestWeight);
      acc.rirSum += exRirSum;
      acc.rirCount += exRirCount;
      if (key > acc.lastDate) acc.lastDate = key;
      acc.volumesByDate.set(key, (acc.volumesByDate.get(key) ?? 0) + exVol);
      byExercise.set(name, acc);
    }
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

  const sets: SetsPoint[] = Array.from(setsByDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, sets: v.sets, hardSets: v.hardSets }));

  const avgRirSeries: RirPoint[] = Array.from(rirSumByDay.entries())
    .map(([date, sum]) => {
      const count = rirCountByDay.get(date) ?? 0;
      if (count <= 0) return null;
      return { date, avgRir: safeRound1(sum / count) };
    })
    .filter(Boolean)
    .sort((a, b) => a!.date.localeCompare(b!.date)) as RirPoint[];

  const lastWeightFromWeighIns = weights.length ? weights[weights.length - 1]!.kg : null;
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

  const firstWeight = weights.length ? weights[0]!.kg : null;
  const deltaWeight =
    lastWeight != null && firstWeight != null
      ? Math.round((lastWeight - firstWeight) * 10) / 10
      : null;

  const lastVolume = volume.length ? volume[volume.length - 1]!.kg : 0;
  const lastStrength = strength.length ? strength[strength.length - 1]!.score : 0;
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

  const volumeValues = volume.map((p) => p.kg);
  const avgVolume90 = avg(volumeValues);
  const recent5Vol = avg(volumeValues.slice(-5));
  const prior5Vol = avg(volumeValues.slice(-10, -5));

  const exerciseLeaderboard: ExerciseLeaderboardRow[] = [...byExercise.entries()]
    .map(([name, acc]) => {
      const dates = [...acc.volumesByDate.keys()].sort();
      const last = dates.at(-1) ?? null;
      const prev = dates.length >= 2 ? dates[dates.length - 2]! : null;
      const lastVol = last != null ? (acc.volumesByDate.get(last) ?? 0) : 0;
      const prevVol = prev != null ? (acc.volumesByDate.get(prev) ?? null) : null;
      return {
        name,
        sessions: acc.sessions,
        totalVolumeKg: safeRound1(acc.totalVolumeKg),
        bestE1rm: safeRound1(acc.bestE1rm),
        bestWeight: safeRound1(acc.bestWeight),
        avgRir: acc.rirCount > 0 ? safeRound1(acc.rirSum / acc.rirCount) : null,
        lastDate: acc.lastDate,
        prevVolumeKg: prevVol != null ? safeRound1(prevVol) : null,
        volumeDeltaPercent:
          prevVol != null && prevVol > 0 ? safeRound1(deltaPct(lastVol, prevVol) ?? 0) : null,
      };
    })
    .sort((a, b) => b.totalVolumeKg - a.totalVolumeKg)
    .slice(0, 12);

  const topByE1rm = [...exerciseLeaderboard]
    .sort((a, b) => b.bestE1rm - a.bestE1rm)
    .slice(0, 8);

  const bucketTotal = rirBuckets.hard + rirBuckets.mid + rirBuckets.easy;
  const rirDistribution: RirBucket[] =
    bucketTotal > 0
      ? [
          {
            label: "RIR 0–1",
            count: rirBuckets.hard,
            pct: Math.round((rirBuckets.hard / bucketTotal) * 100),
          },
          {
            label: "RIR 2–3",
            count: rirBuckets.mid,
            pct: Math.round((rirBuckets.mid / bucketTotal) * 100),
          },
          {
            label: "RIR 4–5",
            count: rirBuckets.easy,
            pct: Math.round((rirBuckets.easy / bucketTotal) * 100),
          },
        ]
      : [];

  const periodCompare: PeriodCompare = {
    recent30: {
      volumeKg: safeRound1(recent30.volumeKg),
      sessions: recent30.sessions,
      avgStrength:
        recent30.sessions > 0
          ? safeRound1(recent30.strengthSum / recent30.sessions)
          : 0,
      avgRir:
        recent30.rirCount > 0
          ? safeRound1(recent30.rirSum / recent30.rirCount)
          : null,
    },
    prior30: {
      volumeKg: safeRound1(prior30.volumeKg),
      sessions: prior30.sessions,
      avgStrength:
        prior30.sessions > 0 ? safeRound1(prior30.strengthSum / prior30.sessions) : 0,
      avgRir:
        prior30.rirCount > 0 ? safeRound1(prior30.rirSum / prior30.rirCount) : null,
    },
    volumeDeltaPercent: deltaPct(recent30.volumeKg, prior30.volumeKg),
    sessionsDelta: recent30.sessions - prior30.sessions,
    strengthDeltaPercent: deltaPct(
      recent30.sessions > 0 ? recent30.strengthSum / recent30.sessions : 0,
      prior30.sessions > 0 ? prior30.strengthSum / prior30.sessions : 0,
    ),
  };

  return {
    series: {
      weights,
      volume,
      strength,
      relativeStrength,
      avgRir: avgRirSeries,
      sets,
    },
    stats: {
      totalSessions: Number(totals?.totalWorkouts ?? 0),
      lastWeightKg: lastWeight,
      weightDeltaKg90d: deltaWeight,
      latestDailyVolumeKg: lastVolume,
      latestStrengthScore: lastStrength,
      latestBestE1rm: lastBestE1rm,
      latestAvgLoadPerRepKg: avgLoadPerRep,
      avgRir90d: rirCount90 > 0 ? safeRound1(rirSum90 / rirCount90) : null,
      hardSetsPct90d: rirCount90 > 0 ? Math.round((hardSets90 / rirCount90) * 100) : null,
      tempoMatchPct90d:
        tempoCompared90 > 0
          ? Math.round((tempoMatched90 / tempoCompared90) * 100)
          : null,
      setsDone90d: setsDone90,
      avgVolume90d: avgVolume90 != null ? safeRound1(avgVolume90) : null,
      recent5AvgVolumeKg: recent5Vol != null ? safeRound1(recent5Vol) : null,
      prior5AvgVolumeKg: prior5Vol != null ? safeRound1(prior5Vol) : null,
      recent5VsPrior5Percent:
        recent5Vol != null && prior5Vol != null ? deltaPct(recent5Vol, prior5Vol) : null,
      lastBodyReportAt: latestBodyReport?.createdAt ?? null,
      lastWaistCm: latestBodyReport?.waistCm ?? null,
      lastChestCm: latestBodyReport?.chestCm ?? null,
      lastThighCm: latestBodyReport?.thighCm ?? null,
    },
    exerciseLeaderboard,
    topByE1rm,
    rirDistribution,
    periodCompare,
  };
}
