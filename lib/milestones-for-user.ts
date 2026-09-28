import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { parseFitnessGoalsJson } from "@/lib/fitness-goals";
import { getExerciseProgressSeries } from "@/lib/exercise-progress";
import { buildMilestones, type Milestone } from "@/lib/milestones";
import { addCalendarDays, calendarDateKey } from "@/lib/local-date";
import { countDistinctWorkoutDaysInRange } from "@/lib/weekly-sessions";

export async function getMilestonesForUser(userId: string): Promise<Milestone[]> {
  const db = getDb();
  const [row] = await db
    .select({ fitnessGoalsJson: userSettings.fitnessGoalsJson })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  const goals = parseFitnessGoalsJson(row?.fitnessGoalsJson ?? null);
  const today = calendarDateKey(new Date());
  const start = addCalendarDays(today, -6);
  const weeklySessionsDone = await countDistinctWorkoutDaysInRange(userId, start, today);

  const exercisePrsByName: Record<
    string,
    Awaited<ReturnType<typeof getExerciseProgressSeries>>["prs"]
  > = {};

  for (const t of goals.exerciseTargets ?? []) {
    const series = await getExerciseProgressSeries({
      userId,
      exerciseQuery: t.name,
      days: 365,
    });
    exercisePrsByName[t.name] = series.prs;
  }

  // Jeśli brak celów ćwiczeń — weź top sugestię pod domyślne e1RM tiers
  if (!(goals.exerciseTargets?.length)) {
    const { listExerciseNameSuggestions } = await import("@/lib/exercise-progress");
    const names = await listExerciseNameSuggestions(userId, { days: 90 });
    const top = names[0];
    if (top) {
      const series = await getExerciseProgressSeries({
        userId,
        exerciseQuery: top,
        days: 365,
      });
      exercisePrsByName[top] = series.prs;
    }
  }

  return buildMilestones({ goals, weeklySessionsDone, exercisePrsByName });
}
