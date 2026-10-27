"use server";

import { guardAction } from "@/lib/action-guard";
import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { activeWorkoutSessions, workoutPlans, workouts } from "@/db/schema";
import type { WorkoutPlanPayload } from "@/lib/workout-plan-types";
import { getLastWorkoutHintsForPlan } from "@/lib/last-workout-hints";
import { loadWorkoutPlansWithLastWorkout } from "@/lib/workout-plans-with-last-workout";
import {
  applyRenamesToCustomNames,
  collectExerciseRenames,
  planExerciseNameById,
  rewriteSessionExercisesJson,
  type ExerciseRename,
} from "@/lib/workout-exercise-rename";
import { normalizeWorkoutPlan } from "@/lib/workout-plan-utils";
import {
  MAX_PLANS_PER_USER,
  validateWorkoutPlanPayload,
} from "@/lib/workout-plan/plan-validation";
import { UserMessages } from "@/lib/user-facing-errors";

function revalidatePlanPaths(planId?: string) {
  revalidatePath("/plany");
  revalidatePath("/workout-plan");
  if (planId) revalidatePath(`/plany/${planId}`);
  revalidatePath("/active-workout");
  revalidatePath("/progress");
  revalidatePath("/workout-history");
  revalidatePath("/profile");
}

export type { WorkoutPlanExercise, WorkoutPlanPayload } from "@/lib/workout-plan-types";

export type WorkoutPlanListItemDTO = {
  id: string;
  plan: WorkoutPlanPayload;
  updatedAt: string;
};

/** Plan na ekranie treningu: data ostatniego zapisu treningu z tego planu (YYYY-MM-DD lub null). */
export type WorkoutPlanWithLastWorkoutDTO = WorkoutPlanListItemDTO & {
  lastWorkoutDate: string | null;
  /** 1..N wg created_at ASC, id ASC; stały, niezależny od kolejki. */
  dayNumber: number;
};

/** Plany w kolejności kolejki (nigdy/najdawniej robione na górze). */
export async function getWorkoutPlansWithLastWorkout(): Promise<WorkoutPlanWithLastWorkoutDTO[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  // Kopia — wynik loadera jest współdzielony w żądaniu (React.cache).
  return [...(await loadWorkoutPlansWithLastWorkout(session.user.id))];
}

export async function getWorkoutPlans(): Promise<WorkoutPlanListItemDTO[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const db = getDb();
  const rows = await db
    .select({
      id: workoutPlans.id,
      planJson: workoutPlans.planJson,
      updatedAt: workoutPlans.updatedAt,
    })
    .from(workoutPlans)
    .where(eq(workoutPlans.userId, session.user.id))
    .orderBy(asc(workoutPlans.createdAt), asc(workoutPlans.id));

  const out: WorkoutPlanListItemDTO[] = [];
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.planJson) as unknown;
      const plan = normalizeWorkoutPlan(parsed);
      if (plan) {
        out.push({
          id: row.id,
          plan,
          updatedAt: row.updatedAt.toISOString(),
        });
      }
    } catch {
      // pomijamy uszkodzone wpisy
    }
  }
  return out;
}

async function migrateExerciseRenamesInHistory(
  userId: string,
  renames: ExerciseRename[],
  nameById: Map<string, string>,
) {
  if (!renames.length && nameById.size === 0) return;

  const db = getDb();
  const workoutRows = await db
    .select({ id: workouts.id, exercises: workouts.exercises })
    .from(workouts)
    .where(eq(workouts.userId, userId));

  for (const row of workoutRows) {
    const nextJson = rewriteSessionExercisesJson(
      row.exercises,
      renames,
      nameById,
    );
    if (!nextJson) continue;
    await db
      .update(workouts)
      .set({ exercises: nextJson })
      .where(and(eq(workouts.id, row.id), eq(workouts.userId, userId)));
  }

  const [active] = await db
    .select({
      payloadJson: activeWorkoutSessions.payloadJson,
      revision: activeWorkoutSessions.revision,
    })
    .from(activeWorkoutSessions)
    .where(eq(activeWorkoutSessions.userId, userId))
    .limit(1);

  if (active) {
    const nextPayload = rewriteSessionExercisesJson(
      active.payloadJson,
      renames,
      nameById,
    );
    if (nextPayload) {
      await db
        .update(activeWorkoutSessions)
        .set({
          payloadJson: nextPayload,
          revision: active.revision + 1,
          updatedAt: new Date(),
        })
        .where(eq(activeWorkoutSessions.userId, userId));
    }
  }
}

