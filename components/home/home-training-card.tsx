"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Play } from "lucide-react";
import type { WorkoutPlanWithLastWorkoutDTO } from "@/actions/workout-plan";
import { CardioLogSheet } from "@/components/treningi/cardio-log-sheet";
import { HomeCardioProgressStrip } from "@/components/home/home-cardio-progress-strip";
import {
  FullscreenAdOverlay,
  useFullscreenAdGate,
} from "@/components/ads/fullscreen-ad-gate";
import { beginWorkoutFromPlanRow } from "@/lib/start-workout-session";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import type { ExtraCardioAdvice } from "@/lib/extra-cardio-from-macros";
import {
  formatPlanLastDoneRelative,
  formatPlanLastDoneShort,
} from "@/lib/workout-plan-queue";
import { formatCardioWeekShortLabel } from "@/lib/cardio-utils";
import { calendarDateKey, calendarWeekMondayKey } from "@/lib/local-date";
import { cn } from "@/lib/utils";

export type HomeTrainingDayOption = {
  id: string;
  name: string;
  exerciseCount: number;
  lastWorkoutDate: string | null;
  row: WorkoutPlanWithLastWorkoutDTO;
};

function MiniStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="app-card-raised flex min-h-[84px] min-w-0 flex-col items-center justify-center px-2 py-3 text-center">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl leading-none tabular-nums text-[var(--gym-gold)]">
        {value}
        {unit ? (
          <span className="ml-1 text-[11px] font-medium text-[var(--gym-gold)]/70">
            {unit}
          </span>
        ) : null}
      </p>
    </div>
  );
}

