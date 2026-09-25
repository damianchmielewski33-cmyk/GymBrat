import { auth } from "@/auth";
import { DimensionTiles } from "@/components/home/dimension-tiles";
import { NextWorkoutTile } from "@/components/home/next-workout-tile";
import { OnboardingBanner } from "@/components/home/onboarding-banner";
import { StartMetricTiles } from "@/components/home/start-metric-tiles";
import { TransformationSlider } from "@/components/home/transformation-slider";
import { WeightRangeChartDynamic } from "@/components/home/weight-range-chart-dynamic";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { getHomeStartDashboard } from "@/lib/home-start";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth().catch((err) => {
    console.error("[home] auth()", err);
    return null;
  });
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/login?callbackUrl=/");
  }

  const db = getDb();
  const [[settingsRow], dash] = await Promise.all([
    db
      .select({ onboardingCompletedAt: userSettings.onboardingCompletedAt })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1),
    getHomeStartDashboard(userId),
  ]);

  const greeting = dash.firstName?.trim()
    ? `Cześć ${dash.firstName.trim()} 💪`
    : "Cześć 💪";

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="glass-panel gold-panel relative overflow-hidden px-5 py-6 sm:px-8 sm:py-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 -top-20 h-44 w-44 rounded-full bg-[var(--neon)]/12 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -right-12 h-40 w-40 rounded-full bg-[var(--neon)]/8 blur-3xl"
        />
        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">
            Start
          </p>
          <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {greeting}
          </h1>
          <div
            aria-hidden
            className="mt-5 h-px w-20 bg-gradient-to-r from-[var(--neon)] to-transparent"
          />
        </div>
      </header>

      {!settingsRow?.onboardingCompletedAt ? <OnboardingBanner /> : null}

      <NextWorkoutTile
        planName={dash.nextWorkout?.planName ?? null}
        exerciseCount={dash.nextWorkout?.exerciseCount ?? 0}
        lastWorkoutDate={dash.nextWorkout?.lastWorkoutDate ?? null}
        workoutsThisWeek={dash.workoutsThisWeek}
        cardioThisWeekMinutes={dash.cardioThisWeekMinutes}
        workoutStreakDays={dash.workoutStreakDays}
      />

      <StartMetricTiles
        weightKg={dash.currentWeightKg}
        tempoKgPerMin={dash.tempoKgPerMin}
        weightFromStartKg={dash.weightFromStartKg}
      />

      <WeightRangeChartDynamic data={dash.weightSeries} />

      <TransformationSlider
        firstPhotoUrl={dash.transformation.firstPhotoUrl}
        latestPhotoUrl={dash.transformation.latestPhotoUrl}
      />

      <DimensionTiles
        weightKg={dash.dimensions.weightKg}
        waistCm={dash.dimensions.waistCm}
        armCm={dash.dimensions.armCm}
        abdomenCm={dash.dimensions.abdomenCm}
      />
    </div>
  );
}
