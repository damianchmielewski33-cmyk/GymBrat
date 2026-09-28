import { auth } from "@/auth";
import { DimensionTiles } from "@/components/home/dimension-tiles";
import { HomeWorkoutBoard } from "@/components/home/home-workout-board";
import { OnboardingBanner } from "@/components/home/onboarding-banner";
import { TransformationSlider } from "@/components/home/transformation-slider";
import { WeightRangeChartDynamic } from "@/components/home/weight-range-chart-dynamic";
import { getWorkoutPlansWithLastWorkout } from "@/actions/workout-plan";
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
  const [[settingsRow], dash, plans] = await Promise.all([
    db
      .select({ onboardingCompletedAt: userSettings.onboardingCompletedAt })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1),
    getHomeStartDashboard(userId),
    getWorkoutPlansWithLastWorkout(),
  ]);

  return (
    <div className="space-y-6 sm:space-y-8">
      {!settingsRow?.onboardingCompletedAt ? <OnboardingBanner /> : null}

      <HomeWorkoutBoard
        plans={plans}
        workoutsThisWeek={dash.workoutsThisWeek}
        cardioThisWeekMinutes={dash.cardioThisWeekMinutes}
        workoutStreakDays={dash.workoutStreakDays}
        weightKg={dash.currentWeightKg}
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
