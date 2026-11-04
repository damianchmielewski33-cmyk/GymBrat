"use server";

import { desc, eq, gte, and } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { workoutPlans, workouts } from "@/db/schema";
import { saveWorkoutPlan } from "@/actions/workout-plan";
import { guardAction } from "@/lib/action-guard";
import { calendarDateKey, addCalendarDays } from "@/lib/local-date";
import {
  buildPlanDaysFromWorkouts,
  PLAN_FROM_HISTORY_DAYS,
} from "@/lib/plan-from-history";
import { UserMessages } from "@/lib/user-facing-errors";

/**
 * Z58: tworzy plan startowy z treningów z ostatnich 30 dni (po jednym dniu na nazwę treningu).
 * Tylko dla konta bez planów — nic nie nadpisuje ani nie duplikuje.
 */
export async function createPlanFromHistory() {
  await guardAction("plan-from-history.create", { limit: 5, windowMs: 60_000 });
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: UserMessages.sessionExpired };
  }
  const userId = session.user.id;

  await ensureCriticalSchema();
  const db = getDb();

  const [existing] = await db
    .select({ id: workoutPlans.id })
    .from(workoutPlans)
    .where(eq(workoutPlans.userId, userId))
    .limit(1);
  if (existing) {
    return { ok: false as const, error: "Masz już zapisane plany treningowe." };
  }

  const since = addCalendarDays(calendarDateKey(), -PLAN_FROM_HISTORY_DAYS);
  const rows = await db
    .select({ date: workouts.date, exercises: workouts.exercises })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), gte(workouts.date, since)))
    .orderBy(desc(workouts.date), desc(workouts.id))
    .limit(200);

  const plans = buildPlanDaysFromWorkouts(rows);
  if (plans.length === 0) {
    return {
      ok: false as const,
      error: "Nie znaleźliśmy ukończonych treningów siłowych z ostatnich 30 dni.",
    };
  }

  let created = 0;
  for (const plan of plans) {
    const res = await saveWorkoutPlan(plan);
    if (!res.ok) {
      return created > 0
        ? { ok: true as const, created }
        : { ok: false as const, error: res.error };
    }
    created += 1;
  }
  return { ok: true as const, created };
}
