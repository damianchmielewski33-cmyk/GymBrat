import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { workouts } from "@/db/schema";
import {
  estimated1RM,
  normalizeRir,
  safeNormalizeExercises,
  safeParseCompletedSession,
} from "@/lib/workout-history";

export type ExerciseProgressPoint = {
  date: string; // YYYY-MM-DD (workouts.date)
  bestE1rm: number;
  bestWeight: number;
  bestReps: number;
  tonnageKg: number;
  avgRir: number | null;
  setsDone: number;
};

export type ExerciseSetCompare = {
  setIndex: number;
  weight: number;
  reps: number | null;
  rir: number | null;
  e1rm: number;
  prevWeight: number | null;
  prevReps: number | null;
  prevRir: number | null;
  weightDelta: number | null;
  repsDelta: number | null;
};

export type ExercisePrs = {
  maxE1rm: { value: number; date: string | null };
  maxWeight: { value: number; date: string | null };
  maxTonnageKg: { value: number; date: string | null };
};

function clampNonNegative(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function safeRound1(n: number): number {
  return Math.round(n * 10) / 10;
}

function normalizeExerciseName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function matchesQuery(name: string, q: string): boolean {
  const n = name.toLowerCase();
  const qq = q.toLowerCase();
  return n.includes(qq);
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

  const names = new Map<string, number>();
  for (const r of rows) {
    const parsed = safeParseCompletedSession(r.exercisesJson);
    if (!parsed) continue;
    const ex = safeNormalizeExercises(parsed.exercises);
    for (const e of ex) {
      const name = normalizeExerciseName(e.name ?? "");
      if (!name) continue;
      names.set(name, (names.get(name) ?? 0) + 1);
    }
  }

  return [...names.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
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
  newMax: { e1rm: boolean; weight: boolean; tonnage: boolean };
  hasNewMax: boolean;
  setCompare: ExerciseSetCompare[];
  latestSessionDate: string | null;
  previousSessionDate: string | null;
}> {
  const q = params.exerciseQuery.trim();
  if (!q) {
    return {
      query: "",
      matchedExerciseNames: [],
      points: [],
      prs: {
        maxE1rm: { value: 0, date: null },
        maxWeight: { value: 0, date: null },
        maxTonnageKg: { value: 0, date: null },
      },
      newMax: { e1rm: false, weight: false, tonnage: false },
      hasNewMax: false,
      setCompare: [],
      latestSessionDate: null,
      previousSessionDate: null,
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
      rirSum: number;
      rirCount: number;
      setsDone: number;
    }
  >();

  const matchedNameCounts = new Map<string, number>();
  type SessionSnap = {
    date: string;
    sets: Array<{ weight: number; reps: number | null; rir: number | null; e1rm: number }>;
  };
  const sessionSnaps: SessionSnap[] = [];

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
    let dayRirSum = 0;
    let dayRirCount = 0;
    let daySets = 0;
    const sessionSets: SessionSnap["sets"] = [];

    for (const e of ex) {
      const name = normalizeExerciseName(e.name ?? "");
      if (!name) continue;
      if (!matchesQuery(name, q)) continue;

      matchedNameCounts.set(name, (matchedNameCounts.get(name) ?? 0) + 1);

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
        const skipped = Boolean(s.skipped);
        const done = Boolean(s.done) && !skipped && reps != null && reps > 0 && w > 0;
        if (!done) continue;

        daySets += 1;
        dayTonnage += reps! * w;
        const e1rm = estimated1RM(w, reps!);
        const rir = normalizeRir(s.rir);
        if (rir != null) {
          dayRirSum += rir;
          dayRirCount += 1;
        }
        sessionSets.push({ weight: w, reps, rir, e1rm: safeRound1(e1rm) });
        if (w > dayBestWeight) {
          dayBestWeight = w;
          dayBestReps = reps!;
        }
        if (e1rm > dayBestE1rm) {
          dayBestE1rm = e1rm;
        }
      }
    }

    if (dayTonnage <= 0 || dayBestE1rm <= 0) continue;

    if (sessionSets.length) {
      sessionSnaps.push({ date: dateKey, sets: sessionSets });
    }

    const prev = byDay.get(dateKey);
    if (!prev) {
      byDay.set(dateKey, {
        bestE1rm: dayBestE1rm,
        bestWeight: dayBestWeight,
        bestReps: dayBestReps,
        tonnageKg: dayTonnage,
        rirSum: dayRirSum,
        rirCount: dayRirCount,
        setsDone: daySets,
      });
    } else {
      const weightWins = dayBestWeight > prev.bestWeight;
      byDay.set(dateKey, {
        bestE1rm: Math.max(prev.bestE1rm, dayBestE1rm),
        bestWeight: Math.max(prev.bestWeight, dayBestWeight),
        bestReps: weightWins ? dayBestReps : prev.bestReps,
        tonnageKg: prev.tonnageKg + dayTonnage,
        rirSum: prev.rirSum + dayRirSum,
        rirCount: prev.rirCount + dayRirCount,
        setsDone: prev.setsDone + daySets,
      });
    }
  }

  const points: ExerciseProgressPoint[] = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({
      date,
      bestE1rm: safeRound1(v.bestE1rm),
      bestWeight: safeRound1(v.bestWeight),
      bestReps: Math.round(v.bestReps),
      tonnageKg: safeRound1(v.tonnageKg),
      avgRir: v.rirCount > 0 ? safeRound1(v.rirSum / v.rirCount) : null,
      setsDone: v.setsDone,
    }));

  // rows są DESC — sessionSnaps od najnowszych; bierzemy 2 najnowsze sesje.
  const latestSnap = sessionSnaps[0] ?? null;
  const previousSnap = sessionSnaps[1] ?? null;
  const setCompare: ExerciseSetCompare[] = [];
  if (latestSnap) {
    const maxLen = Math.max(
      latestSnap.sets.length,
      previousSnap?.sets.length ?? 0,
    );
    for (let i = 0; i < maxLen; i++) {
      const cur = latestSnap.sets[i];
      const prev = previousSnap?.sets[i];
      if (!cur && !prev) continue;
      setCompare.push({
        setIndex: i,
        weight: cur?.weight ?? 0,
        reps: cur?.reps ?? null,
        rir: cur?.rir ?? null,
        e1rm: cur?.e1rm ?? 0,
        prevWeight: prev?.weight ?? null,
        prevReps: prev?.reps ?? null,
        prevRir: prev?.rir ?? null,
        weightDelta:
          cur && prev ? Math.round((cur.weight - prev.weight) * 10) / 10 : null,
        repsDelta:
          cur?.reps != null && prev?.reps != null ? cur.reps - prev.reps : null,
      });
    }
  }

  const prs: ExercisePrs = {
    maxE1rm: { value: 0, date: null },
    maxWeight: { value: 0, date: null },
    maxTonnageKg: { value: 0, date: null },
  };
  for (const p of points) {
    if (p.bestE1rm > prs.maxE1rm.value) prs.maxE1rm = { value: p.bestE1rm, date: p.date };
    if (p.bestWeight > prs.maxWeight.value) prs.maxWeight = { value: p.bestWeight, date: p.date };
    if (p.tonnageKg > prs.maxTonnageKg.value)
      prs.maxTonnageKg = { value: p.tonnageKg, date: p.date };
  }

  const latest = points.length > 0 ? points[points.length - 1]! : null;
  const priorPoints = points.slice(0, -1);
  const priorMaxE1rm = priorPoints.reduce((m, p) => Math.max(m, p.bestE1rm), 0);
  const priorMaxWeight = priorPoints.reduce((m, p) => Math.max(m, p.bestWeight), 0);
  const priorMaxTonnage = priorPoints.reduce((m, p) => Math.max(m, p.tonnageKg), 0);
  const newMax = {
    e1rm: Boolean(latest && latest.bestE1rm > priorMaxE1rm && priorPoints.length > 0),
    weight: Boolean(
      latest && latest.bestWeight > priorMaxWeight && priorPoints.length > 0,
    ),
    tonnage: Boolean(
      latest && latest.tonnageKg > priorMaxTonnage && priorPoints.length > 0,
    ),
  };
  const hasNewMax = newMax.e1rm || newMax.weight || newMax.tonnage;

  const matchedExerciseNames = [...matchedNameCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .slice(0, 12);

  return {
    query: q,
    matchedExerciseNames,
    points,
    prs,
    newMax,
    hasNewMax,
    setCompare,
    latestSessionDate: latestSnap?.date ?? null,
    previousSessionDate: previousSnap?.date ?? null,
  };
}

