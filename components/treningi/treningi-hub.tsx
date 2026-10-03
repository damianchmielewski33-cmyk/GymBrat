"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ChevronRight,
  Download,
  Film,
  Footprints,
  History,
  NotebookPen,
  Play,
  TrendingUp,
  Video,
} from "lucide-react";
import type { WorkoutPlanWithLastWorkoutDTO } from "@/actions/workout-plan";
import type { TreningiHubStats } from "@/lib/treningi-hub-stats";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { SectionLabel } from "@/components/ui/section-label";
import { formatPlanLastDoneRelative } from "@/lib/workout-plan-queue";
import { printWorkoutPlans } from "@/lib/pdf/workout-plan-export";
import { calendarDateKey } from "@/lib/local-date";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import { cn } from "@/lib/utils";

function cwLabel(n: number): string {
  if (n === 1) return "1 ćw.";
  return `${n} ćw.`;
}

function exercisePreview(names: string[], max = 4): string {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (clean.length === 0) return "Brak ćwiczeń";
  const head = clean.slice(0, max).join(", ");
  return clean.length > max ? `${head}…` : head;
}

function streakSubtitle(n: number): string {
  if (n <= 0) return "Zacznij tydzień z treningiem";
  if (n === 1) return "1. tydzień z rzędu z treningiem";
  return `${n}. tydzień z rzędu z treningiem`;
}

type TreningiHubProps = {
  plans: WorkoutPlanWithLastWorkoutDTO[];
  stats: TreningiHubStats;
  onBegin: (row: WorkoutPlanWithLastWorkoutDTO) => void;
};

