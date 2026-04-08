"use server";

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { workoutPlans } from "@/db/schema";
import type { WorkoutPlanPayload } from "@/lib/workout-plan-types";
import { normalizeWorkoutPlan } from "@/lib/workout-plan-utils";

export type { WorkoutPlanExercise, WorkoutPlanPayload } from "@/lib/workout-plan-types";

export type WorkoutPlanListItemDTO = {
  id: string;
  plan: WorkoutPlanPayload;
  updatedAt: string;
};

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
    .orderBy(desc(workoutPlans.updatedAt));

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

/**
 * Zapisuje plan: bez `planId` tworzy nowy wpis; z `planId` aktualizuje istniejący.
 */
export async function saveWorkoutPlan(plan: WorkoutPlanPayload, planId?: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Unauthorized" };

  if (plan.version !== 2 || plan.path !== "custom") {
    return { ok: false as const, error: "Nieprawidłowy format planu" };
  }

  const db = getDb();
  const json = JSON.stringify(plan);
  const now = new Date();

  if (planId) {
    const [existing] = await db
      .select({ id: workoutPlans.id })
      .from(workoutPlans)
      .where(
        and(eq(workoutPlans.id, planId), eq(workoutPlans.userId, session.user.id)),
      )
      .limit(1);
    if (!existing) {
      return { ok: false as const, error: "Plan nie został znaleziony." };
    }
    await db
      .update(workoutPlans)
      .set({ planJson: json, updatedAt: now })
      .where(eq(workoutPlans.id, planId));
  } else {
    await db.insert(workoutPlans).values({
      id: randomUUID(),
      userId: session.user.id,
      planJson: json,
      createdAt: now,
      updatedAt: now,
    });
  }

  revalidatePath("/workout-plan");
  return { ok: true as const };
}

export async function deleteWorkoutPlan(planId: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Unauthorized" };

  const db = getDb();
  await db
    .delete(workoutPlans)
    .where(
      and(eq(workoutPlans.id, planId), eq(workoutPlans.userId, session.user.id)),
    );

  revalidatePath("/workout-plan");
  return { ok: true as const };
}
