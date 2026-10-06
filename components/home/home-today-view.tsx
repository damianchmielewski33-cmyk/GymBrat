"use client";

import type { ReactNode } from "react";
import { HomeTrainingCard, type HomeTrainingDayOption } from "@/components/home/home-training-card";
import { HomeSupplementsChip } from "@/components/home/home-supplements-chip";
import { StartMetricTiles } from "@/components/home/start-metric-tiles";
import { HomeSylwetkaSection } from "@/components/home/home-sylwetka-section";
import { HomeZalozeniaSection } from "@/components/home/home-zalozenia-section";
import { HomeOdDamiana } from "@/components/home/home-od-damiana";
import { HomeObwodySection } from "@/components/home/home-obwody-section";
import { HomeRecentWorkouts } from "@/components/home/home-recent-workouts";
import { OnboardingBanner } from "@/components/home/onboarding-banner";
import type {
  HomeStartDashboard,
  HomeStartSpark,
  HomeStartTodayMacros,
  HomeStartWaistPoint,
  HomeStartWeekMacros,
  HomeStartWeightPoint,
} from "@/lib/home-start";
import type { ExtraCardioAdvice } from "@/lib/extra-cardio-from-macros";
import type { DietSupplement } from "@/lib/diet-supplements";
import type { RecentWorkoutItem } from "@/lib/treningi-hub-stats";
import { addCalendarDays, calendarDateKey } from "@/lib/local-date";

function formatReportShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
  });
}

export type HomeTodayViewProps = {
  reportCount: number;
  daysSinceLastReport: number | null;
  showOnboarding: boolean;
  recommendedPlanId: string | null;
  planName: string | null;
  exerciseCount: number;
  days: HomeTrainingDayOption[];
  supplements: DietSupplement[] | null;
  weightKg: number | null;
  weightDeltaFromPreviousKg: number | null;
  weightFromStartKg: number | null;
  weightKgPerWeek: number | null;
  tempoKgPerMin: number | null;
  todayMacros: HomeStartTodayMacros;
  weekMacros: HomeStartWeekMacros;
  weightSeries: HomeStartWeightPoint[];
  waistSeries: HomeStartWaistPoint[];
  compliance: HomeStartDashboard["compliance"];
  formToday: HomeStartDashboard["formToday"];
  coachNote: HomeStartDashboard["coachNote"];
  przemianaSlot: ReactNode;
  dimensions: {
    waistCm: number | null;
    thighCm: number | null;
    chestCm: number | null;
    armCm: number | null;
    waistSpark: HomeStartSpark[];
    thighSpark: HomeStartSpark[];
    chestSpark: HomeStartSpark[];
    armSpark: HomeStartSpark[];
  };
  recentWorkouts: RecentWorkoutItem[];
  workoutsThisWeek: number;
  cardioThisWeekMinutes: number;
  workoutStreakWeeks: number;
  cardioGoalMinutes: number;
  extraCardio?: ExtraCardioAdvice | null;
};

export function HomeTodayView(props: HomeTodayViewProps) {
  const today = calendarDateKey();
  const lastReportLabel =
    props.daysSinceLastReport != null
      ? formatReportShort(addCalendarDays(today, -props.daysSinceLastReport))
      : null;

  return (
    <div className="space-y-5">
      {props.showOnboarding ? <OnboardingBanner /> : null}

      <HomeTrainingCard
        recommendedPlanId={props.recommendedPlanId}
        planName={props.planName}
        exerciseCount={props.exerciseCount}
        days={props.days}
        workoutsThisWeek={props.workoutsThisWeek}
        cardioThisWeekMinutes={props.cardioThisWeekMinutes}
        workoutStreakWeeks={props.workoutStreakWeeks}
        cardioGoalMinutes={props.cardioGoalMinutes}
        extraCardio={props.extraCardio}
      />

      <HomeSupplementsChip items={props.supplements} />

      <StartMetricTiles
        weightKg={props.weightKg}
        tempoKgPerMin={props.tempoKgPerMin}
        weightFromStartKg={props.weightFromStartKg}
        weightDeltaFromPreviousKg={props.weightDeltaFromPreviousKg}
        todayMacros={props.todayMacros}
        weekMacros={props.weekMacros}
      />

      <HomeSylwetkaSection
        weightKg={props.weightKg}
        weightDeltaFromPreviousKg={props.weightDeltaFromPreviousKg}
        weightFromStartKg={props.weightFromStartKg}
        weightKgPerWeek={props.weightKgPerWeek}
        lastReportLabel={lastReportLabel}
        weightSeries={props.weightSeries}
        waistSeries={props.waistSeries}
      />

      <HomeZalozeniaSection
        dietPct={props.compliance.dietPct}
        trainingPct={props.compliance.trainingPct}
        cardioPct={props.compliance.cardioPct}
        reportCount={props.reportCount}
        dietHistory={props.compliance.dietHistory}
        trainingHistory={props.compliance.trainingHistory}
        cardioHistory={props.compliance.cardioHistory}
        formToday={props.formToday}
      />

      <HomeOdDamiana
        text={props.coachNote?.text ?? null}
        dateKey={props.coachNote?.dateKey ?? null}
      />

      {props.przemianaSlot}

      <HomeObwodySection
        waistCm={props.dimensions.waistCm}
        thighCm={props.dimensions.thighCm}
        chestCm={props.dimensions.chestCm}
        armCm={props.dimensions.armCm}
        waistSpark={props.dimensions.waistSpark}
        thighSpark={props.dimensions.thighSpark}
        chestSpark={props.dimensions.chestSpark}
        armSpark={props.dimensions.armSpark}
      />

      <HomeRecentWorkouts workouts={props.recentWorkouts} />
    </div>
  );
}
