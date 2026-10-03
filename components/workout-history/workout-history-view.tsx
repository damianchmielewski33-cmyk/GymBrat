"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, HeartPulse } from "lucide-react";
import type {
  WorkoutHistoryCard,
  WorkoutHistoryCardioItem,
  WorkoutHistoryOverview,
} from "@/lib/workout-history-overview";
import {
  formatHistoryShortDate,
  formatTonnes,
} from "@/lib/workout-history-overview";
import {
  addCalendarDays,
  calendarWeekdaySun0,
} from "@/lib/local-date";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { AppPageHeader } from "@/components/layout/screen";
import { cn } from "@/lib/utils";
import type { ProgressDeltaUnit } from "@/lib/progress-delta-unit";

function mondayOfWeek(dateKey: string): string {
  const dow = calendarWeekdaySun0(dateKey);
  const offset = dow === 0 ? -6 : 1 - dow;
  return addCalendarDays(dateKey, offset);
}

function formatWeekRange(monday: string): string {
  const sunday = addCalendarDays(monday, 6);
  return `${formatHistoryShortDate(monday)}–${formatHistoryShortDate(sunday)}`;
}

function trenWord(n: number): string {
  if (n === 1) return "tr.";
  return "tr.";
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
      <span className="inline-flex h-7 items-center rounded-md border border-dashed border-white/15 px-2 text-[11px] text-white/30">
        —
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-md border px-2 font-metric text-[12px] tabular-nums",
        isPr
          ? "border-[var(--gym-gold)] bg-[rgba(var(--neon-rgb),0.12)] text-[var(--gym-gold)]"
          : "border-white/12 bg-white/[0.04] text-white/80",
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
  const volumeLabel = formatTonnes(card.volumeKg);
  const dateLabel = formatHistoryShortDate(card.date);

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[var(--gym-surface-sunken)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-white">
            {card.title}
          </p>
          <p className="mt-0.5 text-[11px] text-white/45">
            {dateLabel}
            {card.planLabel ? ` · ${card.planLabel}` : ""}
            {card.durationMinutes != null ? ` · ${card.durationMinutes} min` : ""}
          </p>
        </div>
        <p className="font-metric shrink-0 text-lg tabular-nums text-[var(--gym-gold)]">
          {volumeLabel}
        </p>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-white/40 transition",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="space-y-3 border-t border-white/[0.06] px-3.5 py-3">
          {card.exercises.length === 0 ? (
            <p className="text-xs text-white/40">Brak szczegółów serii.</p>
          ) : (
            <ul className="space-y-3">
              {card.exercises.map((ex) => (
                <li key={ex.id}>
                  <p className="text-[13px] font-medium text-white/90">{ex.name}</p>
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
          <Link
            href={`/workout-history/${card.id}`}
            className="inline-flex h-9 items-center gap-1 text-sm font-medium text-[var(--gym-gold)]"
          >
            Szczegóły sesji
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function CardioRow({ item }: { item: WorkoutHistoryCardioItem }) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{item.title}</p>
        <p className="mt-0.5 text-xs text-white/45">
          {formatHistoryShortDate(item.date)}
          {item.avgHr != null ? ` · ${item.avgHr} bpm` : ""}
        </p>
      </div>
      <p className="font-metric shrink-0 text-lg tabular-nums text-[var(--gym-gold)]">
        {item.minutes}
        <span className="ml-1 text-[11px] text-white/40">min</span>
      </p>
    </>
  );

  if (item.kind === "cardio_log") {
    return (
      <Link
        href={`/cardio/${item.id}`}
        className="app-card flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03]"
      >
        {inner}
        <ChevronRight className="h-4 w-4 shrink-0 text-white/30" aria-hidden />
      </Link>
    );
  }

  return (
    <div className="app-card flex items-center gap-3 px-4 py-3.5">{inner}</div>
  );
}

type Props = {
  overview: WorkoutHistoryOverview;
  progressDeltaUnit?: ProgressDeltaUnit;
};

export function WorkoutHistoryView({
  overview,
  progressDeltaUnit: _progressDeltaUnit = "percent",
}: Props) {
  const { kpis, cards, cardio, planFilters } = overview;
  const [filterPlanKey, setFilterPlanKey] = useState<string | "all">("all");

  const filtered = useMemo(() => {
    if (filterPlanKey === "all") return cards;
    return cards.filter((c) => c.planCompareKey === filterPlanKey);
  }, [cards, filterPlanKey]);

  const weekGroups = useMemo(() => groupByWeek(filtered), [filtered]);

  const tonnageTonnes = Math.max(0, kpis.tonnageThisWeekKg) / 1000;

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 pb-10">
      <AppPageHeader
        kicker="Trening"
        title="Historia"
        description="Sesje pogrupowane tygodniami — rozwijaj, żeby zobaczyć serie."
      />

      <div className="app-card grid grid-cols-3 gap-2 p-3.5 sm:p-4">
        <div className="text-center">
          <p className="app-label">Na tydzień</p>
          <p className="mt-1.5 text-[1.65rem] leading-none text-white sm:text-3xl">
            <AnimatedMetric value={kpis.workoutsThisWeek} />
          </p>
        </div>
        <div className="text-center">
          <p className="app-label">Średni czas</p>
          <p className="mt-1.5 text-[1.65rem] leading-none text-white sm:text-3xl">
            {kpis.avgDurationMinutes != null ? (
              <>
                <AnimatedMetric value={kpis.avgDurationMinutes} />
                <span className="font-metric text-sm text-white/40">′</span>
              </>
            ) : (
              <span className="font-metric text-white/35">—</span>
            )}
          </p>
        </div>
        <div className="text-center">
          <p className="app-label">Tonaż</p>
          <p className="mt-1.5 text-[1.65rem] leading-none text-[var(--gym-gold)] sm:text-3xl">
            <AnimatedMetric value={tonnageTonnes} decimals={1} />
            <span className="font-metric text-sm text-white/40"> t</span>
          </p>
        </div>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
        <button
          type="button"
          onClick={() => setFilterPlanKey("all")}
          className={cn(
            "shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition",
            filterPlanKey === "all"
              ? "bg-[var(--gym-gold)] text-[var(--neon-fg)]"
              : "border border-white/12 bg-[var(--gym-surface-sunken)] text-white/70",
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
                ? "bg-[var(--gym-gold)] text-[var(--neon-fg)]"
                : "border border-white/12 bg-[var(--gym-surface-sunken)] text-white/70",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <section className="space-y-5">
        {weekGroups.length === 0 ? (
          <div className="app-card px-4 py-10 text-center text-sm text-white/50">
            Brak zakończonych treningów — ukończ pierwszą sesję, żeby zobaczyć
            historię.
          </div>
        ) : (
          weekGroups.map((week, idx) => (
            <div key={week.monday} className="space-y-2.5">
              <div className="flex items-baseline gap-2 px-0.5">
                <span className="font-metric text-[15px] text-[var(--gym-gold)]">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/55">
                  {formatWeekRange(week.monday)}
                </span>
                <span className="ml-auto text-[12px] tabular-nums text-white/40">
                  {week.cards.length} {trenWord(week.cards.length)} ·{" "}
                  {formatTonnes(week.volumeKg)}
                </span>
              </div>
              <div className="space-y-2">
                {week.cards.map((card) => (
                  <SessionRow key={card.id} card={card} />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="space-y-2.5">
        <div className="flex items-center gap-2 px-0.5">
          <HeartPulse className="h-4 w-4 text-[var(--gym-gold)]" />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
            Cardio
          </h2>
        </div>
        {cardio.length === 0 ? (
          <p className="text-sm text-white/40">Brak wpisów cardio.</p>
        ) : (
          <div className="space-y-2">
            {cardio.map((c) => (
              <CardioRow key={c.id} item={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
