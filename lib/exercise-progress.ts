import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { workouts } from "@/db/schema";
import { resolveExerciseIdentity } from "@/lib/exercise-identity";
import {
  compareRirToTarget,
  isHardSet,
  isIntensityEligibleSet,
  rirTrendOf,
  type RirVsTarget,
  type VolumeTrendKind,
} from "@/lib/intensity-analysis";
import {
  estimated1RM,
  safeNormalizeExercises,
  safeParseCompletedSession,
} from "@/lib/workout-history";
import { hasExternalWeight, hasPerformedReps } from "@/lib/workout-skipped-sets";

export type ExerciseMetricKind = "kg" | "reps";

export type ExerciseProgressPoint = {
  date: string; // YYYY-MM-DD (workouts.date)
  bestE1rm: number;
  bestWeight: number;
  bestReps: number;
  tonnageKg: number;
  /** Suma powtórzeń zaliczonych serii (ważne przy masie ciała). */
  totalReps: number;
  avgRir: number | null;
  avgRpe: number | null;
  targetRir: number | null;
  tempo: string | null;
  rirVsTarget: RirVsTarget | null;
};

export type ExercisePrs = {
  maxE1rm: { value: number; date: string | null };
  maxWeight: { value: number; date: string | null };
  maxTonnageKg: { value: number; date: string | null };
  maxTotalReps: { value: number; date: string | null };
  maxBestSetReps: { value: number; date: string | null };
};

export type ExerciseIntensitySummary = {
  avgRir: number | null;
  avgRpe: number | null;
  hardSetPct: number | null;
  targetHitPct: number | null;
  targetComparedCount: number;
  lastTempo: string | null;
  temposUsed: string[];
  rirTrend: VolumeTrendKind | null;
  sessionsWithRir: number;
  sessionsWithRpe: number;
};

function clampNonNegative(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function safeRound1(n: number): number {
  return Math.round(n * 10) / 10;
}

function optionalRir(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(5, Math.round(n)));
}

function optionalRpe(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(10, Math.round(n)));
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return safeRound1(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function normalizeExerciseName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function matchesExerciseIdentity(name: string, queryKey: string): boolean {
  if (!queryKey) return false;
  return resolveExerciseIdentity(name).key === queryKey;
}

function emptyPrs(): ExercisePrs {
  return {
    maxE1rm: { value: 0, date: null },
    maxWeight: { value: 0, date: null },
    maxTonnageKg: { value: 0, date: null },
    maxTotalReps: { value: 0, date: null },
    maxBestSetReps: { value: 0, date: null },
  };
}

function emptyIntensity(): ExerciseIntensitySummary {
  return {
    avgRir: null,
    avgRpe: null,
    hardSetPct: null,
    targetHitPct: null,
    targetComparedCount: 0,
    lastTempo: null,
    temposUsed: [],
    rirTrend: null,
    sessionsWithRir: 0,
    sessionsWithRpe: 0,
  };
}

export async function listExerciseNameSuggestions(userId: string, input?: { days?: number }) {
  const db = getDb();
  const days = Math.max(7, Math.min(365, Math.round(input?.days ?? 180)));
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const fromKey = from.toISOString().slice(0, 10);

  const rows = await db
    .select({ exercisesJson: workouts.exercises })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), gte(workouts.date, fromKey)))
    .orderBy(desc(workouts.date))
    .limit(350);

  const names = new Map<string, { display: string; count: number }>();
  for (const r of rows) {
    const parsed = safeParseCompletedSession(r.exercisesJson);
    if (!parsed) continue;
    const ex = safeNormalizeExercises(parsed.exercises);
    for (const e of ex) {
      const name = normalizeExerciseName(e.name ?? "");
      if (!name) continue;
      const identity = resolveExerciseIdentity(name);
      if (!identity.key) continue;
      const prev = names.get(identity.key);
      names.set(identity.key, {
        display: identity.displayName || name,
        count: (prev?.count ?? 0) + 1,
      });
    }
  }

  return [...names.values()]
    .sort((a, b) => b.count - a.count)
    .map((v) => v.display)
    .slice(0, 120);
}

