"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { workouts } from "@/db/schema";
import {
  canEditWorkout,
  workoutEditDeadlineMs,
} from "@/lib/workout-history-overview";
import {
  safeParseCompletedSession,
  safeNormalizeExercises,
} from "@/lib/workout-history";
import { completedSessionJsonForCompare } from "@/lib/workout-plan-compare";
import { UserMessages } from "@/lib/user-facing-errors";

function preprocessReps(val: unknown): unknown {
  if (val === undefined) return undefined;
  if (val === null) return null;
  let n: number;
  if (typeof val === "string") {
    const t = String(val).replace(",", ".").trim();
    if (t === "") return null;
    n = Number(t);
  } else if (typeof val === "number") {
    n = val;
  } else {
    return null;
  }
  if (!Number.isFinite(n)) return null;
  return Math.min(500, Math.max(0, Math.round(n)));
}

function preprocessWeightKg(val: unknown): unknown {
  if (val === undefined || val === null) return 0;
  let n: number;
  if (typeof val === "string") {
    const t = String(val).replace(",", ".").replace(/\s/g, "").trim();
    if (t === "") return 0;
    n = Number(t);
  } else if (typeof val === "number") {
    n = val;
  } else {
    return 0;
  }
  if (!Number.isFinite(n)) return 0;
  return Math.min(2000, Math.max(0, n));
}

const setSchema = z.object({
  reps: z.preprocess(
    preprocessReps,
    z.number().int().min(0).max(500).nullable(),
  ),
  weight: z.preprocess(preprocessWeightKg, z.number().min(0).max(2000)),
  done: z.boolean().optional(),
  skipped: z.boolean().optional(),
  rir: z.union([z.number().finite().min(0).max(5), z.null()]).optional(),
  rpe: z.union([z.number().finite().min(1).max(10), z.null()]).optional(),
});

const exerciseSchema = z.object({
  id: z.string().max(128),
  name: z.string().min(1).max(500),
  note: z.string().max(4000).nullish(),
  targetSets: z.number().int().min(1).max(20).nullish(),
  targetReps: z.number().int().min(1).max(99).nullish(),
  targetRir: z.union([z.number().finite().min(0).max(5), z.null()]).optional(),
  tempo: z.string().max(16).nullish(),
  sets: z.array(setSchema).min(0).max(200),
});

const bodySchema = z.object({
  workoutId: z.string().min(1).max(128),
  exercises: z.array(exerciseSchema).min(1).max(200),
});

