"use client";

import { HomeTrainingCard, type HomeTrainingDayOption } from "@/components/home/home-training-card";
import { HomeSupplementsChip } from "@/components/home/home-supplements-chip";
import { StartMetricTiles } from "@/components/home/start-metric-tiles";
import { HomeSylwetkaSection } from "@/components/home/home-sylwetka-section";
import { HomeZalozeniaSection } from "@/components/home/home-zalozenia-section";
import { HomeOdDamiana } from "@/components/home/home-od-damiana";
import { HomePrzemianaSection } from "@/components/home/home-przemiana-section";
import { HomeObwodySection } from "@/components/home/home-obwody-section";
import { HomeRecentWorkouts } from "@/components/home/home-recent-workouts";
import { OnboardingBanner } from "@/components/home/onboarding-banner";
import { AppMenuButton } from "@/components/layout/app-menu-button";
import type {
  HomeStartDashboard,
  HomeStartSpark,
  HomeStartTodayMacros,
  HomeStartWaistPoint,
  HomeStartWeekMacros,
  HomeStartWeightPoint,
} from "@/lib/home-start";
import type { DietSupplement } from "@/lib/diet-supplements";
import type { RecentWorkoutItem } from "@/lib/treningi-hub-stats";
import { addCalendarDays, calendarDateKey } from "@/lib/local-date";

function initials(firstName: string | null, lastName: string | null): string {
  const a = firstName?.trim()?.[0] ?? "";
  const b = lastName?.trim()?.[0] ?? "";
  const out = `${a}${b}`.toUpperCase();
  return out || "?";
}

function formatHeaderDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d
    .toLocaleDateString("pl-PL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    })
    .toUpperCase()
    .replace(",", " ·");
}

function formatReportShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
  });
}

function daysWord(n: number): string {
  if (n === 1) return "dzień";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "dni";
  return "dni";
}

export type HomeTodayViewProps = {
  firstName: string | null;
  lastName: string | null;
  reportCount: number;
  daysSinceLastReport: number | null;
  reportCadenceDays: number;
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
  transformation: HomeStartDashboard["transformation"];
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
};

export function HomeTodayView(props: HomeTodayViewProps) {
  const today = calendarDateKey();
  const lastReportLabel =
    props.daysSinceLastReport != null
      ? formatReportShort(addCalendarDays(today, -props.daysSinceLastReport))
      : null;

  const daysToReport =
    props.daysSinceLastReport == null
      ? null
      : Math.max(0, props.reportCadenceDays - props.daysSinceLastReport);

  const reportCountdownLabel =
    props.daysSinceLastReport == null
      ? "Dodaj pierwszy raport"
      : daysToReport === 0
        ? "Raport na dziś"
        : `${daysToReport} ${daysWord(daysToReport!)} do raportu`;

  const greetingName = props.firstName?.trim() || null;

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]/80">
            {formatHeaderDate(today)}
          </p>
          <h1 className="mt-1 text-[32px] font-semibold leading-tight tracking-tight text-white">
            Cześć
            {greetingName ? (
              <>
                ,{" "}
                <span
                  className="bg-gradient-to-r from-[var(--gym-gold-bright)] via-[var(--gym-gold)] to-[var(--gym-gold-deep)] bg-clip-text text-transparent"
                >
                  {greetingName}
                </span>
              </>
            ) : null}
          </h1>
          <p className="mt-1.5 text-[13px] text-white/45">
            <span className="font-semibold text-white">
              {reportCountdownLabel}
            </span>
            {" · "}
            {props.reportCount}{" "}
            {props.reportCount === 1
              ? "raport"
              : props.reportCount >= 2 && props.reportCount <= 4
                ? "raporty"
                : "raportów"}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-2">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-[var(--gym-gold)]/70 bg-[var(--gym-gold)]/10 font-semibold tracking-wide text-white">
            {initials(props.firstName, props.lastName)}
          </span>
          <AppMenuButton variant="home" />
        </div>
      </header>

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

      <HomePrzemianaSection
        firstPhotoUrl={props.transformation.firstPhotoUrl}
        latestPhotoUrl={props.transformation.latestPhotoUrl}
        latestPhotoDate={props.transformation.latestPhotoDate}
        weightFromStartKg={props.weightFromStartKg}
      />

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
