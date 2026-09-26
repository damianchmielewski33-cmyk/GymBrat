"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Play } from "lucide-react";
import type { WorkoutPlanWithLastWorkoutDTO } from "@/actions/workout-plan";
import { beginWorkoutFromPlanRow } from "@/lib/start-workout-session";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import { cn } from "@/lib/utils";

function MiniStat({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  tone: "gold" | "mint" | "sky";
}) {
  const toneClass =
    tone === "gold"
      ? "border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10 text-[var(--gym-gold-bright)]"
      : tone === "mint"
        ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-300"
        : "border-sky-400/35 bg-sky-400/10 text-sky-300";

  return (
    <div className={cn("rounded-2xl border px-2 py-3 text-center", toneClass)}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/55">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold leading-none tabular-nums">
        {value}
        {unit ? (
          <span className="ml-1 text-[11px] font-medium opacity-70">{unit}</span>
        ) : null}
      </p>
    </div>
  );
}

export type NextWorkoutDayOption = {
  id: string;
  name: string;
  exerciseCount: number;
  lastWorkoutDate: string | null;
  /** Pełny wiersz planu — potrzebny do startu sesji. */
  row: WorkoutPlanWithLastWorkoutDTO;
};

export function NextWorkoutTile({
  recommendedPlanId,
  planName,
  exerciseCount,
  exerciseNames,
  firstTime,
  days,
  workoutsThisWeek,
  cardioThisWeekMinutes,
  workoutStreakWeeks,
}: {
  recommendedPlanId: string | null;
  planName: string | null;
  exerciseCount: number;
  exerciseNames: string[];
  firstTime: boolean;
  lastWorkoutDate: string | null;
  days: NextWorkoutDayOption[];
  workoutsThisWeek: number;
  cardioThisWeekMinutes: number;
  workoutStreakWeeks: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    recommendedPlanId ?? days[0]?.id ?? null,
  );

  const selected = useMemo(() => {
    if (selectedId) {
      const hit = days.find((d) => d.id === selectedId);
      if (hit) return hit;
    }
    return days[0] ?? null;
  }, [days, selectedId]);

  const displayName = selected?.name ?? planName;
  const displayCount = selected?.exerciseCount ?? exerciseCount;
  const preview =
    selected && selected.id === recommendedPlanId
      ? exerciseNames.slice(0, 4).join(" · ")
      : selected
        ? selected.row.plan.exercises
            .slice(0, 4)
            .map((e) => e.name)
            .join(" · ")
        : exerciseNames.slice(0, 4).join(" · ");
  const isFirst =
    selected && selected.id === recommendedPlanId
      ? firstTime
      : selected
        ? !selected.lastWorkoutDate
        : firstTime;

  function begin(row: WorkoutPlanWithLastWorkoutDTO) {
    start(() => {
      if (!beginWorkoutFromPlanRow(useActiveWorkoutStore.getState(), row)) return;
      router.push("/active-workout");
    });
  }

  if (!displayName || days.length === 0) {
    return (
      <section className="app-card space-y-5 p-5">
        <div>
          <p className="app-label">Następny trening</p>
          <h2 className="mt-2 text-[28px] font-semibold leading-tight text-white">
            Dodaj plan treningowy
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/50">
            Ustaw plan w Profilu, żeby szybko startować z Treningów.
          </p>
        </div>
        <Link
          href="/profile/workout-plan"
          className="gym-btn-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm"
        >
          <Play className="h-4 w-4 fill-current" aria-hidden />
          Utwórz plan
        </Link>
      </section>
    );
  }

  return (
    <section className="app-card space-y-5 p-5">
      <div>
        <p className="app-label">Następny trening</p>
        <h2 className="mt-2 text-[28px] font-semibold leading-tight text-white">
          {displayName}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/50">
          {displayCount} ćwiczeń ·{" "}
          {isFirst ? "pierwszy raz w tym planie" : "kolejna sesja"}
          {preview
            ? ` · ${preview}${
                (selected?.row.plan.exercises.length ?? exerciseNames.length) > 4
                  ? " · …"
                  : ""
              }`
            : ""}
        </p>
      </div>

      <button
        type="button"
        disabled={pending || !selected}
        onClick={() => {
          if (!selected) return;
          begin(selected.row);
        }}
        className="gym-btn-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm disabled:opacity-55"
      >
        <Play className="h-4 w-4 fill-current" aria-hidden />
        {pending ? "Startuję…" : "Zacznij trening"}
      </button>

      <button
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        aria-expanded={pickerOpen}
        className="flex w-full items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40"
      >
        Inny dzień
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition", pickerOpen && "rotate-180")}
        />
      </button>

      {pickerOpen ? (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-black/30">
          {days.map((day) => {
            const inQueue = day.id === (recommendedPlanId ?? selectedId);
            const active = day.id === selected?.id;
            return (
              <li key={day.id}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3.5",
                    active && "bg-white/[0.03]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(day.id);
                      setPickerOpen(false);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p
                      className={cn(
                        "font-display text-[17px] leading-tight",
                        active
                          ? "text-[var(--gym-gold)]"
                          : "text-[var(--gym-gold-bright)]",
                      )}
                    >
                      {day.name}
                    </p>
                    <p className="mt-0.5 text-sm text-white/55">
                      {day.exerciseCount} ćw.
                      {inQueue ? " · w kolejce" : ""}
                    </p>
                  </button>
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

      <div className="grid grid-cols-3 gap-2 border-t border-white/[0.05] pt-4">
        <MiniStat
          label="Treningi tyg."
          value={String(workoutsThisWeek)}
          tone="gold"
        />
        <MiniStat
          label="Cardio tyg."
          value={String(Math.round(cardioThisWeekMinutes))}
          unit="min"
          tone="mint"
        />
        <MiniStat
          label="Tren. tyg. z rzędu"
          value={String(workoutStreakWeeks)}
          tone="sky"
        />
      </div>
    </section>
  );
}
