import { auth } from "@/auth";
import { ComplianceCard } from "@/components/home/compliance-card";
import { DimensionTiles } from "@/components/home/dimension-tiles";
import { FormTodayCard } from "@/components/home/form-today-card";
import { NextWorkoutTile } from "@/components/home/next-workout-tile";
import { OnboardingBanner } from "@/components/home/onboarding-banner";
import { StartMetricTiles } from "@/components/home/start-metric-tiles";
import { TransformationSlider } from "@/components/home/transformation-slider";
import { WeightRangeChartDynamic } from "@/components/home/weight-range-chart-dynamic";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { getHomeStartDashboard } from "@/lib/home-start";
import { Clock } from "lucide-react";
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

  const fullName = [dash.firstName, dash.lastName].filter(Boolean).join(" ");
  const greeting = fullName ? `Cześć, ${fullName} 💪` : "Cześć 💪";
  const daysLeft =
    dash.daysSinceLastReport == null
      ? null
      : Math.max(0, dash.reportCadenceDays - dash.daysSinceLastReport);

  return (
    <div className="space-y-3">
      <header className="px-0.5 pb-1 pt-2">
        <h1 className="text-[32px] font-semibold leading-[1.05] tracking-tight text-white">
          {greeting}
        </h1>
        <p className="mt-3 flex items-center gap-2 text-[13px] text-white/45">
          <Clock className="h-4 w-4 text-[var(--neon)]" aria-hidden />
          {daysLeft == null
            ? "Dodaj pierwszy raport, żeby pilnować rytmu."
            : `Raport za ${daysLeft} dni · co dwa tygodnie`}
        </p>
      </header>

      {!settingsRow?.onboardingCompletedAt ? <OnboardingBanner /> : null}

      <NextWorkoutTile
        planName={dash.nextWorkout?.planName ?? null}
        exerciseCount={dash.nextWorkout?.exerciseCount ?? 0}
        exerciseNames={dash.nextWorkout?.exerciseNames ?? []}
        firstTime={dash.nextWorkout?.firstTime ?? true}
        lastWorkoutDate={dash.nextWorkout?.lastWorkoutDate ?? null}
        workoutsThisWeek={dash.workoutsThisWeek}
        cardioThisWeekMinutes={dash.cardioThisWeekMinutes}
        workoutStreakDays={dash.workoutStreakDays}
      />

      <StartMetricTiles
        weightKg={dash.currentWeightKg}
        tempoKgPerMin={dash.tempoKgPerMin}
        weightFromStartKg={dash.weightFromStartKg}
        daysInProgram={dash.daysInProgram}
        reportCount={dash.reportCount}
      />

      <WeightRangeChartDynamic data={dash.weightSeries} waist={dash.waistSeries} />

      <FormTodayCard
        energy={dash.formToday.energy}
        sleep={dash.formToday.sleep}
        digestion={dash.formToday.digestion}
        training={dash.formToday.training}
      />

      <ComplianceCard
        dietPct={dash.compliance.dietPct}
        trainingPct={dash.compliance.trainingPct}
        cardioPct={dash.compliance.cardioPct}
        lastN={dash.compliance.lastN}
        doneN={dash.compliance.doneN}
      />

      <TransformationSlider
        firstPhotoUrl={dash.transformation.firstPhotoUrl}
        latestPhotoUrl={dash.transformation.latestPhotoUrl}
        latestPhotoDate={dash.transformation.latestPhotoDate}
      />

      <DimensionTiles
        weightKg={dash.dimensions.weightKg}
        waistCm={dash.dimensions.waistCm}
        armCm={dash.dimensions.armCm}
        abdomenCm={dash.dimensions.abdomenCm}
        chestCm={dash.dimensions.chestCm}
        thighCm={dash.dimensions.thighCm}
        waistSpark={dash.dimensions.waistSpark}
        thighSpark={dash.dimensions.thighSpark}
        chestSpark={dash.dimensions.chestSpark}
        armSpark={dash.dimensions.armSpark}
      />
    </div>
  );
}
