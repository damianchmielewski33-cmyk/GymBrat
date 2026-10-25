import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workouts } from "@/db/schema";
import type {
  ExerciseCoachContext,
  ExerciseRecentSessionSnap,
  WorkoutExerciseState,
  WorkoutSetState,
} from "@/components/workout/types";
import {
  bestE1rmFromSets,
  buildE1rmTrendReport,
} from "@/lib/live-coach/e1rm-trend";
import { volumeFromSets } from "@/lib/live-coach/personal-records";
import {
  qualifiesRepsOnlyBump,
  resolveRepRange,
  suggestedWeightFromProgression,
} from "@/lib/set-progression-suggestion";
import { roundHoldKg } from "@/lib/weight-step";
import { isCompletedWorkoutSet } from "@/lib/workout-skipped-sets";

// Jedno źródło kroku talerza — re-export dla zgodności wstecznej importów.
export { roundToPlateStep } from "@/lib/set-progression-suggestion";

type CompletedPayload = {
  kind?: string;
  exercises?: Array<{
    id?: string;
    name?: string;
    targetRir?: unknown;
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

/** Domyślny RIR serii, gdy plan nie podaje celu (jak `planExercisesToSession`). */
const DEFAULT_SESSION_TARGET_RIR = 1;

/**
 * Serie robocze na ciężarze top (≥98%): najmniej powtórzeń i liczba serii.
 * Podstawa do „wszystkie serie na górze zakresu”.
 */
function repsAtTopStats(sets: WorkoutSetState[]): {
  minRepsAtTop: number;
  setsAtTop: number;
} {
  const top = topSetWeight(sets);
  if (top <= 0) return { minRepsAtTop: 0, setsAtTop: 0 };
  let min = Infinity;
  let count = 0;
  for (const s of sets) {
    if (!isCompletedWorkoutSet(s) || s.weight < top * 0.98) continue;
    if (s.reps == null || s.reps <= 0) continue;
    count += 1;
    if (s.reps < min) min = s.reps;
  }
  return { minRepsAtTop: Number.isFinite(min) ? min : 0, setsAtTop: count };
}

/**
 * Czy użytkownik realnie logował wysiłek: jakiekolwiek RPE albo RIR różny od
 * domyślnego celu z planu (sesja domyślnie wpisuje RIR = cel każdej serii).
 */
function effortReallyLogged(
  sets: WorkoutSetState[],
  defaultRir: number,
): boolean {
  for (const s of sets) {
    if (!isCompletedWorkoutSet(s)) continue;
    if (s.rpe != null && Number.isFinite(s.rpe)) return true;
    if (s.rir != null && Number.isFinite(s.rir) && s.rir !== defaultRir) {
      return true;
    }
  }
  return false;
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

function avgRirFromSets(sets: WorkoutSetState[]): number | null {
  const rirs: number[] = [];
  for (const s of sets) {
    if (!isCompletedWorkoutSet(s)) continue;
    if (s.rir != null && Number.isFinite(s.rir)) rirs.push(s.rir);
  }
  if (!rirs.length) return null;
  return rirs.reduce((a, b) => a + b, 0) / rirs.length;
}

/**
 * Stagnacja 2.0 — wszystkie warunki AND:
 * ≥3 sesje, brak wzrostu kg, reps, e1RM, średni RIR ≤1.
 * Rosnący e1RM wyklucza stagnację.
 */
export function isStagnantV2(
  sessions: Array<{
    topKg: number;
    bestReps: number;
    bestE1rm: number;
    avgRir: number | null;
  }>,
): boolean {
  if (sessions.length < STAGNATION_SESSIONS) return false;
  const recent = sessions.slice(0, STAGNATION_SESSIONS);

  // e1RM rośnie w oknie → nie stagnacja
  const e1Newest = recent[0]!.bestE1rm;
  const e1Oldest = recent[recent.length - 1]!.bestE1rm;
  if (e1Newest > 0 && e1Oldest > 0 && e1Newest > e1Oldest + 1.5) {
    return false;
  }

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
    if (newer.bestE1rm > older.bestE1rm + 1.5) return false;
  }

  const rirs = recent
    .map((s) => s.avgRir)
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (rirs.length === 0) return false;
  const meanRir = rirs.reduce((a, b) => a + b, 0) / rirs.length;
  if (meanRir > 1) return false;

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
    /** Cel RIR z planu (kontekst klasyfikacji wysiłku). */
    targetRir?: number | null;
    /** Jawny krok ciężaru ćwiczenia (kg). */
    weightStepKg?: number | null;
    /** Historia pozwala na +kg z samych powtórzeń. */
    repsOnlyBumpOk?: boolean;
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
    categoryId: opts?.categoryId,
    targetRir: opts?.targetRir,
    weightStepKg: opts?.weightStepKg,
    repsOnlyBumpOk: opts?.repsOnlyBumpOk,
    movementKind: undefined,
    setIndex: opts?.setIndex,
  });
  if (fromProgression != null && fromProgression > 0) return fromProgression;
  const base = Math.max(0, Number(last.weight) || 0);
  if (base <= 0) return 0;
  return roundHoldKg(base);
}