/**
 * Zapisuje plan: bez `planId` tworzy nowy wpis; z `planId` aktualizuje istniejący.
 * Przy zmianie nazwy ćwiczenia (to samo id) przepisuje historię sesji, żeby nie zgubić progresu.
 */
export async function saveWorkoutPlan(plan: WorkoutPlanPayload, planId?: string) {
  await guardAction("workout-plan.saveWorkoutPlan");
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: UserMessages.sessionExpired };
  }

  const validated = validateWorkoutPlanPayload(plan);
  if (!validated.ok) {
    return { ok: false as const, error: validated.error };
  }
  plan = validated.plan;

  const db = getDb();
  const userId = session.user.id;
  const now = new Date();

  if (planId) {
    const [existing] = await db
      .select({ id: workoutPlans.id, planJson: workoutPlans.planJson })
      .from(workoutPlans)
      .where(and(eq(workoutPlans.id, planId), eq(workoutPlans.userId, userId)))
      .limit(1);
    if (!existing) {
      return { ok: false as const, error: "Plan nie został znaleziony." };
    }

    let planToSave = plan;
    let renames: ExerciseRename[] = [];
    try {
      const previous = normalizeWorkoutPlan(
        JSON.parse(existing.planJson) as unknown,
      );
      if (previous) {
        renames = collectExerciseRenames(previous, plan);
        if (renames.length) {
          planToSave = {
            ...plan,
            userCustomExerciseNames: applyRenamesToCustomNames(
              plan.userCustomExerciseNames,
              renames,
            ),
          };
        }
      }
    } catch {
      // uszkodzony poprzedni JSON — zapisujemy nowy plan bez migracji nazw
    }

    await db
      .update(workoutPlans)
      .set({ planJson: JSON.stringify(planToSave), updatedAt: now })
      .where(eq(workoutPlans.id, planId));

    // Sync po id leczy też wcześniejsze rename bez migracji; renames pokrywają sesje tylko po nazwie.
    await migrateExerciseRenamesInHistory(
      userId,
      renames,
      planExerciseNameById(planToSave),
    );

    revalidatePlanPaths(planId);
    return { ok: true as const, id: planId };
  }

  const existingCount = await db
    .select({ id: workoutPlans.id })
    .from(workoutPlans)
    .where(eq(workoutPlans.userId, userId));
  if (existingCount.length >= MAX_PLANS_PER_USER) {
    return {
      ok: false as const,
      error: `Możesz mieć maksymalnie ${MAX_PLANS_PER_USER} planów.`,
    };
  }

  const id = randomUUID();
  await db.insert(workoutPlans).values({
    id,
    userId,
    planJson: JSON.stringify(plan),
    createdAt: now,
    updatedAt: now,
  });

  revalidatePlanPaths(id);
  return { ok: true as const, id };
}

/** Podpowiedzi z ostatniego treningu dla danego planu (ciężar / RPE). */
export async function fetchLastWorkoutHintsForPlan(planId: string) {
  const session = await auth();
  if (!session?.user?.id) return {} as Awaited<ReturnType<typeof getLastWorkoutHintsForPlan>>;
  return getLastWorkoutHintsForPlan(session.user.id, planId);
}

export async function deleteWorkoutPlan(planId: string) {
  await guardAction("workout-plan.deleteWorkoutPlan");
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: UserMessages.sessionExpired };
  }

  const db = getDb();
  await db
    .delete(workoutPlans)
    .where(
      and(eq(workoutPlans.id, planId), eq(workoutPlans.userId, session.user.id)),
    );

  revalidatePlanPaths(planId);
  return { ok: true as const };
}
