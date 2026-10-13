import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workouts } from "@/db/schema";
import type {
  ExerciseCoachContext,
  WorkoutExerciseState,
  WorkoutSetState,
} from "@/components/workout/types";
import { suggestedWeightFromProgression } from "@/lib/set-progression-suggestion";
import { isCompletedWorkoutSet } from "@/lib/workout-skipped-sets";

type CompletedPayload = {
  kind?: string;
  exercises?: Array<{
    id?: string;
    name?: string;
    sets?: Array<{
      reps?: unknown;
      weight?: unknown;
      rpe?: unknown;
      rir?: unknown;
      done?: boolean;
    }>;
    note?: string;
  }>;
};

function parseCompleted(json: string): CompletedPayload | null {
  try {
    const o = JSON.parse(json) as unknown;
    if (!o || typeof o !== "object") return null;
    const base = o as Record<string, unknown>;
    if (base.kind === "completed_session") return base as CompletedPayload;
    if (Array.isArray(base.exercises)) return base as CompletedPayload;
    return null;
  } catch {
    return null;
  }
}

function mapSets(
  setsRaw: NonNullable<NonNullable<CompletedPayload["exercises"]>[number]["sets"]>,
): WorkoutSetState[] {
  return setsRaw.map((s) => {
    const repsRaw = s.reps;
    const reps =
      repsRaw == null || repsRaw === ""
        ? null
        : Math.max(0, Math.round(Number(repsRaw)));
    const weight = Math.max(0, Number(s.weight ?? 0));
    const rpeRaw = s.rpe;
    const rpe =
      rpeRaw != null && rpeRaw !== ""
        ? Math.max(1, Math.min(10, Math.round(Number(rpeRaw))))
        : null;
    const rirRaw = s.rir;
    const rir =
      rirRaw != null && rirRaw !== ""
        ? Math.max(0, Math.min(5, Math.round(Number(rirRaw))))
        : null;
    const done = Boolean(s.done);
    return {
      reps: Number.isFinite(reps as number) ? reps : null,
      weight,
      done,
      rpe,
      rir,
    };
  });
}

export type LastPlanHintsMap = Record<
  string,
  {
    sets: WorkoutSetState[];
    note?: string;
    coachContext?: ExerciseCoachContext;
  }
>;

const HISTORY_LIMIT = 4;
const STAGNATION_SESSIONS = 3;

/** Zaokrąglenie do kroku 2.5 kg. */
export function roundToPlateStep(kg: number, step = 2.5): number {
  if (!Number.isFinite(kg) || kg <= 0) return 0;
  return Math.round(kg / step) * step;
}

function topSetWeight(sets: WorkoutSetState[]): number {
  let max = 0;
  for (const s of sets) {
    if (!isCompletedWorkoutSet(s)) continue;
    if (s.weight > max) max = s.weight;
  }
  return max;
}

function bestRepsAtTop(sets: WorkoutSetState[]): number {
  const top = topSetWeight(sets);
  if (top <= 0) return 0;
  let best = 0;
  for (const s of sets) {
    if (!isCompletedWorkoutSet(s) || s.weight < top * 0.98) continue;
    if (s.reps != null && s.reps > best) best = s.reps;
  }
  return best;
}

function parseWorkoutDateMs(dateStr: string): number | null {
  const t = Date.parse(dateStr);
  if (Number.isFinite(t)) return t;
  // YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(ms) ? ms : null;
}

function daysBetween(olderMs: number, newerMs: number): number {
  return Math.max(0, Math.floor((newerMs - olderMs) / (24 * 60 * 60 * 1000)));
}

