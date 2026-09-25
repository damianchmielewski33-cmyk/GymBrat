import { auth } from "@/auth";
import { getWorkoutPlansWithLastWorkout } from "@/actions/workout-plan";
import { ActiveWorkoutView } from "@/components/active-workout/active-workout-view";
import { getUserAiEntitled, getUserAiFeaturesDisabled } from "@/lib/user-ai-preference";
import { getHomeStats } from "@/lib/home-stats";
import { calendarDateKey, addCalendarDays, calendarWeekdaySun0 } from "@/lib/local-date";
import { getDb } from "@/db";
import { workouts } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";

async function workoutDaysMonSun(userId: string): Promise<boolean[]> {
  const today = calendarDateKey();
  const dow = calendarWeekdaySun0(today); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = addCalendarDays(today, mondayOffset);
  const sunday = addCalendarDays(monday, 6);
  const db = getDb();
  const rows = await db
    .select({ date: workouts.date })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.date, monday),
        lte(workouts.date, sunday),
      ),
    );
  const set = new Set(rows.map((r) => r.date));
  return Array.from({ length: 7 }, (_, i) => set.has(addCalendarDays(monday, i)));
}

export default async function StartWorkoutPage() {
  const session = await auth();
  const uid = session?.user?.id;
  const [initialPlans, userAiFeaturesDisabled, userAiEntitled, homeStats, weekDays] =
    await Promise.all([
      getWorkoutPlansWithLastWorkout(),
      uid ? getUserAiFeaturesDisabled(uid) : Promise.resolve(false),
      uid ? getUserAiEntitled(uid) : Promise.resolve(true),
      uid ? getHomeStats(uid) : Promise.resolve(null),
      uid ? workoutDaysMonSun(uid) : Promise.resolve(Array(7).fill(false)),
    ]);
  return (
    <ActiveWorkoutView
      entry="start"
      initialPlans={initialPlans}
      userAiFeaturesDisabled={userAiFeaturesDisabled}
      userAiEntitled={userAiEntitled}
      homeStats={homeStats}
      workoutDaysThisWeek={weekDays}
    />
  );
}

