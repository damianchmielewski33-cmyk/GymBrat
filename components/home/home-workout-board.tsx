"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Play, Scale, TrendingUp, X } from "lucide-react";
import type { WorkoutPlanWithLastWorkoutDTO } from "@/actions/workout-plan";
import { formatSetScheme } from "@/lib/session-cursor";
import { cn } from "@/lib/utils";
import {
  FEATURED_PLAN_STORAGE_KEY,
  formatExercisePreview,
  pickQueuedPlan,
  polishCwAbbreviation,
  startWorkoutHref,
} from "@/lib/workout-days";

function formatSignedKg(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}`;
}

export function HomeWorkoutBoard({
  plans,
  workoutsThisWeek,
  cardioThisWeekMinutes,
  workoutStreakDays,
  weightKg,
  weightFromStartKg,
}: {
  plans: WorkoutPlanWithLastWorkoutDTO[];
  workoutsThisWeek: number;
  cardioThisWeekMinutes: number;
  workoutStreakDays: number;
  weightKg: number | null;
  weightFromStartKg: number | null;
}) {
  const queued = useMemo(() => pickQueuedPlan(plans), [plans]);
  const [featuredId, setFeaturedId] = useState<string | null>(queued?.id ?? null);
  const [dayMenuOpen, setDayMenuOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(FEATURED_PLAN_STORAGE_KEY);
    if (stored && plans.some((p) => p.id === stored)) {
      setFeaturedId(stored);
      return;
    }
    setFeaturedId(queued?.id ?? null);
  }, [plans, queued?.id]);

  const featured = plans.find((p) => p.id === featuredId) ?? queued ?? plans[0] ?? null;
  const preview = plans.find((p) => p.id === previewId) ?? null;
  const otherDays = plans.filter((p) => p.id !== featured?.id);

  function selectDay(id: string) {
    setFeaturedId(id);
    setDayMenuOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(FEATURED_PLAN_STORAGE_KEY, id);
    }
  }

  if (plans.length === 0) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#111111] p-5">
        <p className="text-sm text-white/60">Dodaj plan treningowy, żeby zacząć sesję ze Startu.</p>
        <Link
          href="/workout-plan"
          className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-b from-[#e8c547] to-[#c4a028] text-sm font-semibold text-[#1a1408]"
        >
          Utwórz plan
        </Link>
      </section>
    );
  }

  const featuredNames = featured?.plan.exercises.map((e) => e.name) ?? [];
  const featuredEmpty = (featured?.plan.exercises.length ?? 0) === 0;

  return (
    <section className="space-y-4">
      <p className="text-[15px] leading-relaxed text-white/70">
        {formatExercisePreview(featuredNames)}
      </p>

      {featured && !featuredEmpty ? (
        <Link
          href={startWorkoutHref(featured.id)}
          className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#e8c547] to-[#c4a028] text-[15px] font-semibold text-[#1a1408] shadow-[0_10px_28px_rgba(212,175,55,0.28)]"
        >
          <Play className="h-4 w-4 fill-current" aria-hidden />
          Zacznij trening
        </Link>
      ) : (
        <Link
          href="/workout-plan"
          className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-b from-[#e8c547] to-[#c4a028] text-[15px] font-semibold text-[#1a1408]"
        >
          Uzupełnij plan
        </Link>
      )}

      {otherDays.length > 0 ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => setDayMenuOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55"
            aria-expanded={dayMenuOpen}
          >
            Inny dzień
            <ChevronDown className={cn("h-3.5 w-3.5 transition", dayMenuOpen && "rotate-180")} />
          </button>
          {dayMenuOpen ? (
            <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#161616] p-1 shadow-xl">
              {otherDays.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => selectDay(row.id)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-white/85 hover:bg-white/[0.06]"
                >
                  <span className="truncate">{row.plan.planName.trim() || "Bez nazwy"}</span>
                  <span className="text-[11px] text-white/40">
                    {polishCwAbbreviation(row.plan.exercises.length)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Treningi tyg." value={String(workoutsThisWeek)} hint="tryb prowadzony" />
        <MiniStat
          label="Cardio tyg."
          value={String(Math.round(cardioThisWeekMinutes))}
          unit="min"
        />
        <MiniStat label="Tyg. z rzędu" value={String(workoutStreakDays)} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141414]">
        {plans.map((row, i) => {
          const isFeatured = row.id === featured?.id;
          const empty = row.plan.exercises.length === 0;
          return (
            <div
              key={row.id}
              className={cn(
                "flex items-center gap-2 px-4 py-3.5",
                i > 0 && "border-t border-white/[0.06]",
              )}
            >
              <button
                type="button"
                onClick={() => setPreviewId(row.id)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-[15px] font-medium text-white">
                  {row.plan.planName.trim() || "Bez nazwy"}
                  {isFeatured ? (
                    <span className="ml-2 text-[12px] font-normal text-white/45">
                      · w kolejce
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[12px] text-white/40">
                  {polishCwAbbreviation(row.plan.exercises.length)}
                </p>
              </button>
              {empty ? (
                <Link href="/workout-plan" className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                  Plan
                </Link>
              ) : (
                <Link
                  href={startWorkoutHref(row.id)}
                  className="shrink-0 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#d4af37]"
                >
                  Start →
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <div className="relative grid grid-cols-2 gap-2 pb-6 pt-2">
        <div className="rounded-2xl border border-white/[0.08] bg-[#141414] px-4 py-4">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
            <Scale className="h-3.5 w-3.5" aria-hidden />
            Waga
          </p>
          <p className="font-heading mt-2 text-3xl font-semibold tabular-nums text-white">
            {weightKg != null ? weightKg : "—"}
            {weightKg != null ? (
              <span className="ml-1 text-base font-medium text-white/40">kg</span>
            ) : null}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#141414] px-4 py-4">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
            <TrendingUp className="h-3.5 w-3.5" aria-hidden />
            Od startu
          </p>
          <p className="font-heading mt-2 text-3xl font-semibold tabular-nums text-white">
            {formatSignedKg(weightFromStartKg)}
            {weightFromStartKg != null ? (
              <span className="ml-1 text-base font-medium text-white/40">kg</span>
            ) : null}
          </p>
        </div>
        <Link
          href="/reports"
          className="absolute left-1/2 top-[calc(50%-0.35rem)] z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-gradient-to-b from-[#e8c547] to-[#c4a028] text-[11px] font-semibold leading-tight text-[#1a1408] shadow-[0_8px_24px_rgba(212,175,55,0.35)]"
        >
          <span className="text-lg leading-none">+</span>
          Raport
        </Link>
      </div>

      {preview ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 sm:items-center">
          <div className="flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#121212]">
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
                  Lista ćwiczeń
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  {preview.plan.planName.trim() || "Trening"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPreviewId(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/70"
                aria-label="Zamknij listę"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
              <SessionExerciseListStatic
                exercises={preview.plan.exercises.map((e) => ({
                  id: e.id,
                  name: e.name,
                  setCount: 3,
                  targetReps: e.reps,
                  doneCount: 0,
                }))}
              />
            </div>
            {preview.plan.exercises.length > 0 ? (
              <div className="px-4 pb-5">
                <Link
                  href={startWorkoutHref(preview.id)}
                  className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-b from-[#e8c547] to-[#c4a028] text-sm font-semibold text-[#1a1408]"
                >
                  Zacznij trening
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MiniStat({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#141414] px-3 py-3">
      <p className="text-[10px] font-bold uppercase leading-tight tracking-wider text-white/40">
        {label}
      </p>
      <p className="font-heading mt-2 text-2xl font-semibold tabular-nums text-[#e8c547]">
        {value}
        {unit ? <span className="ml-1 text-sm font-medium text-[#e8c547]/70">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1 text-[10px] text-white/35">{hint}</p> : null}
    </div>
  );
}

export function SessionExerciseListStatic({
  exercises,
  currentId,
  onPick,
}: {
  exercises: Array<{
    id: string;
    name: string;
    setCount: number;
    targetReps?: number | null;
    doneCount: number;
  }>;
  currentId?: string | null;
  onPick?: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#161616] px-2 py-1">
      {exercises.map((ex, i) => {
        const complete = ex.doneCount >= ex.setCount && ex.setCount > 0;
        const current = currentId === ex.id;
        const rowClass = cn(
          "flex w-full items-start justify-between gap-3 border-b border-white/[0.06] px-3 py-3.5 last:border-b-0",
          onPick && "text-left",
        );
        const body = (
          <>
            <div className="min-w-0">
              <p
                className={cn(
                  "truncate text-[15px] font-medium",
                  complete && "text-emerald-400",
                  current && !complete && "text-[#e8c547]",
                  !complete && !current && "text-white",
                )}
              >
                {i + 1}. {ex.name}
              </p>
              <p className="mt-1 text-[12px] text-white/40">
                {formatSetScheme(ex.setCount, ex.targetReps)}
              </p>
            </div>
            <div className="mt-1.5 flex shrink-0 gap-1">
              {Array.from({ length: Math.max(ex.setCount, 1) }).map((_, di) => (
                <span
                  key={di}
                  className={cn(
                    "h-2 w-2 rounded-full",
                    di < ex.doneCount
                      ? complete
                        ? "bg-emerald-400"
                        : "bg-[#e8c547]"
                      : "bg-white/20",
                  )}
                />
              ))}
            </div>
          </>
        );
        return onPick ? (
          <button key={ex.id} type="button" onClick={() => onPick(ex.id)} className={rowClass}>
            {body}
          </button>
        ) : (
          <div key={ex.id} className={rowClass}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
