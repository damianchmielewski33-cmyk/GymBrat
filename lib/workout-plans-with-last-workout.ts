import "server-only";

import { and, asc, eq, isNotNull, max } from "drizzle-orm";
import { cache } from "react";
import type { WorkoutPlanWithLastWorkoutDTO } from "@/actions/workout-plan";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { workoutPlans, workouts } from "@/db/schema";
import { withDbRetry } from "@/db/with-retry";
import { normalizeWorkoutPlan } from "@/lib/workout-plan-utils";
import { comparePlansByWorkoutRecencyAsc } from "@/lib/workout-plan-queue";

async function queryPlansWithLastWorkout(
  userId: string,
): Promise<WorkoutPlanWithLastWorkoutDTO[]> {
  await ensureCriticalSchema();
  const db = getDb();
  const [lastByPlan, rows] = await Promise.all([
    db
      .select({ planId: workouts.workoutPlanId, lastDate: max(workouts.date) })
      .from(workouts)
      .where(and(eq(workouts.userId, userId), isNotNull(workouts.workoutPlanId)))
      .groupBy(workouts.workoutPlanId),
    db
      .select({
        id: workoutPlans.id,
        planJson: workoutPlans.planJson,
        updatedAt: workoutPlans.updatedAt,
      })
      .from(workoutPlans)
      .where(eq(workoutPlans.userId, userId))
      .orderBy(
        asc(workoutPlans.sortOrder),
        asc(workoutPlans.createdAt),
        asc(workoutPlans.id),
      ),
  ]);

  const lastMap = new Map<string, string>();
  for (const row of lastByPlan) {
    if (row.planId && row.lastDate) lastMap.set(row.planId, row.lastDate);
  }

  const out: WorkoutPlanWithLastWorkoutDTO[] = [];
  for (const row of rows) {
    let plan: ReturnType<typeof normalizeWorkoutPlan> = null;
    try {
      plan = normalizeWorkoutPlan(JSON.parse(row.planJson) as unknown);
    } catch {
      // uszkodzony JSON planu — pomijamy bez logowania treści
    }
    if (!plan) continue;
    out.push({
      id: row.id,
      plan,
      updatedAt: row.updatedAt.toISOString(),
      lastWorkoutDate: lastMap.get(row.id) ?? null,
      // Numer po sort_order (lista /plany) — ciągły wśród poprawnych planów.
      dayNumber: out.length + 1,
    });
  }

  // Kolejka: nigdy/najdawniej robione na górze → ostatnio robione na dole.
  return out.sort(comparePlansByWorkoutRecencyAsc);
}

/**
 * Plany użytkownika z datą ostatniego treningu i stałym numerem dnia, w kolejności kolejki.
 * `React.cache` = memoizacja tylko w obrębie jednego żądania (Home + akcje dzielą wynik).
 * Wynik jest współdzielony w żądaniu — nie mutować (kopiuj przed sortowaniem).
 * Ponawianie Turso jest wewnątrz cache, bo odrzucona obietnica też zostaje zapamiętana.
 */
export const loadWorkoutPlansWithLastWorkout = cache(
  (userId: string): Promise<readonly WorkoutPlanWithLastWorkoutDTO[]> =>
    withDbRetry(() => queryPlansWithLastWorkout(userId), {
      attempts: 3,
      baseDelayMs: 250,
    }),
);
