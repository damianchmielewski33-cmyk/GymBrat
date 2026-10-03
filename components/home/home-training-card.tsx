"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Play } from "lucide-react";
import type { WorkoutPlanWithLastWorkoutDTO } from "@/actions/workout-plan";
import { beginWorkoutFromPlanRow } from "@/lib/start-workout-session";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import { formatPlanLastDoneLabel } from "@/lib/workout-plan-queue";
import { cn } from "@/lib/utils";

export type HomeTrainingDayOption = {
  id: string;
  name: string;
  exerciseCount: number;
  lastWorkoutDate: string | null;
  row: WorkoutPlanWithLastWorkoutDTO;
};

export function HomeTrainingCard({
  recommendedPlanId,
  planName,
  exerciseCount,
  days,
}: {
  recommendedPlanId: string | null;
  planName: string | null;
  exerciseCount: number;
  days: HomeTrainingDayOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    recommendedPlanId ?? days[0]?.id ?? null,
  );

  const activeTitle = useActiveWorkoutStore((s) => s.title);
  const activePlanId = useActiveWorkoutStore((s) => s.workoutPlanId);
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
  const displayCount = unfinished
    ? activeExercises.length
    : selected?.exerciseCount ?? exerciseCount;

  const planLabel =
    days.find((d) => d.id === (unfinished ? activePlanId : selected?.id))
      ?.name ?? null;

  function begin(row: WorkoutPlanWithLastWorkoutDTO) {
    if (!beginWorkoutFromPlanRow(useActiveWorkoutStore.getState(), row)) return;
    setPending(true);
    router.push("/active-workout");
  }

  if (!displayName && days.length === 0 && !unfinished) {
    return (
      <section className="app-card relative overflow-hidden p-5">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "linear-gradient(165deg, rgba(235,196,74,0.14) 0%, transparent 55%)",
          }}
          aria-hidden
        />
        <div className="relative">
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
            href="/profile/workout-plan"
            className="gold-btn mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm"
          >
            <Play className="h-4 w-4 fill-current" aria-hidden />
            Utwórz plan
          </Link>
        </div>
      </section>
    );
  }

  return (
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
      <div className="relative space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
            {unfinished ? "Niedokończony trening" : "Trening na dziś"}
          </p>
          <h2 className="mt-2 text-[28px] font-semibold leading-tight text-white">
            {displayName}
          </h2>
          <p className="mt-1.5 text-sm text-white/55">
            {displayCount}{" "}
            {displayCount === 1
              ? "ćwiczenie"
              : displayCount >= 2 && displayCount <= 4
                ? "ćwiczenia"
                : "ćwiczeń"}
            {unfinished
              ? planLabel
                ? ` · ${planLabel}`
                : ""
              : selected?.lastWorkoutDate
                ? ` · ostatnio ${formatPlanLastDoneLabel(selected.lastWorkoutDate)}`
                : " · pierwszy raz"}
          </p>
        </div>

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
            {pending ? "Startuję…" : "Start trening"}
          </button>
        )}

        {!unfinished && days.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              aria-expanded={pickerOpen}
              className="flex w-full items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40"
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
              <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-black/30">
                {days.map((day) => {
                  const active = day.id === selected?.id;
                  return (
                    <li key={day.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(day.id);
                          setPickerOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left",
                          active && "bg-white/[0.03]",
                        )}
                      >
                        <span>
                          <span
                            className={cn(
                              "block font-semibold",
                              active
                                ? "text-[var(--gym-gold)]"
                                : "text-white",
                            )}
                          >
                            {day.name}
                          </span>
                          <span className="mt-0.5 block text-sm text-white/50">
                            {day.exerciseCount} ćw. ·{" "}
                            {formatPlanLastDoneLabel(day.lastWorkoutDate)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
