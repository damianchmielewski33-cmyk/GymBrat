import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workouts } from "@/db/schema";
import type { WorkoutExerciseState, WorkoutSetState } from "@/components/workout/types";
import { suggestedWeightFromProgression } from "@/lib/set-progression-suggestion";

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

export type LastPlanHintsMap = Record<
  string,
  {
    sets: WorkoutSetState[];
    note?: string;
  }
>;

/** Zaokrąglenie do kroku 2.5 kg. */
export function roundToPlateStep(kg: number, step = 2.5): number {
  if (!Number.isFinite(kg) || kg <= 0) return 0;
  return Math.round(kg / step) * step;
}

/**
 * Sugestia ciężaru: ostatni ciężar; +2.5 kg gdy RIR≤1 lub RPE≥8
 * albo gdy ostatnio była góra zakresu powtórzeń.
 */
export function suggestWeightFromLastSet(
  last: {
    weight: number;
    reps?: number | null;
    rpe?: number | null;
    rir?: number | null;
  },
  targetReps?: number | null,
): number {
  const fromProgression = suggestedWeightFromProgression({
    last: {
      weight: last.weight,
      reps: last.reps ?? null,
      rpe: last.rpe,
      rir: last.rir,
    },
    targetReps,
  });
  if (fromProgression != null && fromProgression > 0) return fromProgression;
  const base = Math.max(0, Number(last.weight) || 0);
  if (base <= 0) return 0;
  const hard =
    (last.rir != null && Number.isFinite(last.rir) && last.rir <= 1) ||
    (last.rpe != null && Number.isFinite(last.rpe) && last.rpe >= 8);
  return roundToPlateStep(hard ? base + 2.5 : base);
}

/** Ostatnia sesja z danego planu — podpowiedzi ciężaru/RPE po id ćwiczenia z planu. */
export async function getLastWorkoutHintsForPlan(
  userId: string,
  planId: string,
): Promise<LastPlanHintsMap> {
  const db = getDb();
  const [row] = await db
    .select({ exercises: workouts.exercises })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.workoutPlanId, planId)))
    .orderBy(desc(workouts.date))
    .limit(1);

  if (!row) return {};

  const parsed = parseCompleted(row.exercises);
  const list = parsed?.exercises;
  if (!Array.isArray(list)) return {};

  const out: LastPlanHintsMap = {};
  for (const ex of list) {
    const id = typeof ex.id === "string" ? ex.id : "";
    if (!id) continue;
    const setsRaw = Array.isArray(ex.sets) ? ex.sets : [];
    const sets: WorkoutSetState[] = setsRaw.map((s) => {
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
    out[id] = {
      sets,
      note: typeof ex.note === "string" ? ex.note : undefined,
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
    const suggestedWeights = ex.sets.map((_, i) => {
      const hs = lastSessionSets[i];
      if (!hs || hs.weight <= 0) return null;
      return suggestWeightFromLastSet(hs, ex.targetReps);
    });
    if (h.sets.length !== ex.sets.length) {
      return {
        ...ex,
        suggestedWeights,
        lastSessionSets,
        note: ex.note?.trim() ? ex.note : h.note,
      };
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
    return {
      ...ex,
      sets,
      suggestedWeights,
      lastSessionSets,
      note: ex.note?.trim() ? ex.note : h.note,
    };
  });
}
