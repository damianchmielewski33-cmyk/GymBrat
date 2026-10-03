"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Pencil } from "lucide-react";
import type {
  WorkoutHistoryCard,
  WorkoutHistoryOverview,
} from "@/lib/workout-history-overview";
import {
  canEditWorkout,
  formatEditDeadline,
  formatHistoryDayChip,
  formatHistoryKg,
  formatHistoryWeekRange,
  formatSetsLabel,
  formatTonnes,
  workoutEditDeadlineMs,
} from "@/lib/workout-history-overview";
import { addCalendarDays, calendarWeekdaySun0 } from "@/lib/local-date";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { cn } from "@/lib/utils";

function mondayOfWeek(dateKey: string): string {
  const dow = calendarWeekdaySun0(dateKey);
  const offset = dow === 0 ? -6 : 1 - dow;
  return addCalendarDays(dateKey, offset);
}

type WeekGroup = {
  monday: string;
  cards: WorkoutHistoryCard[];
  volumeKg: number;
};

function groupByWeek(cards: WorkoutHistoryCard[]): WeekGroup[] {
  const map = new Map<string, WorkoutHistoryCard[]>();
  for (const c of cards) {
    const m = mondayOfWeek(c.date);
    const list = map.get(m);
    if (list) list.push(c);
    else map.set(m, [c]);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([monday, weekCards]) => ({
      monday,
      cards: weekCards,
      volumeKg: weekCards.reduce((s, c) => s + c.volumeKg, 0),
    }));
}

function SetPill({
  reps,
  weight,
  done,
  isPr,
}: {
  reps: number | null;
  weight: number;
  done: boolean;
  isPr: boolean;
}) {
  if (!done) {
    return (
      <span className="inline-flex h-8 items-center rounded-lg border border-dashed border-white/15 px-2.5 text-[11px] text-white/30">
        —
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center rounded-lg border px-2.5 font-metric text-[12px] tabular-nums",
        isPr
          ? "border-[var(--gym-gold)] bg-[rgba(var(--neon-rgb),0.12)] text-[var(--gym-gold)]"
          : "border-white/14 bg-transparent text-white/75",
      )}
      title={isPr ? "Rekord (e1RM)" : undefined}
    >
      {weight}
      <span className="mx-0.5 text-white/35">×</span>
      {reps ?? "—"}
    </span>
  );
}

