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
import { cn } from "@/lib/utils";
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

  const hasTransformation = Boolean(
    dash.transformation.firstPhotoUrl && dash.transformation.latestPhotoUrl,
  );

  return (
    <div className="space-y-3 sm:space-y-3.5">
      <header className="flex items-end justify-between gap-3 px-0.5 pt-0.5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">
            Start
          </p>
          <h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {greeting}
          </h1>
        </div>
        <p className="hidden max-w-[12rem] text-right text-[11px] leading-snug text-white/40 sm:block">
          Trening, waga i sylwetka w jednym widoku
        </p>
      </header>

      {!settingsRow?.onboardingCompletedAt ? <OnboardingBanner /> : null}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-5 xl:items-stretch">
        <div className="xl:col-span-3">
          <NextWorkoutTile
            planName={dash.nextWorkout?.planName ?? null}
            exerciseCount={dash.nextWorkout?.exerciseCount ?? 0}
            lastWorkoutDate={dash.nextWorkout?.lastWorkoutDate ?? null}
            workoutsThisWeek={dash.workoutsThisWeek}
            cardioThisWeekMinutes={dash.cardioThisWeekMinutes}
            workoutStreakDays={dash.workoutStreakDays}
          />
        </div>
        <div className="xl:col-span-2">
          <StartMetricTiles
            weightKg={dash.currentWeightKg}
            tempoKgPerMin={dash.tempoKgPerMin}
            weightFromStartKg={dash.weightFromStartKg}
            stacked
          />
        </div>
      </div>

      <div
        className={cn(
          "grid grid-cols-1 gap-3 lg:items-stretch",
          hasTransformation ? "lg:grid-cols-5" : "lg:grid-cols-1",
        )}
      >
        <div
          className={cn("min-h-0", hasTransformation ? "lg:col-span-3" : null)}
        >
          <WeightRangeChartDynamic data={dash.weightSeries} />
        </div>
        <div
          className={cn("min-h-0", hasTransformation ? "lg:col-span-2" : null)}
        >
          <TransformationSlider
            firstPhotoUrl={dash.transformation.firstPhotoUrl}
            latestPhotoUrl={dash.transformation.latestPhotoUrl}
            compactEmpty={!hasTransformation}
          />
        </div>
      </div>

      <DimensionTiles
        weightKg={dash.dimensions.weightKg}
        waistCm={dash.dimensions.waistCm}
        armCm={dash.dimensions.armCm}
        abdomenCm={dash.dimensions.abdomenCm}
      />
    </div>
  );
}