export async function updateCompletedWorkout(input: {
  workoutId: string;
  exercises: Array<{
    id: string;
    name: string;
    note?: string | null;
    targetSets?: number | null;
    targetReps?: number | null;
    targetRir?: number | null;
    tempo?: string | null;
    sets: Array<{
      reps: number | null;
      weight: number;
      done?: boolean;
      skipped?: boolean;
      rir?: number | null;
      rpe?: number | null;
    }>;
  }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false as const, error: UserMessages.sessionExpired };
  }

  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Niepoprawne dane treningu." };
  }

  const db = getDb();
  const [row] = await db
    .select({
      id: workouts.id,
      date: workouts.date,
      workoutPlanId: workouts.workoutPlanId,
      exercisesJson: workouts.exercises,
      cardioMinutes: workouts.cardioMinutes,
    })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.id, parsed.data.workoutId)))
    .limit(1);

  if (!row) {
    return { ok: false as const, error: "Nie znaleziono treningu." };
  }

  const existing = safeParseCompletedSession(row.exercisesJson);
  if (!existing) {
    return { ok: false as const, error: "Ten wpis nie da się poprawić." };
  }

  const endedAt =
    typeof existing.endedAt === "number" && Number.isFinite(existing.endedAt)
      ? existing.endedAt
      : null;
  if (!canEditWorkout(endedAt, row.date)) {
    const deadline = workoutEditDeadlineMs(endedAt, row.date);
    return {
      ok: false as const,
      error: `Czas na poprawę minął (do ${new Date(deadline).toLocaleString("pl-PL")}).`,
    };
  }

  const startedAtMs =
    typeof existing.startedAt === "number" && Number.isFinite(existing.startedAt)
      ? existing.startedAt
      : Date.now() - 60 * 60 * 1000;
  const endedAtMs = endedAt ?? Date.now();
  const title =
    typeof existing.title === "string" && existing.title.trim()
      ? existing.title.trim()
      : "Trening";

  const normalized = safeNormalizeExercises(parsed.data.exercises).map((ex, idx) => ({
    id: ex.id || `ex_${idx}`,
    name: ex.name || `Ćwiczenie ${idx + 1}`,
    note: ex.note ?? null,
    targetSets: ex.targetSets ?? null,
    targetReps: ex.targetReps ?? null,
    targetRir: ex.targetRir ?? null,
    tempo: ex.tempo ?? null,
    sets: (ex.sets ?? []).map((s) => {
      const reps = s.reps ?? null;
      const weight = typeof s.weight === "number" ? s.weight : 0;
      const skipped = Boolean(s.skipped);
      const done =
        skipped ||
        (Boolean(s.done !== false) &&
          reps != null &&
          reps > 0 &&
          Number.isFinite(weight) &&
          weight >= 0);
      return {
        reps,
        weight,
        done,
        skipped,
        rir: s.rir ?? null,
        rpe: s.rpe ?? null,
      };
    }),
  }));

  const nextJson = completedSessionJsonForCompare({
    title,
    startedAtMs,
    endedAtMs,
    workoutPlanId: row.workoutPlanId ?? null,
    exercises: normalized,
    cardioMinutes: row.cardioMinutes ?? 0,
  });

  // Zachowaj target* w JSON (completedSessionJsonForCompare nie filtruje pól ćwiczeń).
  await db
    .update(workouts)
    .set({ exercises: nextJson })
    .where(and(eq(workouts.userId, userId), eq(workouts.id, row.id)));

  revalidatePath("/workout-history");
  revalidatePath(`/workout-history/${row.id}`);
  revalidatePath(`/workout-history/${row.id}/edit`);
  revalidatePath("/");
  revalidatePath("/workout-plan");
  // Analiza / Postępy liczą tonnaż i maxy z JSON sesji — bez tego widać stare ciężary.
  revalidatePath("/progress");
  revalidatePath("/progress", "layout");
  revalidatePath("/progress-analysis");
  revalidatePath("/cardio");

  return { ok: true as const };
}

const deleteSchema = z.object({
  workoutId: z.string().min(1).max(128),
});

/** Usuwa zakończony trening z historii (właściciel konta). */
export async function deleteCompletedWorkout(input: { workoutId: string }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false as const, error: UserMessages.sessionExpired };
  }

  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Niepoprawne dane treningu." };
  }

  const db = getDb();
  const [row] = await db
    .select({
      id: workouts.id,
      exercisesJson: workouts.exercises,
    })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.id, parsed.data.workoutId)))
    .limit(1);

  if (!row) {
    return { ok: false as const, error: "Nie znaleziono treningu." };
  }

  const existing = safeParseCompletedSession(row.exercisesJson);
  if (!existing) {
    return {
      ok: false as const,
      error: "Ten wpis nie jest zakończonym treningiem siłowym.",
    };
  }

  await db
    .delete(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.id, row.id)));

  revalidatePath("/workout-history");
  revalidatePath(`/workout-history/${row.id}`);
  revalidatePath(`/workout-history/${row.id}/edit`);
  revalidatePath("/");
  revalidatePath("/workout-plan");
  revalidatePath("/progress");
  revalidatePath("/progress", "layout");
  revalidatePath("/progress-analysis");
  revalidatePath("/cardio");

  return { ok: true as const };
}
