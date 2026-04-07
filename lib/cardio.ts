import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { trainingSessions, userSettings, workouts } from "@/db/schema";
import { localDateKey } from "@/lib/local-date";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Rolling 7-day cardio: sums `workouts` (by local `date`) plus legacy
 * `training_sessions` rows in the same window so older data still counts.
 */
export async function getWeeklyCardioProgress(userId: string) {
  const db = getDb();
  const now = new Date();
  const weekAgo = new Date(Date.now() - WEEK_MS);

  const [goalRow] = await db
    .select({ goal: userSettings.weeklyCardioGoalMinutes })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  const weeklyGoal = goalRow?.goal ?? 150;

  const todayKey = localDateKey(now);
  const minWorkoutDateKey = localDateKey(weekAgo);

  const [fromWorkouts] = await db
    .select({
      total: sql<number>`coalesce(sum(${workouts.cardioMinutes}), 0)`,
    })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.date, minWorkoutDateKey),
        lte(workouts.date, todayKey),
      ),
    );

  const [fromLegacySessions] = await db
    .select({
      total: sql<number>`coalesce(sum(${trainingSessions.cardioMinutes}), 0)`,
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, userId),
        gte(trainingSessions.startedAt, weekAgo),
      ),
    );

  const minutesCompleted =
    Number(fromWorkouts?.total ?? 0) + Number(fromLegacySessions?.total ?? 0);

  const pct =
    weeklyGoal > 0
      ? Math.min(100, Math.round((minutesCompleted / weeklyGoal) * 1000) / 10)
      : 0;

  return {
    weeklyGoal,
    minutesCompleted,
    percent: pct,
  };
}