export function HomeTrainingCard({
  recommendedPlanId,
  planName,
  days,
  workoutsThisWeek,
  cardioThisWeekMinutes,
  workoutStreakWeeks,
  cardioGoalMinutes,
  extraCardio = null,
}: {
  recommendedPlanId: string | null;
  planName: string | null;
  exerciseCount: number;
  days: HomeTrainingDayOption[];
  workoutsThisWeek: number;
  cardioThisWeekMinutes: number;
  workoutStreakWeeks: number;
  cardioGoalMinutes: number;
  extraCardio?: ExtraCardioAdvice | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cardioOpen, setCardioOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const workoutAd = useFullscreenAdGate("before_workout_start");
  const [selectedId, setSelectedId] = useState<string | null>(
    recommendedPlanId ?? days[0]?.id ?? null,
  );
  const today = calendarDateKey();

  const activeTitle = useActiveWorkoutStore((s) => s.title);
  const activeExercises = useActiveWorkoutStore((s) => s.exercises);
  const workoutStartedAtMs = useActiveWorkoutStore((s) => s.workoutStartedAtMs);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const unfinished = hydrated && activeExercises.length > 0 && workoutStartedAtMs != null;

  const selected = useMemo(() => {
    if (selectedId) {
      const hit = days.find((d) => d.id === selectedId);
      if (hit) return hit;
    }
    return days[0] ?? null;
  }, [days, selectedId]);

  const displayName = unfinished
    ? activeTitle || planName
    : selected?.name ?? planName;

  function begin(row: WorkoutPlanWithLastWorkoutDTO) {
    void workoutAd.runWithAd(() => {
      if (!beginWorkoutFromPlanRow(useActiveWorkoutStore.getState(), row)) return;
      setPending(true);
      router.push("/active-workout");
    });
  }

  const cardioCard = (
    <HomeCardioProgressStrip
      minutesCompleted={cardioThisWeekMinutes}
      weeklyGoal={cardioGoalMinutes}
      extraCardio={extraCardio}
      onAddCardio={() => setCardioOpen(true)}
    />
  );

  const cardioSheet = (
    <CardioLogSheet
      open={cardioOpen}
      onClose={() => setCardioOpen(false)}
      weekProgress={{
        minutesCompleted: cardioThisWeekMinutes,
        goalMinutes: cardioGoalMinutes,
        weekLabel: formatCardioWeekShortLabel(
          calendarWeekMondayKey(calendarDateKey()),
        ),
      }}
    />
  );

  // Trzy równe kafelki; żaden nie nawiguje (cele nawigacji jeszcze nieustalone).
  const weekStats = (
    <div className="grid grid-cols-3 gap-2" aria-label="Podsumowanie tygodnia">
      <MiniStat label="Treningi tyg." value={String(workoutsThisWeek)} />
      <MiniStat
        label="Cardio tyg."
        value={String(Math.round(cardioThisWeekMinutes))}
        unit="min"
      />
      <MiniStat label="Tyg. z rzędu" value={String(workoutStreakWeeks)} />
    </div>
  );

  if (!displayName && days.length === 0 && !unfinished) {
    return (
      <div className="space-y-3">
        <section className="app-card relative overflow-hidden p-5">
          <div
            className="pointer-events-none absolute inset-0 opacity-80"
            style={{
              background:
                "linear-gradient(165deg, rgba(235,196,74,0.14) 0%, transparent 55%)",
            }}
            aria-hidden
          />
          <div className="relative space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
              Trening na dziś
            </p>
            <h2 className="mt-2 text-[26px] font-semibold leading-tight text-white">
              Dodaj plan treningowy
            </h2>
            <p className="mt-2 text-sm text-white/50">
              Ustaw dni planu, żeby szybko startować sesję.
            </p>
            <Link
              href="/plany"
              className="gold-btn mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm"
            >
              <Play className="h-4 w-4 fill-current" aria-hidden />
              Utwórz plan
            </Link>
          </div>
        </section>
        {cardioCard}
        {weekStats}
        {cardioSheet}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <section className="app-card relative overflow-hidden p-5">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background: unfinished
              ? "linear-gradient(145deg, rgba(235,196,74,0.28) 0%, rgba(40,28,8,0.55) 42%, transparent 70%)"
              : "linear-gradient(165deg, rgba(235,196,74,0.16) 0%, transparent 58%)",
          }}
          aria-hidden
        />
        <div className="relative space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
              {unfinished ? "Niedokończony trening" : "Trening na dziś"}
            </p>
            <h2 className="mt-2 text-[28px] font-semibold leading-tight text-white">
              {displayName}
            </h2>
          </div>

          <div className="space-y-3">
            {unfinished ? (
              <Link
                href="/active-workout"
                className="gold-btn inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold"
              >
                <Play className="h-4 w-4 fill-current" aria-hidden />
                Kontynuuj trening
              </Link>
            ) : (
              <button
                type="button"
                disabled={pending || !selected}
                onClick={() => {
                  if (!selected) return;
                  begin(selected.row);
                }}
                className="gold-btn inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm disabled:opacity-55"
              >
                <Play className="h-4 w-4 fill-current" aria-hidden />
                {pending ? "Startuję…" : "Zacznij trening"}
              </button>
            )}
          </div>

          {!unfinished && days.length > 1 ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                aria-expanded={pickerOpen}
                className="app-panel flex w-full items-center justify-center gap-1.5 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55"
              >
                Inny dzień
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition",
                    pickerOpen && "rotate-180",
                  )}
                />
              </button>

              {pickerOpen ? (
                <ul className="app-panel divide-y divide-white/[0.06] overflow-hidden">
                  {days.map((day) => {
                    const inQueue = day.id === recommendedPlanId;
                    const active = day.id === selected?.id;
                    const lastDate = formatPlanLastDoneShort(day.lastWorkoutDate);
                    return (
                      <li key={day.id}>
                        <div
                          className={cn(
                            "flex items-center gap-3 px-4 py-3.5",
                            (active || inQueue) && "bg-white/[0.03]",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedId(day.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p
                              className={cn(
                                "font-semibold leading-tight",
                                inQueue || active
                                  ? "text-[var(--gym-gold)]"
                                  : "text-white",
                              )}
                            >
                              {day.name}
                              <span className="font-normal text-white/45">
                                {" "}
                                · {day.exerciseCount} ćw.
                                {inQueue ? " · w kolejce" : ""}
                              </span>
                            </p>
                            <p className="mt-0.5 text-[12px] text-white/40">
                              {day.lastWorkoutDate
                                ? formatPlanLastDoneRelative(
                                    day.lastWorkoutDate,
                                    today,
                                  )
                                : "jeszcze nie robiony"}
                            </p>
                          </button>
                          <span
                            className={cn(
                              "shrink-0 text-[12px] tabular-nums",
                              lastDate
                                ? "text-white/55"
                                : "text-white/30",
                            )}
                            title={
                              day.lastWorkoutDate
                                ? `Ostatnio: ${day.lastWorkoutDate}`
                                : "Jeszcze nie robiony"
                            }
                          >
                            {lastDate ?? "—"}
                          </span>
                          <button
                            type="button"
                            disabled={pending || day.exerciseCount === 0}
                            onClick={() => begin(day.row)}
                            className="shrink-0 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--gym-gold)] disabled:opacity-40"
                          >
                            Start →
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
      {cardioCard}
      {weekStats}
      {cardioSheet}
      <FullscreenAdOverlay
        open={workoutAd.open}
        onContinue={workoutAd.continueAfterAd}
        placement="before_workout_start"
      />
    </div>
  );
}