export async function getExerciseProgressSeries(params: {
  userId: string;
  exerciseQuery: string;
  days?: number;
}): Promise<{
  query: string;
  matchedExerciseNames: string[];
  points: ExerciseProgressPoint[];
  prs: ExercisePrs;
  intensity: ExerciseIntensitySummary;
  metric: ExerciseMetricKind;
  newMax: { e1rm: boolean; weight: boolean; tonnage: boolean; reps: boolean };
  hasNewMax: boolean;
}> {
  const q = params.exerciseQuery.trim();
  if (!q) {
    return {
      query: "",
      matchedExerciseNames: [],
      points: [],
      prs: emptyPrs(),
      intensity: emptyIntensity(),
      metric: "kg",
      newMax: { e1rm: false, weight: false, tonnage: false, reps: false },
      hasNewMax: false,
    };
  }

  const db = getDb();
  const days = Math.max(14, Math.min(730, Math.round(params.days ?? 365)));
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const fromKey = from.toISOString().slice(0, 10);

  const rows = await db
    .select({ date: workouts.date, exercisesJson: workouts.exercises })
    .from(workouts)
    .where(and(eq(workouts.userId, params.userId), gte(workouts.date, fromKey)))
    .orderBy(desc(workouts.date))
    .limit(650);

  // Aggregate per day (cleaner chart than per workout id).
  const byDay = new Map<
    string,
    {
      bestE1rm: number;
      bestWeight: number;
      bestReps: number;
      tonnageKg: number;
      totalReps: number;
      rirs: number[];
      rpes: number[];
      hardSets: number;
      scoredSets: number;
      targetRirs: number[];
      tempos: string[];
    }
  >();

  const queryIdentity = resolveExerciseIdentity(q);
  const queryKey = queryIdentity.key;
  if (!queryKey) {
    return {
      query: q,
      matchedExerciseNames: [],
      points: [],
      prs: emptyPrs(),
      intensity: emptyIntensity(),
      metric: "kg",
      newMax: { e1rm: false, weight: false, tonnage: false, reps: false },
      hasNewMax: false,
    };
  }

  const matchedNameCounts = new Map<string, number>();
  let everWeighted = false;

  for (const r of rows) {
    const parsed = safeParseCompletedSession(r.exercisesJson);
    if (!parsed) continue;
    const ex = safeNormalizeExercises(parsed.exercises);
    if (!ex.length) continue;

    const dateKey = String(r.date);
    let dayBestE1rm = 0;
    let dayBestWeight = 0;
    let dayBestReps = 0;
    let dayTonnage = 0;
    let dayTotalReps = 0;
    const dayRirs: number[] = [];
    const dayRpes: number[] = [];
    let dayHard = 0;
    let dayScored = 0;
    const dayTargets: number[] = [];
    const dayTempos: string[] = [];
    let matched = false;

    for (const e of ex) {
      const name = normalizeExerciseName(e.name ?? "");
      if (!name) continue;
      if (!matchesExerciseIdentity(name, queryKey)) continue;
      matched = true;

      const identity = resolveExerciseIdentity(name);
      const label = identity.displayName || name;
      matchedNameCounts.set(label, (matchedNameCounts.get(label) ?? 0) + 1);

      const target = optionalRir(e.targetRir);
      if (target != null) dayTargets.push(target);
      if (typeof e.tempo === "string" && e.tempo.trim()) {
        dayTempos.push(e.tempo.trim().slice(0, 16));
      }

      for (const s of e.sets ?? []) {
        const reps =
          typeof s.reps === "number" && Number.isFinite(s.reps)
            ? Math.round(s.reps)
            : null;
        const weight =
          typeof s.weight === "number" && Number.isFinite(s.weight)
            ? s.weight
            : Number(s.weight ?? 0);
        const w = clampNonNegative(weight);
        const performed =
          Boolean(s.done) && !Boolean(s.skipped) && hasPerformedReps(reps);
        if (performed) {
          dayTotalReps += reps!;
          if (reps! > dayBestReps && !hasExternalWeight(w)) {
            dayBestReps = reps!;
          }
          if (hasExternalWeight(w)) {
            everWeighted = true;
            dayTonnage += reps! * w;
            const e1rm = estimated1RM(w, reps!);
            if (w > dayBestWeight) {
              dayBestWeight = w;
              dayBestReps = reps!;
            }
            if (e1rm > dayBestE1rm) {
              dayBestE1rm = e1rm;
            }
          }
        }

        if (!isIntensityEligibleSet(s)) continue;
        dayScored += 1;
        const rir = optionalRir(s.rir);
        const rpe = optionalRpe(s.rpe);
        if (rir != null) dayRirs.push(rir);
        if (rpe != null) dayRpes.push(rpe);
        if (isHardSet({ rir, rpe })) dayHard += 1;
      }
    }

    if (!matched) continue;
    // Keep days that have volume, reps, or intensity logs
    if (
      dayTonnage <= 0 &&
      dayTotalReps <= 0 &&
      dayRirs.length === 0 &&
      dayRpes.length === 0
    )
      continue;

    const prev = byDay.get(dateKey);
    if (!prev) {
      byDay.set(dateKey, {
        bestE1rm: dayBestE1rm,
        bestWeight: dayBestWeight,
        bestReps: dayBestReps,
        tonnageKg: dayTonnage,
        totalReps: dayTotalReps,
        rirs: dayRirs,
        rpes: dayRpes,
        hardSets: dayHard,
        scoredSets: dayScored,
        targetRirs: dayTargets,
        tempos: dayTempos,
      });
    } else {
      const weightWins = dayBestWeight > prev.bestWeight;
      const repsWin =
        dayBestWeight <= 0 &&
        prev.bestWeight <= 0 &&
        dayBestReps > prev.bestReps;
      byDay.set(dateKey, {
        bestE1rm: Math.max(prev.bestE1rm, dayBestE1rm),
        bestWeight: Math.max(prev.bestWeight, dayBestWeight),
        bestReps: weightWins || repsWin ? dayBestReps : prev.bestReps,
        tonnageKg: prev.tonnageKg + dayTonnage,
        totalReps: prev.totalReps + dayTotalReps,
        rirs: [...prev.rirs, ...dayRirs],
        rpes: [...prev.rpes, ...dayRpes],
        hardSets: prev.hardSets + dayHard,
        scoredSets: prev.scoredSets + dayScored,
        targetRirs: [...prev.targetRirs, ...dayTargets],
        tempos: [...prev.tempos, ...dayTempos],
      });
    }
  }

  const points: ExerciseProgressPoint[] = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => {
      const avgRir = avg(v.rirs);
      const avgRpe = avg(v.rpes);
      const targetRir = avg(v.targetRirs);
      const tempo = v.tempos.length ? v.tempos[v.tempos.length - 1]! : null;
      return {
        date,
        bestE1rm: safeRound1(v.bestE1rm),
        bestWeight: safeRound1(v.bestWeight),
        bestReps: Math.round(v.bestReps),
        tonnageKg: safeRound1(v.tonnageKg),
        totalReps: Math.round(v.totalReps),
        avgRir,
        avgRpe,
        targetRir,
        tempo,
        rirVsTarget:
          avgRir != null && targetRir != null
            ? compareRirToTarget(avgRir, targetRir)
            : null,
      };
    });

  const metric: ExerciseMetricKind = everWeighted ? "kg" : "reps";

  const prs: ExercisePrs = emptyPrs();
  for (const p of points) {
    if (p.bestE1rm > prs.maxE1rm.value) prs.maxE1rm = { value: p.bestE1rm, date: p.date };
    if (p.bestWeight > prs.maxWeight.value) prs.maxWeight = { value: p.bestWeight, date: p.date };
    if (p.tonnageKg > prs.maxTonnageKg.value)
      prs.maxTonnageKg = { value: p.tonnageKg, date: p.date };
    if (p.totalReps > prs.maxTotalReps.value)
      prs.maxTotalReps = { value: p.totalReps, date: p.date };
    if (p.bestReps > prs.maxBestSetReps.value)
      prs.maxBestSetReps = { value: p.bestReps, date: p.date };
  }

  const latest = points.length > 0 ? points[points.length - 1]! : null;
  const priorPoints = points.slice(0, -1);
  const priorMaxE1rm = priorPoints.reduce((m, p) => Math.max(m, p.bestE1rm), 0);
  const priorMaxWeight = priorPoints.reduce((m, p) => Math.max(m, p.bestWeight), 0);
  const priorMaxTonnage = priorPoints.reduce((m, p) => Math.max(m, p.tonnageKg), 0);
  const priorMaxReps = priorPoints.reduce((m, p) => Math.max(m, p.totalReps), 0);
  const newMax = {
    e1rm: Boolean(latest && latest.bestE1rm > priorMaxE1rm && priorPoints.length > 0),
    weight: Boolean(
      latest && latest.bestWeight > priorMaxWeight && priorPoints.length > 0,
    ),
    tonnage: Boolean(
      latest && latest.tonnageKg > priorMaxTonnage && priorPoints.length > 0,
    ),
    reps: Boolean(
      latest &&
        metric === "reps" &&
        latest.totalReps > priorMaxReps &&
        priorPoints.length > 0,
    ),
  };
  const hasNewMax = newMax.e1rm || newMax.weight || newMax.tonnage || newMax.reps;

  const matchedExerciseNames = [...matchedNameCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .slice(0, 12);

  // Intensity summary across all days
  let hardSets = 0;
  let scoredSets = 0;
  let targetOn = 0;
  let targetCompared = 0;
  const allRirs: number[] = [];
  const allRpes: number[] = [];
  const tempos = new Set<string>();
  let lastTempo: string | null = null;
  let sessionsWithRir = 0;
  let sessionsWithRpe = 0;

  for (const [, v] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    hardSets += v.hardSets;
    scoredSets += v.scoredSets;
    allRirs.push(...v.rirs);
    allRpes.push(...v.rpes);
    if (v.rirs.length) sessionsWithRir += 1;
    if (v.rpes.length) sessionsWithRpe += 1;
    for (const t of v.tempos) {
      tempos.add(t);
      lastTempo = t;
    }
  }
  for (const p of points) {
    if (p.rirVsTarget) {
      targetCompared += 1;
      if (p.rirVsTarget === "on") targetOn += 1;
    }
  }

  const rirSeries = points
    .map((p) => p.avgRir)
    .filter((v): v is number => v != null);
  const rirTrend =
    rirSeries.length >= 2
      ? rirTrendOf(rirSeries[rirSeries.length - 2]!, rirSeries[rirSeries.length - 1]!)
      : null;

  const intensity: ExerciseIntensitySummary = {
    avgRir: avg(allRirs),
    avgRpe: avg(allRpes),
    hardSetPct:
      scoredSets > 0 ? Math.round((hardSets / scoredSets) * 100) : null,
    targetHitPct:
      targetCompared > 0
        ? Math.round((targetOn / targetCompared) * 100)
        : null,
    targetComparedCount: targetCompared,
    lastTempo,
    temposUsed: [...tempos].slice(0, 6),
    rirTrend,
    sessionsWithRir,
    sessionsWithRpe,
  };

  return {
    query: q,
    matchedExerciseNames,
    points,
    prs,
    intensity,
    metric,
    newMax,
    hasNewMax,
  };
}
