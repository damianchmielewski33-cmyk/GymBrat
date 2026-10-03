"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ChevronRight,
  Film,
  History,
  StickyNote,
  TrendingUp,
  Video,
} from "lucide-react";
import type { WorkoutPlanWithLastWorkoutDTO } from "@/actions/workout-plan";
import type { TreningiHubStats } from "@/lib/treningi-hub-stats";
import { CardioLogSheet } from "@/components/treningi/cardio-log-sheet";
import { AppPageHeader } from "@/components/layout/screen";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { SectionLabel } from "@/components/ui/section-label";
import { formatPlanLastDoneLabel } from "@/lib/workout-plan-queue";
import { addCalendarDays, calendarDateKey, calendarWeekdaySun0 } from "@/lib/local-date";
import { cn } from "@/lib/utils";

function mondayOfWeek(dateKey: string): string {
  const dow = calendarWeekdaySun0(dateKey);
  const offset = dow === 0 ? -6 : 1 - dow;
  return addCalendarDays(dateKey, offset);
}

function formatShortDate(ymd: string): string {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      day: "numeric",
      month: "short",
    }).format(new Date(`${ymd}T12:00:00`));
  } catch {
    return ymd;
  }
}

function planHasNotes(row: WorkoutPlanWithLastWorkoutDTO): boolean {
  return row.plan.exercises.some(
    (ex) => typeof ex.note === "string" && ex.note.trim().length > 0,
  );
}

function exerciseCountLabel(n: number): string {
  if (n === 1) return "1 ćwiczenie";
  if (n >= 2 && n <= 4) return `${n} ćwiczenia`;
  return `${n} ćwiczeń`;
}

type TreningiHubProps = {
  plans: WorkoutPlanWithLastWorkoutDTO[];
  stats: TreningiHubStats;
  onBegin: (row: WorkoutPlanWithLastWorkoutDTO) => void;
};

