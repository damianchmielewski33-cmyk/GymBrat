"use client";

import type { CSSProperties } from "react";
import { HomeTrainingCard, type HomeTrainingDayOption } from "@/components/home/home-training-card";
import { HomeSupplementsChip } from "@/components/home/home-supplements-chip";
import { HomeMacroCard } from "@/components/home/home-macro-card";
import { HomeWeekCard } from "@/components/home/home-week-card";
import { HomeSylwetkaSection } from "@/components/home/home-sylwetka-section";
import { HomeZalozeniaSection } from "@/components/home/home-zalozenia-section";
import { AppIntroTour } from "@/components/home/app-intro-tour";
import { OnboardingBanner } from "@/components/home/onboarding-banner";
import type {
  HomeStartDashboard,
  HomeStartTodayMacros,
  HomeStartSpark,
  HomeStartWaistPoint,
  HomeStartWeekMacros,
  HomeStartWeightPoint,
} from "@/lib/home-start";
import type { ExtraCardioAdvice } from "@/lib/extra-cardio-from-macros";
import type { DietSupplement } from "@/lib/diet-supplements";
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
  /** Są treningi w historii, ale brak planu — pokaż „Utwórz plan z ostatnich treningów”. */
  canBuildPlanFromHistory: boolean;
  /** Instrukcja startowa (popupy Dalej) po założeniu konta. */
  showIntroTour: boolean;
  recommendedPlanId: string | null;
  planName: string | null;
  exerciseCount: number;
  days: HomeTrainingDayOption[];
  supplements: DietSupplement[] | null;
  takenSupplements?: string[];
  weightKg: number | null;
  weightDeltaFromPreviousKg: number | null;
  weightFromStartKg: number | null;
  weightKgPerWeek: number | null;
  todayMacros: HomeStartTodayMacros;
  weekMacros: HomeStartWeekMacros;
  weightSeries: HomeStartWeightPoint[];
  waistSeries: HomeStartWaistPoint[];
  armSeries?: HomeStartSpark[];
  chestSeries?: HomeStartSpark[];
  compliance: HomeStartDashboard["compliance"];
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

  const rise = (i: number) => ({ "--i": i }) as CSSProperties;

  return (
    <div className="space-y-4">
      <AppIntroTour open={props.showIntroTour} />
      {props.showOnboarding ? <OnboardingBanner /> : null}

      <div className="gym-rise" style={rise(0)}>
        <HomeTrainingCard
          recommendedPlanId={props.recommendedPlanId}
          planName={props.planName}
          exerciseCount={props.exerciseCount}
          days={props.days}
          canBuildPlanFromHistory={props.canBuildPlanFromHistory}
        />
      </div>

      <div className="gym-rise" style={rise(1)}>
        <HomeWeekCard
          workoutsThisWeek={props.workoutsThisWeek}
          workoutStreakWeeks={props.workoutStreakWeeks}
          cardioMinutes={props.cardioThisWeekMinutes}
          cardioGoalMinutes={props.cardioGoalMinutes}
          cardioSheetWeek={props.cardioSheetWeek}
          extraCardio={props.extraCardio}
        />
      </div>

      <div className="gym-rise" style={rise(2)}>
        <HomeMacroCard
          todayMacros={props.todayMacros}
          weekMacros={props.weekMacros}
        />
      </div>

      <div className="gym-rise" style={rise(3)}>
        <HomeSylwetkaSection
          weightKg={props.weightKg}
          weightDeltaFromPreviousKg={props.weightDeltaFromPreviousKg}
          weightFromStartKg={props.weightFromStartKg}
          weightKgPerWeek={props.weightKgPerWeek}
          lastReportLabel={lastReportLabel}
          daysSinceLastReport={props.daysSinceLastReport}
          weightSeries={props.weightSeries}
          waistSeries={props.waistSeries}
          armSeries={props.armSeries}
          chestSeries={props.chestSeries}
        />
      </div>

      <div className="gym-rise" style={rise(4)}>
        <HomeZalozeniaSection
          dietPct={props.compliance.dietPct}
          trainingPct={props.compliance.trainingPct}
          cardioPct={props.compliance.cardioPct}
          reportCount={props.reportCount}
        />
      </div>

      <div className="gym-rise" style={rise(5)}>
        <HomeSupplementsChip
          items={props.supplements}
          taken={props.takenSupplements}
        />
      </div>
    </div>
  );
}
