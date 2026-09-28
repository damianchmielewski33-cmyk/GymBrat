import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workouts } from "@/db/schema";
import type { WorkoutExerciseState, WorkoutSetState } from "@/components/workout/types";
import { pickBestSetForSuggestion, suggestNextWeightKg } from "@/lib/suggest-weight";
import { normalizeTempo } from "@/lib/exercise-video";

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
      tempo?: unknown;
      done?: boolean;
    }>;
    note?: string;
    tempo?: string;
    videoUrl?: string;
    catalogId?: string;
    supersetGroupId?: string;
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

function parseOptionalInt(raw: unknown, min: number, max: number): number | null {
  if (raw == null || raw === "") return null;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}

export type LastPlanHintsMap = Record<
  string,
  {
    sets: WorkoutSetState[];
    note?: string;
    suggestedWeightKg?: number | null;
  }
>;

/** Ostatnia sesja z danego planu — podpowiedzi ciężaru/RPE/RIR po id ćwiczenia z planu. */
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
      const rpe = parseOptionalInt(s.rpe, 1, 10);
      const rir = parseOptionalInt(s.rir, 0, 5);
      const tempo = normalizeTempo(typeof s.tempo === "string" ? s.tempo : null);
      const done = Boolean(s.done);
      return {
        reps: Number.isFinite(reps as number) ? reps : null,
        weight,
        done,
        rpe,
        rir,
        tempo,
      };
    });
    const suggestBase = pickBestSetForSuggestion(sets);
    const suggestedWeightKg = suggestBase ? suggestNextWeightKg(suggestBase) : null;
    out[id] = {
      sets,
      note: typeof ex.note === "string" ? ex.note : undefined,
      suggestedWeightKg,
    };
  }
  return out;
}

/** Scala podpowiedzi z ostatniej sesji do bieżącej sesji (tylko gdy serie się zgadzają liczebnie). */
export function mergeHintsIntoExercises(
  exercises: WorkoutExerciseState[],
  hints: LastPlanHintsMap,
): WorkoutExerciseState[] {
  return exercises.map((ex) => {
    const h = hints[ex.id];
    if (!h?.sets?.length) return ex;
    const suggested = h.suggestedWeightKg ?? null;
    if (h.sets.length !== ex.sets.length) {
      return {
        ...ex,
        suggestedWeightKg: suggested,
        note: ex.note?.trim() ? ex.note : h.note,
      };
    }
    const sets = ex.sets.map((s, i) => {
      const hs = h.sets[i];
      if (!hs) return s;
      const weight =
        hs.weight > 0
          ? hs.weight
          : suggested != null && suggested > 0
            ? suggested
            : s.weight;
      return {
        ...s,
        weight,
        reps: hs.reps != null ? hs.reps : s.reps,
        rpe: hs.rpe != null ? hs.rpe : s.rpe,
        rir: hs.rir != null ? hs.rir : s.rir,
        tempo: hs.tempo ?? s.tempo ?? ex.tempo ?? null,
      };
    });
    return {
      ...ex,
      sets,
      note: ex.note?.trim() ? ex.note : h.note,
      targetReps: ex.targetReps,
      suggestedWeightKg: suggested,
    };
  });
}
