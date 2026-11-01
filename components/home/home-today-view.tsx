"use client";

import type { CSSProperties, ReactNode } from "react";
import { HomeTrainingCard, type HomeTrainingDayOption } from "@/components/home/home-training-card";
import { HomeSupplementsChip } from "@/components/home/home-supplements-chip";
import { StartMetricTiles } from "@/components/home/start-metric-tiles";
import { HomeSylwetkaSection } from "@/components/home/home-sylwetka-section";
import { HomeZalozeniaSection } from "@/components/home/home-zalozenia-section";
import { HomeOdDamiana } from "@/components/home/home-od-damiana";
import { HomeObwodySection } from "@/components/home/home-obwody-section";
import { HomeRecentWorkouts } from "@/components/home/home-recent-workouts";
import { AppIntroTour } from "@/components/home/app-intro-tour";
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
  /** Instrukcja startowa (popupy Dalej) po założeniu konta. */
  showIntroTour: boolean;
  recommendedPlanId: string | null;
  planName: string | null;
  exerciseCount: number;
  days: HomeTrainingDayOption[];
  supplements: DietSupplement[] | null;
  weightKg: number | null;
  weightDeltaFromPreviousKg: number | null;
  weightFromStartKg: number | null;
  weightKgPerWeek: number | null;
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
  cardioSheetWeek: {
    minutesCompleted: number;
    goalMinutes: number;
    weekLabel: string;
  };
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
      <AppIntroTour open={props.showIntroTour} />
      {props.showOnboarding ? <OnboardingBanner /> : null}

      <div className="gym-rise" style={{ "--i": 0 } as CSSProperties}>
        <HomeTrainingCard
          recommendedPlanId={props.recommendedPlanId}
          planName={props.planName}
          exerciseCount={props.exerciseCount}
          days={props.days}
          workoutsThisWeek={props.workoutsThisWeek}
          cardioThisWeekMinutes={props.cardioThisWeekMinutes}
          workoutStreakWeeks={props.workoutStreakWeeks}
          cardioGoalMinutes={props.cardioGoalMinutes}
          cardioSheetWeek={props.cardioSheetWeek}
          extraCardio={props.extraCardio}
        />
      </div>

      <div className="gym-rise" style={{ "--i": 1 } as CSSProperties}>
        <HomeSupplementsChip items={props.supplements} />
      </div>

      <div className="gym-rise" style={{ "--i": 2 } as CSSProperties}>
        <StartMetricTiles
          todayMacros={props.todayMacros}
          weekMacros={props.weekMacros}
        />
      </div>

      <div className="gym-rise" style={{ "--i": 3 } as CSSProperties}>
        <HomeSylwetkaSection
          weightKg={props.weightKg}
          weightDeltaFromPreviousKg={props.weightDeltaFromPreviousKg}
          weightFromStartKg={props.weightFromStartKg}
          weightKgPerWeek={props.weightKgPerWeek}
          lastReportLabel={lastReportLabel}
          daysSinceLastReport={props.daysSinceLastReport}
          weightSeries={props.weightSeries}
          waistSeries={props.waistSeries}
        />
      </div>

      <div className="gym-rise" style={{ "--i": 4 } as CSSProperties}>
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
      </div>

      <div className="gym-rise" style={{ "--i": 5 } as CSSProperties}>
        <HomeOdDamiana
          text={props.coachNote?.text ?? null}
          dateKey={props.coachNote?.dateKey ?? null}
        />
      </div>

      <div className="gym-rise" style={{ "--i": 6 } as CSSProperties}>
        {props.przemianaSlot}
      </div>

      <div className="gym-rise" style={{ "--i": 7 } as CSSProperties}>
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
      </div>

      <div className="gym-rise" style={{ "--i": 8 } as CSSProperties}>
        <HomeRecentWorkouts workouts={props.recentWorkouts} />
      </div>
    </div>
  );
}