export function TreningiHub({ plans, stats, onBegin }: TreningiHubProps) {
  const [cardioOpen, setCardioOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const today = calendarDateKey();
  const weekMonday = mondayOfWeek(today);
  const recentCardioThisWeek = stats.recentCardio.filter(
    (c) => c.date >= weekMonday,
  );

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 pb-8">
      <AppPageHeader
        kicker="Siłownia"
        title="Trening"
        description="Wybierz dzień planu, korektę techniki, postępy albo cardio."
      />

      {/* 01 — dni planu */}
      <section className="space-y-3">
        <SectionLabel
          index={1}
          title="Plan"
          trailing={
            plans.length > 0 ? (
              <Link
                href="/profile/workout-plan"
                className="text-[var(--gym-gold)]/80 hover:text-[var(--gym-gold)]"
              >
                edytuj
              </Link>
            ) : null
          }
        />

        {plans.length === 0 ? (
          <div className="app-card p-5 text-center">
            <p className="text-sm text-white/70">
              Nie masz jeszcze planu. Ustaw dni i ćwiczenia w Profilu.
            </p>
            <Link
              href="/profile/workout-plan"
              className="gold-btn mt-4 inline-flex h-12 items-center justify-center rounded-xl px-5 text-sm"
            >
              Ustaw plan w profilu
            </Link>
          </div>
        ) : (
          <ul className="app-card divide-y divide-white/[0.06] overflow-hidden">
            {plans.map((row, idx) => {
              const name = row.plan.planName.trim() || `Dzień ${idx + 1}`;
              const count = row.plan.exercises.length;
              const hasNotes = planHasNotes(row);
              const busy = pending && pendingId === row.id;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    disabled={count === 0 || pending}
                    onClick={() => {
                      setPendingId(row.id);
                      startTransition(() => onBegin(row));
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors",
                      "hover:bg-white/[0.03] disabled:opacity-50",
                    )}
                  >
                    <span className="font-metric w-9 shrink-0 text-[15px] leading-none text-[var(--gym-gold)]">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-white">
                        {name}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-white/45">
                        {exerciseCountLabel(count)}
                        {" · "}
                        ostatnio {formatPlanLastDoneLabel(row.lastWorkoutDate)}
                      </span>
                    </span>
                    {hasNotes ? (
                      <StickyNote
                        className="h-4 w-4 shrink-0 text-[var(--gym-gold)]/80"
                        aria-label="Ma notatki"
                      />
                    ) : null}
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-white/30"
                      aria-hidden
                    />
                    <span className="sr-only">
                      {busy ? "Startuję…" : "Rozpocznij trening"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 02 — korekta techniki */}
      <section className="space-y-3">
        <SectionLabel index={2} title="Korekta techniki" />
        <div className="app-card divide-y divide-white/[0.06] overflow-hidden">
          <Link
            href="/technique"
            className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03]"
          >
            <Video className="h-4 w-4 shrink-0 text-[var(--gym-gold)]" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white">
                Nagraj technikę
              </span>
              <span className="mt-0.5 block text-[12px] text-white/45">
                wybierz film z telefonu i zapisz lokalnie
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-white/30" aria-hidden />
          </Link>
          <Link
            href="/technique#moje-filmy"
            className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03]"
          >
            <Film className="h-4 w-4 shrink-0 text-[var(--gym-gold)]" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white">
                Moje filmy
              </span>
              <span className="mt-0.5 block text-[12px] text-white/45">
                lista zapisanych nagrań techniki
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-white/30" aria-hidden />
          </Link>
        </div>
      </section>

      {/* 03 — postępy */}
      <section className="space-y-3">
        <SectionLabel index={3} title="Postępy" />
        <div className="app-card divide-y divide-white/[0.06] overflow-hidden">
          <Link
            href="/progress"
            className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03]"
          >
            <TrendingUp
              className="h-4 w-4 shrink-0 text-[var(--gym-gold)]"
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white">
                Postępy
              </span>
              <span className="mt-0.5 block text-[12px] text-white/45">
                siła, sylwetka, zdjęcia, tydzień
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-white/30" aria-hidden />
          </Link>
          <Link
            href="/workout-history"
            className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03]"
          >
            <History className="h-4 w-4 shrink-0 text-[var(--gym-gold)]" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white">
                Historia treningów
              </span>
              <span className="mt-0.5 block text-[12px] text-white/45">
                każda seria, poprawki do 7 dni
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-white/30" aria-hidden />
          </Link>
        </div>
      </section>

      {/* 04 — cardio */}
      <section className="space-y-3">
        <SectionLabel
          index={4}
          title="Cardio"
          trailing={
            <span className="inline-flex items-baseline gap-1 text-white/70">
              <AnimatedMetric
                value={stats.cardioMinutesThisWeek}
                className="text-[15px] text-[var(--gym-gold)]"
              />
              <span className="text-[11px]">
                / {stats.cardioGoalMinutes} min
              </span>
            </span>
          }
        />

        <div className="app-card divide-y divide-white/[0.06] overflow-hidden">
          <button
            type="button"
            onClick={() => setCardioOpen(true)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white">
                Marsz, bieg, bieżnia, zegarek
              </span>
              <span className="mt-0.5 block text-[12px] text-white/45">
                w tym tygodniu:{" "}
                <span className="tabular-nums text-white/70">
                  {stats.cardioSessionsThisWeek}
                </span>{" "}
                {stats.cardioSessionsThisWeek === 1 ? "wpis" : "wpisów"}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-white/30" aria-hidden />
          </button>

          {(recentCardioThisWeek.length > 0
            ? recentCardioThisWeek
            : stats.recentCardio
          )
            .slice(0, 3)
            .map((c) => {
              const inner = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white">
                      {c.title}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-white/45">
                      {formatShortDate(c.date)}
                      {c.avgHr != null ? ` · ${c.avgHr} bpm` : ""}
                    </span>
                  </span>
                  <span className="font-metric shrink-0 text-[18px] tabular-nums text-[var(--gym-gold)]">
                    {c.minutes}
                    <span className="ml-1 text-[11px] text-white/40">min</span>
                  </span>
                </>
              );
              if (c.kind === "cardio_log") {
                return (
                  <Link
                    key={c.id}
                    href={`/cardio/${c.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]"
                  >
                    {inner}
                    <ChevronRight className="h-4 w-4 shrink-0 text-white/30" aria-hidden />
                  </Link>
                );
              }
              return (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                  {inner}
                </div>
              );
            })}
        </div>
      </section>

      <CardioLogSheet
        open={cardioOpen}
        onClose={() => setCardioOpen(false)}
        cardioGoalMinutes={stats.cardioGoalMinutes}
      />
    </div>
  );
}