function isStagnant(
  sessions: Array<{ topKg: number; bestReps: number }>,
): boolean {
  if (sessions.length < STAGNATION_SESSIONS) return false;
  const recent = sessions.slice(0, STAGNATION_SESSIONS);
  // sessions[0] = najnowszy
  for (let i = 0; i < recent.length - 1; i++) {
    const newer = recent[i]!;
    const older = recent[i + 1]!;
    if (newer.topKg > older.topKg + 0.25) return false;
    if (
      Math.abs(newer.topKg - older.topKg) <= 0.25 &&
      newer.bestReps > older.bestReps
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Sugestia ciężaru: double progression (RIR-first, bez easy_anywhere).
 * Hard nie dokładamy kg (stary fallback RIR≤1 → +2.5 usunięty).
 */
export function suggestWeightFromLastSet(
  last: {
    weight: number;
    reps?: number | null;
    rpe?: number | null;
    rir?: number | null;
  },
  targetReps?: number | null,
  opts?: {
    priorSets?: Array<{
      weight: number;
      reps?: number | null;
      rpe?: number | null;
      rir?: number | null;
    }>;
    exerciseName?: string;
    categoryId?: string | null;
    setIndex?: number;
  },
): number {
  const fromProgression = suggestedWeightFromProgression({
    last: {
      weight: last.weight,
      reps: last.reps ?? null,
      rpe: last.rpe,
      rir: last.rir,
    },
    targetReps,
    priorSets: opts?.priorSets?.map((s) => ({
      weight: s.weight,
      reps: s.reps ?? null,
      rpe: s.rpe,
      rir: s.rir,
    })),
    exerciseName: opts?.exerciseName,
    movementKind: undefined,
    setIndex: opts?.setIndex,
  });
  if (fromProgression != null && fromProgression > 0) return fromProgression;
  const base = Math.max(0, Number(last.weight) || 0);
  if (base <= 0) return 0;
  return Math.round(base * 2) / 2;
}

type SessionEx = {
  dateMs: number;
  sets: WorkoutSetState[];
  note?: string;
};

/**
 * Ostatnie 2–4 sesje z planu — lastSessionSets + coachContext (przerwa, stagnacja).
 */
export async function getLastWorkoutHintsForPlan(
  userId: string,
  planId: string,
): Promise<LastPlanHintsMap> {
  const db = getDb();
  const rows = await db
    .select({ exercises: workouts.exercises, date: workouts.date })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.workoutPlanId, planId)))
    .orderBy(desc(workouts.date))
    .limit(HISTORY_LIMIT);

  if (!rows.length) return {};

  const byExercise = new Map<string, SessionEx[]>();

  for (const row of rows) {
    const dateMs = parseWorkoutDateMs(row.date) ?? Date.now();
    const parsed = parseCompleted(row.exercises);
    const list = parsed?.exercises;
    if (!Array.isArray(list)) continue;
    for (const ex of list) {
      const id = typeof ex.id === "string" ? ex.id : "";
      if (!id) continue;
      const setsRaw = Array.isArray(ex.sets) ? ex.sets : [];
      const sets = mapSets(setsRaw);
      if (!sets.some((s) => isCompletedWorkoutSet(s) && s.weight > 0)) continue;
      const arr = byExercise.get(id) ?? [];
      arr.push({
        dateMs,
        sets,
        note: typeof ex.note === "string" ? ex.note : undefined,
      });
      byExercise.set(id, arr);
    }
  }

  const now = Date.now();
  const out: LastPlanHintsMap = {};

  for (const [id, sessions] of byExercise) {
    // rows już DESC; w ramach id mogą być w kolejności dodania = kolejność rows
    sessions.sort((a, b) => b.dateMs - a.dateMs);
    const latest = sessions[0]!;
    const tops = sessions.map((s) => ({
      topKg: topSetWeight(s.sets),
      bestReps: bestRepsAtTop(s.sets),
    }));
    const topWeights = tops.map((t) => t.topKg).filter((w) => w > 0);
    const avgTop =
      topWeights.length > 0
        ? topWeights.reduce((a, b) => a + b, 0) / topWeights.length
        : null;

    const coachContext: ExerciseCoachContext = {
      daysSinceLastSession: daysBetween(latest.dateMs, now),
      recentSessionCount: sessions.length,
      avgTopSetWeightKg: avgTop,
      stagnant: isStagnant(tops),
    };

    out[id] = {
      sets: latest.sets,
      note: latest.note,
      coachContext,
    };
  }

  return out;
}

/** Scala podpowiedzi z ostatniej sesji do bieżącej sesji. */
export function mergeHintsIntoExercises(
  exercises: WorkoutExerciseState[],
  hints: LastPlanHintsMap,
): WorkoutExerciseState[] {
  return exercises.map((ex) => {
    const h = hints[ex.id];
    if (!h?.sets?.length) return ex;
    const lastSessionSets = ex.sets.map((_, i) => {
      const hs = h.sets[i] ?? h.sets[h.sets.length - 1] ?? null;
      return hs;
    });
    const workingHist = h.sets.filter(
      (s) => s.weight > 0 && s.reps != null && s.reps > 0,
    );
    const suggestedWeights = ex.sets.map((_, i) => {
      // Chip pierwszej serii: decyzja z całego bloku ostatniej sesji (trailing easy).
      // Kolejne chipy: odpowiadająca seria + prior w tej sesji.
      const last =
        i === 0
          ? (workingHist[workingHist.length - 1] ?? lastSessionSets[i])
          : lastSessionSets[i];
      if (!last || last.weight <= 0) return null;
      const priorSets =
        i === 0
          ? workingHist.slice(0, -1).slice(-3)
          : workingHist.slice(0, Math.min(i, workingHist.length));

      return suggestWeightFromLastSet(
        {
          weight: last.weight,
          reps: last.reps,
          rir: last.rir,
          rpe: last.rpe,
        },
        ex.targetReps,
        {
          priorSets,
          exerciseName: ex.name,
          categoryId: ex.categoryId,
          setIndex: i,
        },
      );
    });
    const base = {
      ...ex,
      suggestedWeights,
      lastSessionSets,
      coachContext: h.coachContext ?? ex.coachContext,
      note: ex.note?.trim() ? ex.note : h.note,
    };
    if (h.sets.length !== ex.sets.length) {
      return base;
    }
    const sets = ex.sets.map((s, i) => {
      const hs = h.sets[i];
      if (!hs) return s;
      return {
        ...s,
        // Ciężar zostaje 0 — użytkownik klika chip „Sugestia” / „Dziś spróbuj”.
        reps: s.reps != null ? s.reps : hs.reps,
        rpe: hs.rpe != null ? hs.rpe : s.rpe,
        rir: hs.rir != null ? hs.rir : s.rir,
      };
    });
    return { ...base, sets };
  });
}