export function TreningiHub({ plans, stats, onBegin }: TreningiHubProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [hydrated, setHydrated] = useState(false);

  const activeTitle = useActiveWorkoutStore((s) => s.title);
  const activeExercises = useActiveWorkoutStore((s) => s.exercises);
  const workoutStartedAtMs = useActiveWorkoutStore((s) => s.workoutStartedAtMs);
  const reset = useActiveWorkoutStore((s) => s.reset);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const today = calendarDateKey();
  const unfinished =
    hydrated && activeExercises.length > 0 && workoutStartedAtMs != null;

  const unfinishedPreview = useMemo(() => {
    if (!unfinished) return "";
    return exercisePreview(activeExercises.map((e) => e.name));
  }, [unfinished, activeExercises]);

  const startedToday =
    unfinished &&
    workoutStartedAtMs != null &&
    calendarDateKey(new Date(workoutStartedAtMs)) === today;

  const kicker = `PLAN · ${plans.length} DNI · ${Math.max(stats.streakWeeks, plans.length > 0 ? 1 : 0)} TYG.`;

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 pb-8">
      <header className="flex items-start justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]/85">
            {kicker}
          </p>
          <h1 className="mt-1.5 text-[28px] font-semibold leading-tight tracking-tight text-white">
            Trening
          </h1>
          <p className="mt-1.5 text-[13px] text-white/45">
            {streakSubtitle(stats.streakWeeks)}
          </p>
        </div>
        <div className="shrink-0 pt-1 text-right">
          <AnimatedMetric
            value={stats.workoutsThisWeek}
            className="text-[2.75rem] leading-none text-white"
          />
          <p className="mt-1 text-[11px] text-white/40">w tym tygodniu</p>
        </div>
      </header>

      {unfinished ? (
        <section className="relative overflow-hidden rounded-2xl border border-[var(--gym-gold)]/35 bg-[var(--gym-surface-sunken)] p-4 shadow-[0_0_40px_rgba(235,196,74,0.12)]">
          <div
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{
              background:
                "linear-gradient(145deg, rgba(235,196,74,0.28) 0%, rgba(40,28,8,0.45) 45%, transparent 72%)",
            }}
            aria-hidden
          />
          <div className="relative space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
              Niedokończony trening
            </p>
            <h2 className="text-[26px] font-semibold leading-tight text-white">
              {activeTitle.trim() || "Trening"}
            </h2>
            <p className="text-[13px] text-white/80">
              {cwLabel(activeExercises.length)} · {unfinishedPreview}
            </p>
            <p className="text-[12px] text-white/45">
              {startedToday ? "Zaczęty dziś. " : "Sesja w toku. "}
              Odhaczone serie są zapamiętane.
            </p>
            <Link
              href="/active-workout"
              className="gold-btn inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold"
            >
              <Play className="h-4 w-4 fill-current" aria-hidden />
              Kontynuuj trening
            </Link>
            <div className="flex items-center justify-between gap-3 pt-0.5">
              <Link
                href="/workout-history"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]"
              >
                <NotebookPen className="h-3.5 w-3.5" aria-hidden />
                Dziennik obciążeń
              </Link>
              <button
                type="button"
                onClick={() => reset()}
                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]/80"
              >
                Porzuć
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-2.5">
        <SectionLabel
          index={1}
          title="Dni planu"
          titleTone="white"
          trailing={
            plans.length > 0 ? (
              <button
                type="button"
                onClick={() =>
                  printWorkoutPlans(
                    plans.map((p) => ({ id: p.id, plan: p.plan })),
                  )
                }
                className="inline-flex items-center gap-1 text-[var(--gym-gold)]"
                aria-label="Pobierz plan PDF"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                PDF
              </button>
            ) : (
              <Link
                href="/profile/workout-plan"
                className="text-[var(--gym-gold)]"
              >
                edytuj
              </Link>
            )
          }
        />

        {plans.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-[var(--gym-surface-sunken)] px-4 py-8 text-center">
            <p className="text-sm text-white/70">
              Nie masz jeszcze planu. Ustaw dni i ćwiczenia w Profilu.
            </p>
            <Link
              href="/profile/workout-plan"
              className="gold-btn mt-4 inline-flex h-12 items-center justify-center rounded-full px-5 text-sm"
            >
              Ustaw plan w profilu
            </Link>
          </div>
        ) : (
          <>
            <ul className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[var(--gym-surface-sunken)] divide-y divide-white/[0.06]">
              {plans.map((row, idx) => {
                const name = row.plan.planName.trim() || `Dzień ${idx + 1}`;
                const count = row.plan.exercises.length;
                const busy = pending && pendingId === row.id;
                const last = formatPlanLastDoneRelative(
                  row.lastWorkoutDate,
                  today,
                );
                return (
                  <li key={row.id}>
                    <div className="flex items-stretch">
                      <button
                        type="button"
                        disabled={count === 0 || pending}
                        onClick={() => {
                          setPendingId(row.id);
                          startTransition(() => onBegin(row));
                        }}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3.5 text-left transition-colors",
                          "hover:bg-white/[0.03] disabled:opacity-50",
                        )}
                      >
                        <span className="w-8 shrink-0 text-[13px] font-semibold text-white/40">
                          D{idx + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold text-white">
                            {name}
                          </span>
                          <span className="mt-0.5 block text-[12px] text-white/45">
                            {cwLabel(count)} · {last}
                          </span>
                        </span>
                        <span className="sr-only">
                          {busy ? "Startuję…" : "Rozpocznij trening"}
                        </span>
                      </button>
                      <Link
                        href="/workout-history"
                        className="inline-flex items-center px-2 text-white/40 transition hover:text-[var(--gym-gold)]"
                        aria-label={`Dziennik obciążeń — ${name}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <NotebookPen className="h-4 w-4" aria-hidden />
                      </Link>
                      <button
                        type="button"
                        disabled={count === 0 || pending}
                        onClick={() => {
                          setPendingId(row.id);
                          startTransition(() => onBegin(row));
                        }}
                        className="inline-flex items-center pr-3.5 text-white/30"
                        aria-label={`Start ${name}`}
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="px-0.5 text-[11px] leading-relaxed text-white/40">
              Tap = start treningu w kreatorze. Notes = dziennik obciążeń dla
              tych, którzy wolą wpisywać ciężary po treningu.
            </p>
          </>
        )}
      </section>

      <section className="space-y-2.5">
        <SectionLabel index={2} title="Korekta techniki" titleTone="white" />
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[var(--gym-surface-sunken)] divide-y divide-white/[0.06]">
          <Link
            href="/technique"
            className="flex items-center gap-3 px-3.5 py-3.5 transition-colors hover:bg-white/[0.03]"
          >
            <Video className="h-4 w-4 shrink-0 text-[var(--gym-gold)]" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-white">
                Nagraj technikę
              </span>
              <span className="mt-0.5 block text-[12px] text-white/45">
                film z ćwiczenia, Damian odpisze z korektą
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-white/30" aria-hidden />
          </Link>
          <Link
            href="/technique#moje-filmy"
            className="flex items-center gap-3 px-3.5 py-3.5 transition-colors hover:bg-white/[0.03]"
          >
            <Film className="h-4 w-4 shrink-0 text-[var(--gym-gold)]" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-white">
                Moje filmy
              </span>
              <span className="mt-0.5 block text-[12px] text-white/45">
                filmy i odpowiedzi Damiana
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-white/30" aria-hidden />
          </Link>
        </div>
      </section>

      <section className="space-y-2.5">
        <SectionLabel index={3} title="Postępy" titleTone="white" />
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[var(--gym-surface-sunken)] divide-y divide-white/[0.06]">
          <Link
            href="/progress"
            className="flex items-center gap-3 px-3.5 py-3.5 transition-colors hover:bg-white/[0.03]"
          >
            <TrendingUp
              className="h-4 w-4 shrink-0 text-[var(--gym-gold)]"
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-white">
                Postępy
              </span>
              <span className="mt-0.5 block text-[12px] text-white/45">
                siła każdego ćwiczenia, sylwetka, zdjęcia
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-white/30" aria-hidden />
          </Link>
          <Link
            href="/workout-history"
            className="flex items-center gap-3 px-3.5 py-3.5 transition-colors hover:bg-white/[0.03]"
          >
            <History className="h-4 w-4 shrink-0 text-[var(--gym-gold)]" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-white">
                Historia treningów
              </span>
              <span className="mt-0.5 block text-[12px] text-white/45">
                każda seria · popraw albo dokończ do 7 dni
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-white/30" aria-hidden />
          </Link>
        </div>
      </section>

      <section className="space-y-2.5">
        <SectionLabel
          index={4}
          title="Cardio"
          titleTone="white"
          trailing={
            <span className="font-metric tabular-nums text-white">
              <AnimatedMetric
                value={stats.cardioMinutesThisWeek}
                className="text-[15px] text-white"
              />
              <span className="ml-1 text-[12px] text-white/45">min</span>
            </span>
          }
        />
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[var(--gym-surface-sunken)]">
          <Link
            href="/cardio"
            className="flex w-full items-center gap-3 px-3.5 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
          >
            <Footprints
              className="h-4 w-4 shrink-0 text-[var(--gym-gold)]"
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-white">
                Marsz, bieg, bieżnia, zegarek
              </span>
              <span className="mt-0.5 block text-[12px] text-white/45">
                w tym tygodniu {stats.cardioSessionsThisWeek}x ·{" "}
                {stats.cardioMinutesThisWeek} min
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-white/30" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
