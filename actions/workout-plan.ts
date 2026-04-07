"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { workoutPlans } from "@/db/schema";

export type WorkoutPlanPayload = {
  version: 1;
  week: Array<{
    dayKey: string;
    title: string;
    exercises: Array<{ id: string; name: string }>;
  }>;
};

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
    return JSON.parse(row.planJson) as WorkoutPlanPayload;
  } catch {
    return null;
  }
}

export async function saveWorkoutPlan(plan: WorkoutPlanPayload) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Unauthorized" };

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