type SessionEx = {
  dateMs: number;
  sets: WorkoutSetState[];
  note?: string;
  /** Domyślny RIR serii w tej sesji (cel z planu albo 1). */
  defaultRir: number;
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
      const planRir = Number(ex.targetRir);
      arr.push({
        dateMs,
        sets,
        note: typeof ex.note === "string" ? ex.note : undefined,
        defaultRir: Number.isFinite(planRir)
          ? Math.round(planRir)
          : DEFAULT_SESSION_TARGET_RIR,
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
    const snaps: ExerciseRecentSessionSnap[] = sessions.map((s) => ({
      topKg: topSetWeight(s.sets),
      bestReps: bestRepsAtTop(s.sets),
      bestE1rm: bestE1rmFromSets(s.sets),
      avgRir: avgRirFromSets(s.sets),
      volumeKg: volumeFromSets(s.sets),
      ...repsAtTopStats(s.sets),
      effortLogged: effortReallyLogged(s.sets, s.defaultRir),
    }));
    const topWeights = snaps.map((t) => t.topKg).filter((w) => w > 0);
    const avgTop =
      topWeights.length > 0
        ? topWeights.reduce((a, b) => a + b, 0) / topWeights.length
        : null;

    const e1rmReport = buildE1rmTrendReport(snaps);
    const prWeight = Math.max(0, ...snaps.map((s) => s.topKg));
    const prReps = Math.max(0, ...snaps.map((s) => s.bestReps));
    const prVol = Math.max(0, ...snaps.map((s) => s.volumeKg));
    const prE1 = Math.max(0, ...snaps.map((s) => s.bestE1rm));

    const coachContext: ExerciseCoachContext = {
      daysSinceLastSession: daysBetween(latest.dateMs, now),
      recentSessionCount: sessions.length,
      avgTopSetWeightKg: avgTop,
      stagnant: isStagnantV2(snaps),
      e1rm: {
        last: e1rmReport.last,
        avg: e1rmReport.avg,
        best: e1rmReport.best,
        trend4: e1rmReport.trend4,
      },
      recentSessions: snaps,
      prs:
        prWeight > 0 || prE1 > 0
          ? {
              weightKg: prWeight,
              reps: prReps,
              volumeKg: prVol,
              e1rm: prE1,
            }
          : null,
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
    // Tylko rzeczywiście zaliczone serie (done, nie pominięte) mogą zasilać
    // podpowiedzi i sugestie — niezapisany projekt wartości (np. z chipa
    // podpowiedzi) nie ma `done: true` i nie trafia tutaj.
    const completedHistSets = h.sets.filter((s) => isCompletedWorkoutSet(s));
    const lastSessionSets = ex.sets.map((_, i) => {
      const hs =
        completedHistSets[i] ??
        completedHistSets[completedHistSets.length - 1] ??
        null;
      return hs;
    });
    const workingHist = completedHistSets.filter(
      (s) => s.weight > 0 && s.reps != null && s.reps > 0,
    );
    const repsOnlyBumpOk = qualifiesRepsOnlyBump(
      h.coachContext?.recentSessions,
      resolveRepRange(ex.targetReps),
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
          targetRir: ex.targetRir,
          weightStepKg: ex.weightStepKg,
          repsOnlyBumpOk,
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
