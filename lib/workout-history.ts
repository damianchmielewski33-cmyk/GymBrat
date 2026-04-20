import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workoutPlans, workouts } from "@/db/schema";
import { sessionVolume } from "@/lib/workout-session-calculations";

export type CompletedSessionSet = {
  reps?: number | null;
  weight?: number | null;
  done?: boolean;
};

export type CompletedSessionExercise = {
  id?: string;
  name?: string;
  sets?: CompletedSessionSet[];
};

export type CompletedSessionPayload = {
  kind?: "completed_session";
  title?: string;
  startedAt?: number;
  endedAt?: number;
  workoutPlanId?: string | null;
  exercises?: unknown;
};

export type CompletedWorkoutListItem = {
  id: string;
  date: string;
  title: string;
  startedAt: number | null;
  endedAt: number | null;
  workoutPlanId: string | null;
  planName: string | null;
  volumeKg: number;
  strengthScore: number;
};

export type CompletedWorkoutDetails = CompletedWorkoutListItem & {
  exercises: Array<{
    id: string;
    name: string;
    sets: Array<{ reps: number | null; weight: number; done: boolean; e1rm: number }>;
    bestE1rm: number;
    volumeKg: number;
  }>;
};

function safeNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function clampNonNegative(n: number | null, fallback = 0): number {
  if (n == null) return fallback;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, n);
}

function normalizeString(v: unknown, fallback = ""): string {
  if (typeof v !== "string") return fallback;
  return v.trim();
}

export function safeParseCompletedSession(json: string): CompletedSessionPayload | null {
  try {
    const o = JSON.parse(json) as unknown;
    if (!o || typeof o !== "object") return null;
    const p = o as CompletedSessionPayload;
    if (p.kind !== "completed_session") return null;
    return p;
  } catch {
    return null;
  }
}

export function safeNormalizeExercises(exercises: unknown): CompletedSessionExercise[] {
  if (!Array.isArray(exercises)) return [];
  return exercises.map((raw) => {
    const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
    const setsRaw = Array.isArray(r?.sets) ? (r?.sets as unknown[]) : [];
    const sets: CompletedSessionSet[] = setsRaw
      .map((s) => (s && typeof s === "object" ? (s as CompletedSessionSet) : null))
      .filter(Boolean) as CompletedSessionSet[];
    return {
      id: normalizeString(r?.id, ""),
      name: normalizeString(r?.name, ""),
      sets,
    };
  });
}

/** Epley estimated 1RM: \(w * (1 + reps/30)\). */
export function estimated1RM(weight: number, reps: number): number {
  const w = clampNonNegative(weight, 0);
  const r = clampNonNegative(reps, 0);
  if (w <= 0 || r <= 0) return 0;
  return w * (1 + r / 30);
}

export function computeWorkoutDetails(input: {
  id: string;
  date: string;
  rawJson: string;
  workoutPlanId: string | null;
  planName: string | null;
}): CompletedWorkoutDetails | null {
  const parsed = safeParseCompletedSession(input.rawJson);
  if (!parsed) return null;

  const title = normalizeString(parsed.title, "Trening") || "Trening";
  const startedAt = safeNumber(parsed.startedAt);
  const endedAt = safeNumber(parsed.endedAt);
  const ex = safeNormalizeExercises(parsed.exercises);

  const normalizedExercises = ex
    .filter((e) => normalizeString(e.name, "").length > 0)
    .map((e, idx) => {
      const id = normalizeString(e.id, `ex_${idx}`);
      const name = normalizeString(e.name, `Ćwiczenie ${idx + 1}`);
      const sets = (e.sets ?? []).map((s) => {
        const reps = safeNumber(s.reps);
        const weight = clampNonNegative(safeNumber(s.weight), 0);
        const done = Boolean(s.done) && reps != null && reps > 0 && weight > 0;
        const e1rm = done && reps != null ? estimated1RM(weight, reps) : 0;
        return { reps: reps != null ? Math.round(reps) : null, weight, done, e1rm };
      });

      const bestE1rm = sets.reduce((m, s) => Math.max(m, s.e1rm), 0);
      const volumeKg = sessionVolume([{ sets: sets.map((s) => ({ reps: s.reps, weight: s.weight })) }]);

      return {
        id,
        name,
        sets,
        bestE1rm,
        volumeKg,
      };
    });

  const volumeKg = sessionVolume(
    normalizedExercises.map((e) => ({
      sets: e.sets.map((s) => ({ reps: s.reps, weight: s.weight })),
    })),
  );

  // Strength score: sum of best e1RM per exercise (stable across set count).
  const strengthScore = normalizedExercises.reduce((sum, e) => sum + e.bestE1rm, 0);

  return {
    id: input.id,
    date: input.date,
    title,
    startedAt,
    endedAt,
    workoutPlanId: input.workoutPlanId,
    planName: input.planName,
    volumeKg,
    strengthScore,
    exercises: normalizedExercises,
  };
}

