"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { workoutPlans } from "@/db/schema";
import type { WorkoutPlanPayload } from "@/lib/workout-plan-types";
import { normalizeWorkoutPlan } from "@/lib/workout-plan-utils";

export type { WorkoutPlanExercise, WorkoutPlanPayload } from "@/lib/workout-plan-types";

export async function getWorkoutPlan(): Promise<WorkoutPlanPayload | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const db = getDb();
  const [row] = await db
    .select({ planJson: workoutPlans.planJson })
    .from(workoutPlans)
    .where(eq(workoutPlans.userId, session.user.id))
    .limit(1);

  if (!row?.planJson) return null;
  try {
    const parsed = JSON.parse(row.planJson) as unknown;
    return normalizeWorkoutPlan(parsed);
  } catch {
    return null;
  }
}

export async function saveWorkoutPlan(plan: WorkoutPlanPayload) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Unauthorized" };

  if (plan.version !== 2 || plan.path !== "custom") {
    return { ok: false as const, error: "Nieprawidłowy format planu" };
  }

  const db = getDb();
  await db
    .insert(workoutPlans)
    .values({
      userId: session.user.id,
      planJson: JSON.stringify(plan),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: workoutPlans.userId,
      set: { planJson: JSON.stringify(plan), updatedAt: new Date() },
    });

  revalidatePath("/workout-plan");
  return { ok: true as const };
}
