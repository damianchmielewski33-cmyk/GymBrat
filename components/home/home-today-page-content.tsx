import { TriangleAlert } from "lucide-react";
import { HomeRetryButton } from "@/components/home/home-retry-button";
import { getWorkoutPlansWithLastWorkout } from "@/actions/workout-plan";
import { HomeTodayView } from "@/components/home/home-today-view";
import { getDb } from "@/db";
import { supplementIntakes, userSettings, users, workouts } from "@/db/schema";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { calendarDateKey } from "@/lib/local-date";
import { and } from "drizzle-orm";
import { intakeKey, parseFirstDietSupplements } from "@/lib/diet-supplements";
import { getHomeStartDashboard } from "@/lib/home-start";
import { shouldShowIntroTour } from "@/lib/intro-tour-steps";
import { addCalendarDays } from "@/lib/local-date";
import { count, eq } from "drizzle-orm";
import { shouldShowOnboarding } from "@/lib/plan-from-history";

function weightKgPerWeek(
  series: Array<{ date: string; kg: number }>,
): number | null {
  // Tempo wymaga min. 3 pomiarów (tak mówi podpis kafelka w Sylwetce).
  if (series.length < 3) return null;
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

export async function HomeTodayPageContent({ userId }: { userId: string }) {
  let settingsRow: {
    onboardingCompletedAt: Date | null;
    introTourCompletedAt: Date | null;
    fitnessGoalsJson: string | null;
    mealTemplatesJson: string | null;
  } | undefined;
  let accountCreatedAt: Date | null = null;
  let dash: Awaited<ReturnType<typeof getHomeStartDashboard>>;
  let plans: Awaited<ReturnType<typeof getWorkoutPlansWithLastWorkout>>;
  let workoutCount = 0;

  try {
    const db = getDb();
    let userCreated: { createdAt: Date } | undefined;
    let countRow: { n: number } | undefined;
    [[settingsRow], [userCreated], dash, plans, [countRow]] = await Promise.all([
      db
        .select({
          onboardingCompletedAt: userSettings.onboardingCompletedAt,
          introTourCompletedAt: userSettings.introTourCompletedAt,
          fitnessGoalsJson: userSettings.fitnessGoalsJson,
          mealTemplatesJson: userSettings.mealTemplatesJson,
        })
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1),
      db
        .select({ createdAt: users.createdAt })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),
      getHomeStartDashboard(userId),
      getWorkoutPlansWithLastWorkout(),
      db
        .select({ n: count() })
        .from(workouts)
        .where(eq(workouts.userId, userId)),
    ]);
    workoutCount = Number(countRow?.n ?? 0);
    accountCreatedAt = userCreated?.createdAt ?? null;
  } catch (e) {
    console.error(
      "[home-today]",
      e instanceof Error ? e.message : e,
    );
    return (
      <div
        role="alert"
        className="flex gap-3 rounded-[14px] border border-[#5a3a22] bg-[#1f1510] p-4 text-white"
      >
        <TriangleAlert
          className="mt-0.5 h-[22px] w-[22px] shrink-0 text-orange-400"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Nie udało się wczytać pulpitu</p>
          <p className="mt-0.5 text-sm leading-relaxed text-white/60">
            Chwilowy problem z bazą lub hostingiem. Twoje treningi i raporty
            są bezpieczne. Spróbuj ponownie za chwilę.
          </p>
          <HomeRetryButton />
        </div>
      </div>
    );
  }

  const dayOptions = plans.map((row) => ({
    id: row.id,
    name: row.plan.planName,
    exerciseCount: row.plan.exercises.length,
    lastWorkoutDate: row.lastWorkoutDate,
    row,
  }));

  const recommendedId =
    dash.nextWorkout?.planId ?? dayOptions[0]?.id ?? null;

  let takenSupplements: string[] = [];
  try {
    await ensureCriticalSchema();
    const rows = await getDb()
      .select({ name: supplementIntakes.name, slot: supplementIntakes.slot })
      .from(supplementIntakes)
      .where(
        and(
          eq(supplementIntakes.userId, userId),
          eq(supplementIntakes.dateKey, calendarDateKey()),
        ),
      );
    takenSupplements = rows.map((r) => intakeKey(r.name, r.slot));
  } catch (e) {
    console.error("[home-today] supplements", e instanceof Error ? e.message : e);
  }

  const supplements = parseFirstDietSupplements(
    settingsRow?.fitnessGoalsJson,
    settingsRow?.mealTemplatesJson,
  );

  return (
    <HomeTodayView
      reportCount={dash.reportCount}
      daysSinceLastReport={dash.daysSinceLastReport}
      showOnboarding={shouldShowOnboarding({
        onboardingCompleted: Boolean(settingsRow?.onboardingCompletedAt),
        workoutCount,
      })}
      canBuildPlanFromHistory={workoutCount > 0}
      showIntroTour={shouldShowIntroTour({
        introTourCompletedAt: settingsRow?.introTourCompletedAt,
        accountCreatedAt,
      })}
      recommendedPlanId={recommendedId}
      planName={dash.nextWorkout?.planName ?? null}
      exerciseCount={dash.nextWorkout?.exerciseCount ?? 0}
      days={dayOptions}
      supplements={supplements}
      takenSupplements={takenSupplements}
      weightKg={dash.currentWeightKg}
      weightDeltaFromPreviousKg={dash.weightDeltaFromPreviousKg}
      weightFromStartKg={dash.weightFromStartKg}
      weightKgPerWeek={weightKgPerWeek(dash.weightSeries)}
      todayMacros={dash.todayMacros}
      weekMacros={dash.weekMacros}
      weightSeries={dash.weightSeries}
      waistSeries={dash.waistSeries}
      armSeries={dash.dimensions.armSpark}
      chestSeries={dash.dimensions.chestSpark}
      compliance={dash.compliance}
      workoutsThisWeek={dash.workoutsThisWeek}
      cardioThisWeekMinutes={dash.cardioThisWeekMinutes}
      workoutStreakWeeks={dash.workoutStreakWeeks}
      cardioGoalMinutes={dash.cardioWeeklyGoal}
      cardioSheetWeek={dash.cardioSheetWeek}
      extraCardio={dash.extraCardio}
    />
  );
}