function SessionRow({ card }: { card: WorkoutHistoryCard }) {
  const [open, setOpen] = useState(false);
  const editable = canEditWorkout(card.endedAt, card.date);
  const deadlineLabel = formatEditDeadline(
    workoutEditDeadlineMs(card.endedAt, card.date),
  );
  const meta = [
    card.durationMinutes != null ? `${card.durationMinutes} min` : null,
    formatSetsLabel(card.setsDone),
    `tydz. ${card.planOccurrence}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-3.5 py-3.5 text-left"
      >
        <div className="w-[52px] shrink-0 pt-0.5">
          <p className="text-[11px] leading-tight text-white/40">
            {formatHistoryDayChip(card.date)}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-white">
            {card.planLabel || card.title}
          </p>
          <p className="mt-0.5 text-[11px] text-white/40">{meta}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
          <p className="font-metric text-[17px] tabular-nums leading-none text-white">
            {formatHistoryKg(card.volumeKg)}
          </p>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-white/45 transition",
              open && "rotate-180",
            )}
          />
        </div>
      </button>

      {open ? (
        <div className="space-y-3.5 border-t border-white/[0.06] px-3.5 pb-3.5 pt-3">
          {card.exercises.length === 0 ? (
            <p className="text-xs text-white/40">Brak szczegółów serii.</p>
          ) : (
            <ul className="space-y-3.5">
              {card.exercises.map((ex) => (
                <li key={ex.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 text-[13px] font-medium text-white/90">
                      {ex.name}
                    </p>
                    <p className="shrink-0 text-[11px] tabular-nums text-white/40">
                      {Math.round(ex.volumeKg)} kg
                    </p>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {ex.sets.map((s, i) => (
                      <SetPill
                        key={i}
                        reps={s.reps}
                        weight={s.weight}
                        done={s.done}
                        isPr={s.isPr}
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {editable ? (
            <div className="flex items-start gap-3 pt-1">
              <Link
                href={`/workout-history/${card.id}/edit`}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-white/25 px-4 text-sm font-semibold text-white transition hover:bg-white/[0.04]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Popraw
              </Link>
              <p className="pt-2 text-[11px] leading-snug text-white/40">
                Dopisz brakujące serie albo popraw liczby — do {deadlineLabel}.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type Props = {
  overview: WorkoutHistoryOverview;
};

export function WorkoutHistoryView({ overview }: Props) {
  const { kpis, cards, planFilters } = overview;
  const [filterPlanKey, setFilterPlanKey] = useState<string | "all">("all");

  const filtered = useMemo(() => {
    if (filterPlanKey === "all") return cards;
    return cards.filter((c) => c.planCompareKey === filterPlanKey);
  }, [cards, filterPlanKey]);

  const weekGroups = useMemo(() => groupByWeek(filtered), [filtered]);
  const tonnageTonnes = Math.max(0, kpis.tonnageTotalKg) / 1000;
  const countLabel = (() => {
    const n = kpis.workoutsTotal;
    if (n === 1) return "1 TRENING";
    if (n >= 2 && n <= 4) return `${n} TRENINGI`;
    return `${n} TRENINGÓW`;
  })();

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 pb-10">
      <Link
        href="/workout-plan"
        className="inline-flex items-center gap-1.5 text-sm text-white/80"
      >
        <ArrowLeft className="h-4 w-4" />
        Wróć
      </Link>

      <header className="space-y-1 px-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
          {countLabel}
        </p>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-white">
          Historia treningów
        </h1>
      </header>

      <div className="app-card grid grid-cols-3 gap-2 px-3 py-4">
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Na tydzień
          </p>
          <p className="mt-1.5 text-[1.7rem] leading-none text-white">
            <AnimatedMetric value={kpis.avgWorkoutsPerWeekLast8} decimals={1} />
          </p>
          <p className="mt-1 text-[10px] text-white/35">ost. 8 tyg.</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Średni czas
          </p>
          <p className="mt-1.5 text-[1.7rem] leading-none text-white">
            {kpis.avgDurationMinutes != null ? (
              <>
                <AnimatedMetric value={kpis.avgDurationMinutes} />
                <span className="ml-1 font-metric text-sm text-white/40">min</span>
              </>
            ) : (
              <span className="font-metric text-white/35">—</span>
            )}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Tonaż
          </p>
          <p className="mt-1.5 text-[1.7rem] leading-none text-white">
            <AnimatedMetric value={tonnageTonnes} decimals={1} />
            <span className="ml-1 font-metric text-sm text-white/40">t</span>
          </p>
          <p className="mt-1 text-[10px] text-white/35">łącznie</p>
        </div>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
        <button
          type="button"
          onClick={() => setFilterPlanKey("all")}
          className={cn(
            "shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition",
            filterPlanKey === "all"
              ? "border border-[var(--gym-gold)]/70 bg-[rgba(var(--neon-rgb),0.08)] text-[var(--gym-gold)]"
              : "border border-white/12 bg-[var(--gym-surface-sunken)] text-white/75",
          )}
        >
          Wszystkie
        </button>
        {planFilters.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setFilterPlanKey(p.id)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition",
              filterPlanKey === p.id
                ? "border border-[var(--gym-gold)]/70 bg-[rgba(var(--neon-rgb),0.08)] text-[var(--gym-gold)]"
                : "border border-white/12 bg-[var(--gym-surface-sunken)] text-white/75",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <section className="space-y-6">
        {weekGroups.length === 0 ? (
          <div className="app-card px-4 py-10 text-center text-sm text-white/50">
            Brak zakończonych treningów — ukończ pierwszą sesję, żeby zobaczyć
            historię.
          </div>
        ) : (
          weekGroups.map((week, idx) => (
            <div key={week.monday} className="space-y-2.5">
              <div className="flex items-baseline gap-2.5 px-0.5">
                <span className="font-metric text-[22px] leading-none text-[var(--gym-gold)]">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">
                  {formatHistoryWeekRange(week.monday)}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-white/40">
                  {week.cards.length} tr. · {formatTonnes(week.volumeKg)}
                </span>
              </div>
              <div className="h-px bg-white/[0.08]" />
              <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[var(--gym-surface-sunken)] divide-y divide-white/[0.06]">
                {week.cards.map((card) => (
                  <SessionRow key={card.id} card={card} />
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
