"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import type { WorkoutPlanWithLastWorkoutDTO } from "@/actions/workout-plan";
import type { TreningiHubData, TreningiHubDay } from "@/lib/treningi-hub-data";
import type { TreningiHubStats } from "@/lib/treningi-hub-stats";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NextWorkoutCard } from "@/components/treningi/next-workout-card";
import { NoPlanCard } from "@/components/treningi/no-plan-card";
import { PlanDaysPanel } from "@/components/treningi/plan-days-panel";
import { TrainingToolsGrid } from "@/components/treningi/training-tools-grid";
import { TreningiHeader } from "@/components/treningi/treningi-header";
import { UnfinishedWorkoutCard } from "@/components/treningi/unfinished-workout-card";
import { WeekProgressCard } from "@/components/treningi/week-progress-card";
import { useMounted } from "@/hooks/use-mounted";
import { requestActiveWorkoutCloudPush } from "@/lib/active-workout-persist";
import { calendarDateKey } from "@/lib/local-date";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";

type TreningiHubProps = {
  hub: TreningiHubData;
  stats: TreningiHubStats;
  /** Plan, dla którego otwarty jest wybór solo/grupa (pending startu). */
  startingPlanId: string | null;
  onBegin: (row: WorkoutPlanWithLastWorkoutDTO) => void;
};

/** Szkielet karty głównej do hydratacji store (4E): wysokość typowej karty 4A. */
function MainCardSkeleton() {
  return (
    <div
      className="app-card flex min-h-[296px] animate-pulse flex-col p-4 motion-reduce:animate-none"
      aria-busy="true"
      aria-label="Ładowanie treningu"
    >
      <div className="h-3 w-[120px] rounded-lg bg-white/[0.05]" />
      <div className="mt-3 h-6 w-[200px] rounded-lg bg-white/[0.05]" />
      <div className="mt-auto h-12 w-full rounded-lg bg-white/[0.05]" />
    </div>
  );
}

/** Ekran Trening: kompozycja sekcji (ADR 0002, D6). Dane i daty liczy serwer. */
export function TreningiHub({ hub, stats, startingPlanId, onBegin }: TreningiHubProps) {
  const mounted = useMounted();
  const activeTitle = useActiveWorkoutStore((s) => s.title);
  const activeExercises = useActiveWorkoutStore((s) => s.exercises);
  const workoutStartedAtMs = useActiveWorkoutStore((s) => s.workoutStartedAtMs);
  const reset = useActiveWorkoutStore((s) => s.reset);

  const [replaceTarget, setReplaceTarget] = useState<TreningiHubDay | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const focusTitleAfterDiscard = useRef(false);

  const { week, days, nextPlanId, nextLastLoads } = hub;
  const nextDay = days.find((d) => d.row.id === nextPlanId) ?? null;
  const unfinished =
    mounted && activeExercises.length > 0 && workoutStartedAtMs != null;
  const startedToday =
    unfinished && calendarDateKey(new Date(workoutStartedAtMs)) === week.todayKey;

  /** Po porzuceniu fokus trafia na tytuł nowej karty (tabIndex -1). */
  const mainTitleRef = useCallback((el: HTMLHeadingElement | null) => {
    if (el && focusTitleAfterDiscard.current) {
      focusTitleAfterDiscard.current = false;
      el.focus();
    }
  }, []);

  const requestBegin = useCallback(
    (day: TreningiHubDay) => {
      if (startingPlanId != null) return;
      if (unfinished) {
        setReplaceTarget(day);
        return;
      }
      onBegin(day.row);
    },
    [startingPlanId, unfinished, onBegin],
  );

  const discardUnfinished = useCallback(() => {
    focusTitleAfterDiscard.current = true;
    reset();
    requestActiveWorkoutCloudPush(true);
    setAnnouncement("Trening porzucony.");
  }, [reset]);

  let mainCard: ReactNode;
  if (!mounted) {
    mainCard = <MainCardSkeleton />;
  } else if (unfinished) {
    mainCard = (
      <UnfinishedWorkoutCard
        title={activeTitle}
        exerciseNames={activeExercises.map((e) => e.name)}
        startedToday={startedToday}
        onDiscard={discardUnfinished}
      />
    );
  } else if (nextDay) {
    mainCard = (
      <NextWorkoutCard
        day={nextDay}
        todayKey={week.todayKey}
        lastLoads={nextLastLoads}
        starting={startingPlanId === nextDay.row.id}
        startDisabled={startingPlanId != null}
        onStart={() => requestBegin(nextDay)}
        titleRef={mainTitleRef}
      />
    );
  } else {
    mainCard = <NoPlanCard titleRef={mainTitleRef} />;
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 pb-8">
      <TreningiHeader
        weekStartKey={week.startKey}
        weekEndKey={week.endKey}
        streakWeeks={stats.streakWeeks}
      />
      <WeekProgressCard
        days={days}
        nextPlanId={nextPlanId}
        cardioMinutes={stats.cardioMinutesThisWeek}
        cardioSessions={stats.cardioSessionsThisWeek}
      />
      {mainCard}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {days.length > 0 ? (
        <PlanDaysPanel
          days={days}
          todayKey={week.todayKey}
          nextPlanId={nextPlanId}
          startingPlanId={startingPlanId}
          onStart={requestBegin}
        />
      ) : null}
      <TrainingToolsGrid />

      <ConfirmDialog
        open={replaceTarget != null}
        onOpenChange={(open) => {
          if (!open) setReplaceTarget(null);
        }}
        onConfirm={() => {
          if (replaceTarget) onBegin(replaceTarget.row);
        }}
        title="Zacząć nowy trening?"
        description="Masz niedokończony trening. Nowy trening zastąpi go, a odhaczone serie zostaną usunięte."
        confirmLabel="Zacznij nowy"
        cancelLabel="Wróć"
      />
    </div>
  );
}
