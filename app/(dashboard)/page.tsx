import { auth } from "@/auth";
import { getWorkoutPlansWithLastWorkout } from "@/actions/workout-plan";
import { LoginScreen } from "@/components/auth/login-screen";
import { HomeTodayView } from "@/components/home/home-today-view";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { parseFirstDietSupplements } from "@/lib/diet-supplements";
import { getHomeStartDashboard } from "@/lib/home-start";
import { addCalendarDays } from "@/lib/local-date";
import { getTreningiHubStats } from "@/lib/treningi-hub-stats";
import { comparePlansByWorkoutRecencyAsc } from "@/lib/workout-plan-queue";
import { eq } from "drizzle-orm";

function weightKgPerWeek(
  series: Array<{ date: string; kg: number }>,
): number | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1]!;
  const from = addCalendarDays(last.date, -41);
  const window = series.filter((p) => p.date >= from);
  const a = (window.length >= 2 ? window[0] : series[0])!;
  const b = last;
  const t0 = new Date(`${a.date}T12:00:00`).getTime();
  const t1 = new Date(`${b.date}T12:00:00`).getTime();
  const days = Math.max(1, Math.round((t1 - t0) / 86_400_000));
  if (days < 3) return null;
  return Math.round((((b.kg - a.kg) / days) * 7) * 10) / 10;
}

export default async function HomePage() {
  const session = await auth().catch((err) => {
    console.error("[home] auth()", err);
    return null;
  });
  const userId = session?.user?.id;
  if (!userId) {
    return <LoginScreen />;
  }

  const db = getDb();
  const [[settingsRow], dash, plans, hub] = await Promise.all([
    db
      .select({
        onboardingCompletedAt: userSettings.onboardingCompletedAt,
        fitnessGoalsJson: userSettings.fitnessGoalsJson,
        mealTemplatesJson: userSettings.mealTemplatesJson,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1),
    getHomeStartDashboard(userId),
    getWorkoutPlansWithLastWorkout(),
    getTreningiHubStats(userId),
  ]);

  const dayOptions = plans.map((row) => ({
    id: row.id,
    name: row.plan.planName,
    exerciseCount: row.plan.exercises.length,
    lastWorkoutDate: row.lastWorkoutDate,
    row,
  }));

  // Lista dni = kolejność planu (createdAt); rekomendacja = kolejka „najdawniej robiony”.
  const recommendedId =
    dash.nextWorkout?.planId ??
    [...dayOptions].sort(comparePlansByWorkoutRecencyAsc)[0]?.id ??
    null;

  const supplements = parseFirstDietSupplements(
    settingsRow?.fitnessGoalsJson,
    settingsRow?.mealTemplatesJson,
  );

  return (
    <HomeTodayView
      firstName={dash.firstName}
      lastName={dash.lastName}
      reportCount={dash.reportCount}
      daysSinceLastReport={dash.daysSinceLastReport}
      reportCadenceDays={dash.reportCadenceDays}
      showOnboarding={!settingsRow?.onboardingCompletedAt}
      recommendedPlanId={recommendedId}
      planName={dash.nextWorkout?.planName ?? null}
      exerciseCount={dash.nextWorkout?.exerciseCount ?? 0}
      days={dayOptions}
      supplements={supplements}
      weightKg={dash.currentWeightKg}
      weightDeltaFromPreviousKg={dash.weightDeltaFromPreviousKg}
      weightFromStartKg={dash.weightFromStartKg}
      weightKgPerWeek={weightKgPerWeek(dash.weightSeries)}
      tempoKgPerMin={dash.tempoKgPerMin}
      todayMacros={dash.todayMacros}
      weekMacros={dash.weekMacros}
      weightSeries={dash.weightSeries}
      waistSeries={dash.waistSeries}
      compliance={dash.compliance}
      formToday={dash.formToday}
      coachNote={dash.coachNote}
      transformation={dash.transformation}
      dimensions={{
        waistCm: dash.dimensions.waistCm,
        thighCm: dash.dimensions.thighCm,
        chestCm: dash.dimensions.chestCm,
        armCm: dash.dimensions.armCm,
        waistSpark: dash.dimensions.waistSpark,
        thighSpark: dash.dimensions.thighSpark,
        chestSpark: dash.dimensions.chestSpark,
        armSpark: dash.dimensions.armSpark,
      }}
      recentWorkouts={hub.recentWorkouts}
      workoutsThisWeek={dash.workoutsThisWeek}
      cardioThisWeekMinutes={dash.cardioThisWeekMinutes}
      workoutStreakWeeks={dash.workoutStreakWeeks}
      cardioGoalMinutes={dash.cardioWeeklyGoal}
    />
  );
}
