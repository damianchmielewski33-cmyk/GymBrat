"use client";

import Link from "next/link";
import { HomeReportCard } from "@/components/home/home-report-card";
import { HomeTrainingCard, type HomeTrainingDayOption } from "@/components/home/home-training-card";
import { HomeSupplementsChip } from "@/components/home/home-supplements-chip";
import { HomeSylwetkaSection } from "@/components/home/home-sylwetka-section";
import { HomeZalozeniaSection } from "@/components/home/home-zalozenia-section";
import { HomeObwodySection } from "@/components/home/home-obwody-section";
import { HomeRecentWorkouts } from "@/components/home/home-recent-workouts";
import { OnboardingBanner } from "@/components/home/onboarding-banner";
import type {
  HomeStartDashboard,
  HomeStartSpark,
  HomeStartWaistPoint,
  HomeStartWeightPoint,
} from "@/lib/home-start";
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

export type HomeTodayViewProps = {
  firstName: string | null;
  lastName: string | null;
  daysInProgram: number | null;
  reportCount: number;
  daysSinceLastReport: number | null;
  reportCadenceDays: number;
  showOnboarding: boolean;
  recommendedPlanId: string | null;
  planName: string | null;
  exerciseCount: number;
  days: HomeTrainingDayOption[];
  supplementNames: string[] | null;
  weightKg: number | null;
  weightDeltaFromPreviousKg: number | null;
  weightFromStartKg: number | null;
  weightKgPerWeek: number | null;
  weightSeries: HomeStartWeightPoint[];
  waistSeries: HomeStartWaistPoint[];
  compliance: HomeStartDashboard["compliance"];
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
};

export function HomeTodayView(props: HomeTodayViewProps) {
  const today = calendarDateKey();
  const programWeek =
    props.daysInProgram != null
      ? Math.max(1, Math.ceil(props.daysInProgram / 7))
      : null;
  const lastReportLabel =
    props.daysSinceLastReport != null
      ? formatReportShort(addCalendarDays(today, -props.daysSinceLastReport))
      : null;

  const greetingName = props.firstName?.trim() || null;

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
            {formatHeaderDate(today)}
          </p>
          <h1 className="mt-1 text-[32px] font-semibold leading-tight tracking-tight text-white">
            Cześć
            {greetingName ? (
              <>
                ,{" "}
                <span className="text-[var(--gym-gold)]">{greetingName}</span>
              </>
            ) : (
              ""
            )}
          </h1>
          <p className="mt-1.5 text-[13px] text-white/45">
            {programWeek != null
              ? `${programWeek}. tydzień programu`
              : "Nowy program"}
            {" · "}
            {props.reportCount}{" "}
            {props.reportCount === 1
              ? "raport"
              : props.reportCount >= 2 && props.reportCount <= 4
                ? "raporty"
                : "raportów"}
          </p>
        </div>

        <Link
          href="/profile"
          className="flex shrink-0 flex-col items-center gap-1"
          aria-label="Profil"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--gym-gold)]/55 bg-[var(--gym-gold)]/15 font-semibold tracking-wide text-[var(--gym-gold)]">
            {initials(props.firstName, props.lastName)}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/40">
            Profil
          </span>
        </Link>
      </header>

      {props.showOnboarding ? <OnboardingBanner /> : null}

      <HomeReportCard
        firstName={props.firstName}
        daysSinceLastReport={props.daysSinceLastReport}
        reportCadenceDays={props.reportCadenceDays}
      />

      <HomeTrainingCard
        recommendedPlanId={props.recommendedPlanId}
        planName={props.planName}
        exerciseCount={props.exerciseCount}
        days={props.days}
      />

      <HomeSupplementsChip names={props.supplementNames} />

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