function safePlanNameFromJson(planJson: string | null): string | null {
  if (!planJson) return null;
  try {
    const o = JSON.parse(planJson) as unknown;
    if (!o || typeof o !== "object") return null;
    const r = o as Record<string, unknown>;
    const name = normalizeString(r.name, "");
    return name.length ? name : null;
  } catch {
    return null;
  }
}

export async function getCompletedWorkoutsForUser(userId: string, input?: { limit?: number }) {
  const db = getDb();
  const limit = Math.max(1, Math.min(500, Math.round(input?.limit ?? 100)));

  const rows = await db
    .select({
      id: workouts.id,
      date: workouts.date,
      workoutPlanId: workouts.workoutPlanId,
      exercisesJson: workouts.exercises,
      planJson: workoutPlans.planJson,
      planUpdatedAt: workoutPlans.updatedAt,
    })
    .from(workouts)
    .leftJoin(workoutPlans, eq(workouts.workoutPlanId, workoutPlans.id))
    .where(eq(workouts.userId, userId))
    .orderBy(desc(workouts.date))
    .limit(limit);

  const out: CompletedWorkoutListItem[] = [];
  for (const r of rows) {
    const planName = safePlanNameFromJson(r.planJson ?? null);
    const details = computeWorkoutDetails({
      id: r.id,
      date: r.date,
      rawJson: r.exercisesJson,
      workoutPlanId: r.workoutPlanId ?? null,
      planName,
    });
    if (!details) continue;
    out.push({
      id: details.id,
      date: details.date,
      title: details.title,
      startedAt: details.startedAt,
      endedAt: details.endedAt,
      workoutPlanId: details.workoutPlanId,
      planName: details.planName,
      volumeKg: details.volumeKg,
      strengthScore: details.strengthScore,
    });
  }
  return out;
}

export async function getCompletedWorkoutByIdForUser(userId: string, workoutId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      id: workouts.id,
      date: workouts.date,
      workoutPlanId: workouts.workoutPlanId,
      exercisesJson: workouts.exercises,
      planJson: workoutPlans.planJson,
    })
    .from(workouts)
    .leftJoin(workoutPlans, eq(workouts.workoutPlanId, workoutPlans.id))
    .where(and(eq(workouts.userId, userId), eq(workouts.id, workoutId)))
    .limit(1);

  if (!row) return null;
  const planName = safePlanNameFromJson(row.planJson ?? null);
  return computeWorkoutDetails({
    id: row.id,
    date: row.date,
    rawJson: row.exercisesJson,
    workoutPlanId: row.workoutPlanId ?? null,
    planName,
  });
}

export async function getStrengthTrendForPlan(userId: string, workoutPlanId: string, input?: { limit?: number }) {
  const db = getDb();
  const limit = Math.max(2, Math.min(200, Math.round(input?.limit ?? 20)));

  const rows = await db
    .select({
      id: workouts.id,
      date: workouts.date,
      exercisesJson: workouts.exercises,
      planJson: workoutPlans.planJson,
    })
    .from(workouts)
    .leftJoin(workoutPlans, eq(workouts.workoutPlanId, workoutPlans.id))
    .where(and(eq(workouts.userId, userId), eq(workouts.workoutPlanId, workoutPlanId)))
    .orderBy(desc(workouts.date))
    .limit(limit);

  const items = rows
    .map((r) => {
      const planName = safePlanNameFromJson(r.planJson ?? null);
      return computeWorkoutDetails({
        id: r.id,
        date: r.date,
        rawJson: r.exercisesJson,
        workoutPlanId,
        planName,
      });
    })
    .filter(Boolean) as CompletedWorkoutDetails[];

  items.sort((a, b) => a.date.localeCompare(b.date));

  return {
    planName: items[items.length - 1]?.planName ?? null,
    points: items.map((w) => ({ date: w.date, strengthScore: w.strengthScore, volumeKg: w.volumeKg })),
  };
}

export function deltaPercent(current: number, prev: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(prev) || prev === 0) return null;
  return ((current - prev) / Math.abs(prev)) * 100;
}

export function formatPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const r = Math.round(v * 10) / 10;
  return `${r > 0 ? "+" : ""}${r}%`;
}

export function formatCompact(n: number): string {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 }).format(clampNonNegative(n, 0));
}
