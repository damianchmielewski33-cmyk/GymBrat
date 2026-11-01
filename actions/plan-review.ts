"use server";

import { guardAction } from "@/lib/action-guard";
import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { planRevisions, workoutPlans } from "@/db/schema";
import { saveWorkoutPlan } from "@/actions/workout-plan";
import {
  applyPlanChanges,
  replaceExerciseInPlan,
} from "@/lib/plan-review";
import { normalizeWorkoutPlan } from "@/lib/workout-plan-utils";
import { CATALOG_EXERCISES } from "@/lib/workout-exercise-catalog";
import type { WorkoutPlanPayload } from "@/lib/workout-plan-types";

const changeSchema = z.object({
  exerciseId: z.string().min(1).max(64),
  sets: z.number().int().min(1).max(10).optional(),
  reps: z.number().int().min(1).max(30).optional(),
});

const inputSchema = z.object({
  planId: z.string().min(1).max(64),
  kind: z.enum(["review", "deload"]).default("review"),
  summary: z.string().max(200).optional(),
  changes: z.array(changeSchema).max(30).optional(),
  /** Wymiana ćwiczenia na pozycję z katalogu (id katalogu, nie dowolna nazwa). */
  replace: z
    .object({
      exerciseId: z.string().min(1).max(64),
      catalogId: z.string().min(1).max(64),
    })
    .optional(),
});

async function loadOwnedPlan(userId: string, planId: string) {
  const db = getDb();
  const [row] = await db
    .select({ planJson: workoutPlans.planJson })
    .from(workoutPlans)
    .where(and(eq(workoutPlans.id, planId), eq(workoutPlans.userId, userId)))
    .limit(1);
  if (!row) return null;
  try {
    return normalizeWorkoutPlan(JSON.parse(row.planJson) as unknown);
  } catch {
    return null;
  }
}

/**
 * Stosuje zatwierdzone przez użytkownika zmiany planu. Poprzednia wersja
 * trafia do `plan_revisions` — trwałe „Cofnij” i granica mezocyklu.
 */
export async function applyPlanReviewAction(input: unknown) {
  await guardAction("plan-review.applyPlanReviewAction");
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false as const, error: "Brak sesji." };
  const parsed = inputSchema.safeParse(input);
  if (
    !parsed.success ||
    (!parsed.data.changes?.length && !parsed.data.replace)
  ) {
    return { ok: false as const, error: "Nieprawidłowe zmiany." };
  }
  const { planId, kind, summary, changes, replace } = parsed.data;

  await ensureCriticalSchema();
  const previous = await loadOwnedPlan(userId, planId);
  if (!previous) return { ok: false as const, error: "Plan nie został znaleziony." };

  let exercises = previous.exercises;
  if (changes?.length) exercises = applyPlanChanges(exercises, changes);
  if (replace) {
    const alt = CATALOG_EXERCISES.find((c) => c.id === replace.catalogId);
    if (!alt || !exercises.some((e) => e.id === replace.exerciseId)) {
      return { ok: false as const, error: "Nie można wymienić ćwiczenia." };
    }
    exercises = replaceExerciseInPlan(
      exercises,
      replace.exerciseId,
      { id: alt.id, name: alt.name, categoryId: alt.categoryId },
      randomUUID(),
    ).map((e) =>
      e.name === alt.name ? { ...e, techniqueYoutubeUrl: null } : e,
    );
  }

  const saved = await saveWorkoutPlan({ ...previous, exercises }, planId);
  if (!saved.ok) return { ok: false as const, error: saved.error };

  const revisionId = randomUUID();
  await getDb().insert(planRevisions).values({
    id: revisionId,
    userId,
    planId,
    previousPlanJson: JSON.stringify(previous),
    kind,
    summary: summary ?? null,
  });
  return { ok: true as const, revisionId };
}

/** Cofa wskazaną rewizję (przywraca plan sprzed zmiany). */
export async function revertPlanRevisionAction(revisionId: string) {
  await guardAction("plan-review.revertPlanRevisionAction");
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false as const, error: "Brak sesji." };
  if (typeof revisionId !== "string" || revisionId.length > 64) {
    return { ok: false as const, error: "Nieprawidłowa rewizja." };
  }

  await ensureCriticalSchema();
  const db = getDb();
  const [rev] = await db
    .select()
    .from(planRevisions)
    .where(
      and(
        eq(planRevisions.id, revisionId),
        eq(planRevisions.userId, userId),
        isNull(planRevisions.revertedAt),
      ),
    )
    .limit(1);
  if (!rev) return { ok: false as const, error: "Rewizji nie znaleziono." };

  let previous: WorkoutPlanPayload | null = null;
  try {
    previous = normalizeWorkoutPlan(JSON.parse(rev.previousPlanJson) as unknown);
  } catch {
    previous = null;
  }
  if (!previous) return { ok: false as const, error: "Nie można odczytać planu." };

  const saved = await saveWorkoutPlan(previous, rev.planId);
  if (!saved.ok) return { ok: false as const, error: saved.error };
  await db
    .update(planRevisions)
    .set({ revertedAt: new Date() })
    .where(eq(planRevisions.id, rev.id));
  return { ok: true as const };
}
