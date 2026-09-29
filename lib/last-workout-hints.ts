import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workouts } from "@/db/schema";
import type { WorkoutExerciseState, WorkoutSetState } from "@/components/workout/types";

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
      skipped?: boolean;
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

export type ProgressionKind = "increase" | "hold" | "hold_reps";

export type ProgressionSuggestion = {
  /** Decyzja na poziomie ćwiczenia (bump vs hold). */
  kind: ProgressionKind;
  reason: string;
};

/** Zaokrąglenie do kroku 2.5 kg. */
export function roundToPlateStep(kg: number, step = 2.5): number {
  if (!Number.isFinite(kg) || kg <= 0) return 0;
  return Math.round(kg / step) * step;
}

function isWorkingSet(s: WorkoutSetState): boolean {
  if (s.skipped) return false;
  return (Number(s.weight) || 0) > 0;
}

/**
 * Double progression: +2.5 kg gdy wszystkie wykonane serie ≥ cel powtórzeń i RIR ≥ 2;
 * inaczej ten sam ciężar (z powodem: reps albo RIR).
 */
export function suggestProgressionFromLastSets(args: {
  sets: WorkoutSetState[];
  targetReps?: number | null;
}): ProgressionSuggestion | null {
  const working = args.sets.filter(isWorkingSet);
  if (working.length === 0) return null;

  const target =
    args.targetReps != null &&
    Number.isFinite(args.targetReps) &&
    args.targetReps > 0
      ? Math.round(args.targetReps)
      : null;

  if (target == null) {
    return {
      kind: "hold",
      reason: "Ten sam ciężar — brak celu powtórzeń w planie",
    };
  }

  const allHitReps = working.every(
    (s) => s.reps != null && Number.isFinite(s.reps) && s.reps >= target,
  );
  if (!allHitReps) {
    return {
      kind: "hold_reps",
      reason: "Ten sam ciężar — najpierw dociągnij powtórzenia do celu",
    };
  }

  const allEasyRir = working.every(
    (s) => s.rir != null && Number.isFinite(s.rir) && s.rir >= 2,
  );
  if (!allEasyRir) {
    return {
      kind: "hold",
      reason: "Ten sam ciężar — ostatnio RIR poniżej 2",
    };
  }

  return {
    kind: "increase",
    reason: "Ostatnio cel powtórzeń i RIR ≥ 2 — +2,5 kg",
  };
}

/** Sugestia kg dla jednej serii na podstawie decyzji progresji i ostatniego ciężaru. */
export function applyProgressionToWeight(
  lastWeight: number,
  kind: ProgressionKind,
): number {
  const base = Math.max(0, Number(lastWeight) || 0);
  if (base <= 0) return 0;
  return roundToPlateStep(kind === "increase" ? base + 2.5 : base);
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
      const skipped = Boolean(s.skipped);
      return {
        reps: Number.isFinite(reps as number) ? reps : null,
        weight,
        done,
        skipped,
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

/** Scala podpowiedzi z ostatniej sesji do bieżącej sesji (tylko gdy serie się zgadzają liczebnie). */
export function mergeHintsIntoExercises(
  exercises: WorkoutExerciseState[],
  hints: LastPlanHintsMap,
): WorkoutExerciseState[] {
  return exercises.map((ex) => {
    const h = hints[ex.id];
    if (!h?.sets?.length) return ex;

    const progression = suggestProgressionFromLastSets({
      sets: h.sets,
      targetReps: ex.targetReps,
    });

    const suggestedWeights = ex.sets.map((_, i) => {
      const hs = h.sets[i] ?? h.sets[h.sets.length - 1];
      if (!hs || hs.weight <= 0 || !progression) return null;
      return applyProgressionToWeight(hs.weight, progression.kind);
    });
    const suggestionReason = progression?.reason ?? null;

    if (h.sets.length !== ex.sets.length) {
      return {
        ...ex,
        suggestedWeights,
        suggestionReason,
        note: ex.note?.trim() ? ex.note : h.note,
      };
    }
    const sets = ex.sets.map((s, i) => {
      const hs = h.sets[i];
      if (!hs) return s;
      return {
        ...s,
        // Ciężar zostaje 0 — użytkownik klika chip „Sugestia”.
        reps: s.reps != null ? s.reps : hs.reps,
        rpe: hs.rpe != null ? hs.rpe : s.rpe,
        rir: hs.rir != null ? hs.rir : s.rir,
      };
    });
    return {
      ...ex,
      sets,
      suggestedWeights,
      suggestionReason,
      note: ex.note?.trim() ? ex.note : h.note,
    };
  });
}
