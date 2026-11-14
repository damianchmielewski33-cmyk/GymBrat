"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { loadMoreNutritionWeeks } from "@/actions/nutrition-weeks";
import { loadNutritionDayLog } from "@/actions/nutrition-day-log";
import { EmptyNote } from "@/components/progress/progress-ui";
import {
  MacroFilterChips,
  type MacroFilter,
} from "@/components/nutrition/macro-filter-chips";
import { NutritionDayDiary } from "@/components/nutrition/nutrition-day-diary";
import { DIET_DIARY_SLOTS, DIET_DIARY_SLOT_LABELS } from "@/lib/diet-diary-slots";
import { addCalendarDays } from "@/lib/local-date";
import type { MealLogDto } from "@/lib/meal-logs";
import type { PreviousWeekNutritionSheetWeek } from "@/lib/nutrition-dashboard";
import {
  buildDayCardViewModel,
  formatPlNumber,
  formatSignedAmount,
} from "@/lib/nutrition-day-balance";
import {
  buildPeriodCells,
  classifyPeriodDay,
  flattenWeekRows,
  formatKcalDelta,
  PERIOD_DAYS,
  periodStartKey,
  rowsInRange,
  summarizePeriod,
  type PeriodCell,
  type PeriodDayStatus,
  type PeriodSummary,
} from "@/lib/nutrition-period";
import type { WeekDayNutritionRow } from "@/lib/week-nutrition-rows";
import { cn } from "@/lib/utils";

export type StatsTab = "today" | "week" | "month" | "quarter";

const TABS: { id: StatsTab; label: string }[] = [
  { id: "today", label: "Dziś" },
  { id: "week", label: "Tydzień" },
  { id: "month", label: "Miesiąc" },
  { id: "quarter", label: "3 mies." },
];

const CELL_STYLE: Record<PeriodDayStatus, string> = {
  ok: "border-[var(--gym-success)] bg-[color-mix(in_srgb,var(--gym-success)_12%,transparent)] text-white",
  over: "border-[var(--gym-gold)] bg-[var(--gym-gold)] text-[var(--gym-on-gold)]",
  under: "border-dashed border-white/50 bg-[var(--gym-surface-sunken)] text-white",
  empty: "border-transparent bg-[var(--gym-iron)] text-white/60",
  no_goal: "border-transparent bg-[var(--gym-iron)] text-white/70",
  today: "border-2 border-[var(--gym-gold-bright)] bg-[var(--gym-surface-gold)] text-white",
  future: "border-[var(--gym-iron)] text-white/50",
  out: "border-transparent text-transparent",
};

const STATUS_ARIA: Record<PeriodDayStatus, string> = {
  ok: "w normie",
  over: "ponad cel",
  under: "poniżej celu",
  empty: "brak wpisów",
  no_goal: "brak celu",
  today: "dzień w toku",
  future: "przyszłość",
  out: "",
};

function plDate(dateKey: string, opts: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat("pl-PL", opts).format(new Date(`${dateKey}T12:00:00`));
  } catch {
    return dateKey;
  }
}

const h2Class = "text-[13px] font-bold uppercase tracking-[0.12em] text-[var(--gym-gold)]";

function RangeNav({
  label,
  sub,
  canPrev,
  canNext,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: {
  label: string;
  sub: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
}) {
  const btn =
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--gym-border-gold)] text-white transition";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={prevLabel}
        disabled={!canPrev}
        onClick={onPrev}
        className={cn(btn, !canPrev && "opacity-35")}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1 text-center">
        <p className="truncate text-[16px] font-bold text-white">{label}</p>
        <p className="text-[13px] text-white/65">{sub}</p>
      </div>
      <button
        type="button"
        aria-label={nextLabel}
        disabled={!canNext}
        onClick={onNext}
        className={cn(btn, !canNext && "opacity-35")}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

function CalendarGrid({
  cells,
  size,
  onPick,
}: {
  cells: PeriodCell[];
  size: "lg" | "sm";
  onPick: (dateKey: string) => void;
}) {
  return (
    <div className={cn("grid grid-cols-7", size === "lg" ? "gap-1.5" : "gap-1")}>
      {cells.map((c) => {
        const inert = c.status === "out" || c.status === "future";
        return (
          <button
            key={c.dateKey}
            type="button"
            disabled={inert}
            tabIndex={c.status === "out" ? -1 : undefined}
            aria-hidden={c.status === "out" ? true : undefined}
            aria-label={
              inert
                ? undefined
                : `${plDate(c.dateKey, { day: "numeric", month: "long" })}: ${STATUS_ARIA[c.status]}${
                    c.kcalDelta != null ? ` ${formatKcalDelta(c.kcalDelta)} kcal` : ""
                  }. Otwórz dziennik`
            }
            onClick={() => onPick(c.dateKey)}
            className={cn(
              "flex flex-col items-center justify-between rounded-[10px] border-[1.5px] font-semibold tabular-nums",
              size === "lg" ? "min-h-[58px] px-0.5 py-1" : "min-h-10 justify-center py-0",
              CELL_STYLE[c.status],
            )}
          >
            <span className={size === "lg" ? "text-[15px] font-bold" : "text-[13px]"}>
              {c.status === "out" ? "" : c.dayOfMonth}
            </span>
            {size === "lg" ? (
              <span className="text-[12px] font-bold tracking-tight">
                {c.status === "today"
                  ? "dziś"
                  : c.status === "out" || c.status === "future"
                    ? ""
                    : formatKcalDelta(c.kcalDelta)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function CalendarLegend() {
  const item = "inline-flex items-center gap-1.5";
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[12px] text-white/70">
      <span className={item}>
        <i className="inline-block h-2.5 w-2.5 rounded-[3px] border-[1.5px] border-[var(--gym-success)]" />
        w normie
      </span>
      <span className={item}>
        <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[var(--gym-gold)]" />
        ponad cel (+)
      </span>
      <span className={item}>
        <i className="inline-block h-2.5 w-2.5 rounded-[3px] border-[1.5px] border-dashed border-white/60" />
        poniżej celu (−)
      </span>
      <span className={item}>
        <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[var(--gym-iron)]" />
        brak wpisów
      </span>
    </div>
  );
}

function WeekdayHeader() {
  return (
    <div className="grid grid-cols-7 gap-1.5 text-center text-[13px] font-semibold text-white/70">
      {["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map((d) => (
        <span key={d}>{d}</span>
      ))}
    </div>
  );
}

function MacroAverageCards({ summary }: { summary: PeriodSummary }) {
  return (
    <div className="space-y-2.5">
      {summary.averages.map((a) => {
        const pct = a.pct ?? 0;
        const delta = a.avgDelta != null ? Math.round(a.avgDelta) : null;
        const word =
          a.avgGoal == null || a.daysCounted === 0
            ? "brak danych"
            : a.status === "on_track"
              ? "w normie"
              : `${delta! > 0 ? "+" : "−"}${formatPlNumber(Math.abs(delta!))} ${a.unit}`;
        return (
          <div key={a.key} className="app-card px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[16px] font-bold text-white">{a.label}</span>
              <span
                className={cn(
                  "text-[14px] font-bold",
                  a.status === "on_track" && "text-[var(--gym-success)]",
                  a.status === "surplus" && "text-[var(--gym-gold-bright)]",
                  (a.status === "deficit" || a.status === "no_goal") && "text-white",
                )}
              >
                {word}
              </span>
            </div>
            <p className="mt-1 text-[15px] tabular-nums text-white/70">
              średnio <b className="text-white">{formatPlNumber(a.avgConsumed)} {a.unit}</b>
              {a.avgGoal != null ? ` z ${formatPlNumber(a.avgGoal)} dziennie` : " dziennie"}
            </p>
            <div className="mt-2.5 h-3 rounded-full bg-[var(--gym-track)]">
              <div
                className={cn(
                  "h-3 rounded-full",
                  a.status === "deficit" ? "bg-white/55" : "bg-[var(--gym-gold)]",
                )}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SummaryCard({
  summary,
  intro,
  extra,
}: {
  summary: PeriodSummary;
  intro: string;
  extra?: React.ReactNode;
}) {
  const k = summary.kcal;
  if (summary.daysCounted === 0) {
    return (
      <EmptyNote>
        Brak zamkniętych dni z wpisami w tym okresie. Statystyki pojawią się po pierwszym
        zapisanym dniu.
      </EmptyNote>
    );
  }
  const delta = k.avgDelta != null ? Math.round(k.avgDelta) : null;
  return (
    <section className="app-card space-y-3.5 p-4 sm:p-5">
      <p className="text-[14px] text-white/70">{intro}</p>
      {delta != null ? (
        <p className="font-metric text-[44px] leading-none tabular-nums text-[var(--gym-gold-bright)]">
          {formatKcalDelta(delta)}{" "}
          <span className="font-sans text-[18px] font-semibold text-white">
            {delta === 0 ? "kcal – dokładnie w celu" : delta > 0 ? "kcal ponad cel" : "kcal poniżej celu"}
          </span>
        </p>
      ) : null}
      <p className="text-[15px] tabular-nums text-white">
        {formatPlNumber(k.avgConsumed)}{" "}
        <span className="text-white/70">
          {k.avgGoal != null ? `z ${formatPlNumber(k.avgGoal)} kcal dziennie` : "kcal dziennie"}
          {k.pct != null ? ` · ${k.pct}%` : ""}
        </span>
      </p>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["w normie", summary.counts.ok, "text-[var(--gym-success)]"],
            ["ponad cel", summary.counts.over, "text-[var(--gym-gold-bright)]"],
            ["poniżej", summary.counts.under, "text-white"],
          ] as const
        ).map(([label, n, tone]) => (
          <div key={label} className="rounded-xl bg-[var(--gym-surface-sunken)] px-2 py-2.5 text-center">
            <p className={cn("text-[22px] font-bold tabular-nums", tone)}>{n}</p>
            <p className="text-[12px] text-white/70">{label}</p>
          </div>
        ))}
      </div>
      {extra}
      <p className="text-[12px] text-white/60">
        Średnie z {summary.daysCounted} {summary.daysCounted === 1 ? "dnia" : "dni"} z wpisami
        (bez dnia w toku). Dni bez wpisów nie liczą się.
      </p>
    </section>
  );
}

/* ───────────────────────── DZIŚ ───────────────────────── */

function TodayPanel({
  todayKey,
  rows,
  onOpenDay,
}: {
  todayKey: string;
  rows: WeekDayNutritionRow[];
  onOpenDay: (k: string) => void;
}) {
  const row = rows.find((r) => r.dateKey === todayKey);
  const card = row ? buildDayCardViewModel(row, todayKey) : null;
  const [meals, setMeals] = useState<MealLogDto[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadNutritionDayLog(todayKey)
      .then((res) => {
        if (!cancelled) setMeals(res.ok ? res.entries : []);
      })
      .catch(() => {
        if (!cancelled) setMeals([]);
      });
    return () => {
      cancelled = true;
    };
  }, [todayKey]);

  const kcal = card?.macros.find((m) => m.key === "calories") ?? null;
  const rest = (card?.macros ?? []).filter((m) => m.key !== "calories");
  const slots = useMemo(() => {
    if (!meals) return [];
    return DIET_DIARY_SLOTS.map((slot) => {
      const items = meals.filter((e) => e.slot === slot);
      return {
        slot,
        name: DIET_DIARY_SLOT_LABELS[slot],
        names: items.map((e) => e.name?.trim() || "Posiłek").join(", "),
        kcal: items.reduce((n, e) => n + e.calories, 0),
        count: items.length,
      };
    }).filter((s) => s.count > 0);
  }, [meals]);

  const week = useMemo(() => {
    const out: PeriodCell[] = [];
    for (let i = 6; i >= 0; i--) {
      const k = addCalendarDays(todayKey, -i);
      const r = rows.find((x) => x.dateKey === k);
      out.push({
        dateKey: k,
        dayOfMonth: Number(k.slice(8, 10)),
        ...classifyPeriodDay(r, k, todayKey),
      });
    }
    return out;
  }, [rows, todayKey]);

  if (!card || !kcal) return <EmptyNote>Brak danych na dziś.</EmptyNote>;

  const goal = kcal.goal;
  const remaining = goal != null ? goal - kcal.consumed : null;
  const over = goal != null && kcal.consumed > goal * 1.05;
  const ratio = goal ? Math.min(1, kcal.consumed / goal) : 0;
  const circ = 2 * Math.PI * 86;

  const lacking = rest
    .filter((m) => m.goal != null && m.goal - m.consumed > m.goal * 0.1)
    .map((m) => {
      const left = Math.round(m.goal! - m.consumed);
      const what = m.key === "protein" ? "białka" : m.key === "carbs" ? "węgli" : "tłuszczu";
      return `${left} g ${what}`;
    });

  return (
    <div className="space-y-5">
      <section className="app-card flex flex-col items-center gap-3.5 p-5 text-center">
        <p className="text-[14px] text-white/70">
          {plDate(todayKey, { weekday: "long", day: "numeric", month: "long" })}
          {" · "}
          {card.dayType === "training" ? "dzień treningowy" : "dzień bez treningu"}
        </p>
        <div className="relative h-[200px] w-[200px]">
          <svg
            width="200"
            height="200"
            viewBox="0 0 200 200"
            role="img"
            aria-label={`Zjedzono ${Math.round(kcal.consumed)}${goal != null ? ` z ${Math.round(goal)}` : ""} kilokalorii`}
          >
            <circle cx="100" cy="100" r="86" fill="none" stroke="var(--gym-track)" strokeWidth="16" />
            <circle
              cx="100"
              cy="100"
              r="86"
              fill="none"
              stroke="var(--gym-gold)"
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={`${circ * ratio} ${circ}`}
              transform="rotate(-90 100 100)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-metric text-[44px] leading-none tabular-nums text-[var(--gym-gold-bright)]">
              {remaining == null
                ? formatPlNumber(kcal.consumed)
                : formatPlNumber(Math.abs(remaining))}
            </span>
            <span className="mt-1 text-[14px] text-white">
              {remaining == null ? "kcal zjedzone" : remaining >= 0 ? "kcal zostało" : "kcal ponad cel"}
            </span>
          </div>
        </div>
        <p className="text-[16px] font-semibold tabular-nums text-white">
          {formatPlNumber(kcal.consumed)}{" "}
          {goal != null ? (
            <span className="font-medium text-white/70">z {formatPlNumber(goal)} kcal</span>
          ) : (
            <span className="font-medium text-white/70">kcal · brak celu</span>
          )}
        </p>
        <p className="w-full rounded-xl border border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] px-3.5 py-3 text-left text-[15px] leading-snug text-white">
          {!card.hasEntries
            ? "Nie dodano jeszcze posiłków dziś."
            : over
              ? `Dziś jesteś ${formatPlNumber(kcal.consumed - goal!)} kcal ponad cel.`
              : lacking.length > 0
                ? `Do celu zostało jeszcze: ${lacking.join(", ")}.`
                : "Makroskładniki są dziś w normie."}
        </p>
      </section>

      <section className="space-y-2.5" aria-labelledby="stats-macro-h">
        <h2 id="stats-macro-h" className={h2Class}>
          Makroskładniki
        </h2>
        {rest.map((m) => {
          const left = m.goal != null ? Math.round(m.goal - m.consumed) : null;
          const isOver = m.goal != null && m.consumed > m.goal * 1.05;
          const word =
            m.goal == null
              ? "Brak celu"
              : isOver
                ? `Ponad cel +${formatPlNumber(m.consumed - m.goal)} g`
                : left! > m.goal * 0.1
                  ? `Brakuje ${formatPlNumber(left!)} g`
                  : "W normie";
          return (
            <div key={m.key} className="app-card px-4 py-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[16px] font-bold text-white">{m.label}</span>
                <span
                  className={cn(
                    "text-[14px] font-bold",
                    word === "W normie" ? "text-[var(--gym-success)]" : isOver ? "text-[var(--gym-gold-bright)]" : "text-white",
                  )}
                >
                  {word}
                </span>
              </div>
              <p className="mt-1.5 font-metric text-[22px] tabular-nums text-white">
                {formatPlNumber(m.consumed)}
                <span className="font-sans text-[15px] font-medium text-white/70">
                  {m.goal != null ? ` / ${formatPlNumber(m.goal)} g` : " g"}
                </span>
              </p>
              <div className="mt-2.5 h-3 rounded-full bg-[var(--gym-track)]">
                <div
                  className="h-3 rounded-full bg-[var(--gym-gold)]"
                  style={{ width: `${m.goal ? Math.min(100, (m.consumed / m.goal) * 100) : 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </section>

      <section className="space-y-2.5" aria-labelledby="stats-meals-h">
        <div className="flex items-center justify-between">
          <h2 id="stats-meals-h" className={h2Class}>
            Dziś zjedzone
          </h2>
          <button
            type="button"
            onClick={() => onOpenDay(todayKey)}
            className="inline-flex min-h-11 items-center text-[14px] font-semibold text-[var(--gym-gold)]"
          >
            Pełny dziennik ›
          </button>
        </div>
        {meals == null ? (
          <EmptyNote>Wczytuję posiłki…</EmptyNote>
        ) : slots.length === 0 ? (
          <EmptyNote>Brak wpisów posiłków dziś.</EmptyNote>
        ) : (
          slots.map((s) => (
            <div
              key={s.slot}
              className="app-card flex min-h-14 items-center justify-between gap-3 px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-white">{s.name}</p>
                <p className="truncate text-[13px] text-white/65">{s.names}</p>
              </div>
              <span className="whitespace-nowrap text-[15px] font-bold tabular-nums text-white">
                {formatPlNumber(s.kcal)} kcal
              </span>
            </div>
          ))
        )}
      </section>

      <section className="space-y-2.5" aria-labelledby="stats-last7-h">
        <h2 id="stats-last7-h" className={h2Class}>
          Ostatnie 7 dni
        </h2>
        <div className="grid grid-cols-7 gap-1.5">
          {week.map((c) => (
            <button
              key={c.dateKey}
              type="button"
              onClick={() => onOpenDay(c.dateKey)}
              aria-label={`${plDate(c.dateKey, { weekday: "long" })}: ${STATUS_ARIA[c.status]}${
                c.kcalDelta != null ? ` ${formatKcalDelta(c.kcalDelta)} kcal` : ""
              }. Otwórz dziennik`}
              className={cn(
                "flex min-h-[76px] flex-col items-center justify-between rounded-xl border-[1.5px] px-0.5 py-1.5 tabular-nums",
                CELL_STYLE[c.status],
              )}
            >
              <span className="text-[13px] font-semibold">
                {c.status === "today" ? "Dziś" : plDate(c.dateKey, { weekday: "short" }).replace(".", "")}
              </span>
              <span className="text-[13px] font-bold">
                {c.status === "today" ? "" : formatKcalDelta(c.kcalDelta)}
              </span>
            </button>
          ))}
        </div>
        <p className="text-[13px] text-white/65">
          Liczby = różnica kcal względem celu. Dotknij dnia, aby zobaczyć dziennik.
        </p>
      </section>
    </div>
  );
}

/* ───────────────────────── TYDZIEŃ ───────────────────────── */

function weekdayName(dateKey: string): string {
  return plDate(dateKey, { weekday: "long" });
}

function deviationDetail(row: WeekDayNutritionRow, todayKey: string): string {
  const card = buildDayCardViewModel(row, todayKey);
  return card.deviations
    .filter((d) => d.key !== "calories")
    .slice(0, 2)
    .map((d) => `${d.label.toLowerCase()} ${formatSignedAmount(d.delta, d.unit)}`)
    .join(" · ");
}

function WeekPanel({
  todayKey,
  weeks,
  viewIndex,
  setViewIndex,
  onOpenDay,
}: {
  todayKey: string;
  weeks: PreviousWeekNutritionSheetWeek[];
  viewIndex: number;
  setViewIndex: (n: number) => void;
  onOpenDay: (k: string) => void;
}) {
  const week = weeks[viewIndex] ?? weeks[0];
  const rows = useMemo(() => week?.dayRows ?? [], [week]);
  const summary = useMemo(() => summarizePeriod(rows, todayKey), [rows, todayKey]);
  const isCurrent = Boolean(week && week.weekStart <= todayKey && todayKey <= week.weekEnd);
  if (!week) return <EmptyNote>Brak danych tygodnia.</EmptyNote>;

  const bars = rows.map((r) => {
    const c = classifyPeriodDay(r, r.dateKey, todayKey);
    const goal = r.caloriesGoal;
    const h =
      goal && c.status !== "future" && r.entryCount > 0
        ? Math.max(6, Math.round(Math.min(1.3, r.caloriesConsumed / goal) * 130))
        : 6;
    return { r, c, h };
  });
  const barTone: Record<PeriodDayStatus, string> = {
    ok: "bg-[var(--gym-success)]",
    over: "bg-[var(--gym-gold)]",
    under: "bg-white/40",
    today: "bg-[var(--gym-gold-bright)]/60",
    empty: "bg-[var(--gym-iron)]",
    no_goal: "bg-white/25",
    future: "bg-[var(--gym-iron)]",
    out: "bg-transparent",
  };
  const deviating = rows
    .map((r) => ({ r, c: classifyPeriodDay(r, r.dateKey, todayKey) }))
    .filter((x) => x.c.status === "over" || x.c.status === "under")
    .reverse();

  const insight =
    summary.maxOver || summary.maxUnder ? (
      <p className="rounded-xl border border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] px-3.5 py-3 text-[15px] leading-snug text-white">
        {summary.maxOver ? (
          <>
            Najwięcej ponad cel:{" "}
            <b className="text-[var(--gym-gold-bright)]">
              {weekdayName(summary.maxOver.dateKey)} ({formatKcalDelta(summary.maxOver.delta)})
            </b>
            .{" "}
          </>
        ) : null}
        {summary.maxUnder ? (
          <>
            Najmniej: <b>{weekdayName(summary.maxUnder.dateKey)} ({formatKcalDelta(summary.maxUnder.delta)})</b>.
          </>
        ) : null}
      </p>
    ) : null;

  return (
    <div className="space-y-5">
      <RangeNav
        label={week.weekLabel}
        sub={isCurrent ? "Bieżący tydzień" : `${viewIndex} tyg. wstecz`}
        canPrev={viewIndex < weeks.length - 1}
        canNext={viewIndex > 0}
        onPrev={() => setViewIndex(viewIndex + 1)}
        onNext={() => setViewIndex(viewIndex - 1)}
        prevLabel="Poprzedni tydzień"
        nextLabel="Nowszy tydzień"
      />

      <SummaryCard summary={summary} intro="Średnio dziennie w tym tygodniu" extra={insight} />

      <section className="space-y-2.5" aria-labelledby="stats-week-days-h">
        <h2 id="stats-week-days-h" className={h2Class}>
          Każdy dzień
        </h2>
        <div className="app-card px-3 pb-3 pt-4">
          <div className="relative flex h-[170px] items-end gap-2">
            <div
              className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-white/60"
              style={{ bottom: 130 }}
              aria-hidden
            />
            <span
              className="pointer-events-none absolute right-0.5 text-[12px] text-white/65"
              style={{ bottom: 134 }}
              aria-hidden
            >
              cel
            </span>
            {bars.map(({ r, c, h }) => (
              <button
                key={r.dateKey}
                type="button"
                onClick={() => onOpenDay(r.dateKey)}
                disabled={c.status === "future"}
                aria-label={`${weekdayName(r.dateKey)}: ${STATUS_ARIA[c.status]}${
                  c.kcalDelta != null ? ` ${formatKcalDelta(c.kcalDelta)} kcal` : ""
                }. Otwórz dziennik`}
                className="flex h-[170px] flex-1 flex-col items-center justify-end gap-1.5"
              >
                <span className="text-[13px] font-bold tabular-nums text-white">
                  {c.status === "today" ? "dziś" : formatKcalDelta(c.kcalDelta)}
                </span>
                <span
                  className={cn("block w-full rounded-t-md", barTone[c.status])}
                  style={{ height: h }}
                />
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2 text-center">
            {rows.map((r) => (
              <span key={r.dateKey} className="flex-1 text-[13px] font-semibold text-white/70">
                {plDate(r.dateKey, { weekday: "short" }).replace(".", "")}
              </span>
            ))}
          </div>
        </div>
        <CalendarLegend />
      </section>

      {summary.daysCounted > 0 ? (
        <section className="space-y-2.5" aria-labelledby="stats-week-macro-h">
          <h2 id="stats-week-macro-h" className={h2Class}>
            Tydzień wg makro
          </h2>
          <MacroAverageCards summary={summary} />
        </section>
      ) : null}

      <section className="space-y-2.5" aria-labelledby="stats-week-dev-h">
        <h2 id="stats-week-dev-h" className={h2Class}>
          Dni z odchyleniem
        </h2>
        {deviating.length === 0 ? (
          <EmptyNote>Brak odchyleń w zamkniętych dniach tego tygodnia.</EmptyNote>
        ) : (
          deviating.map(({ r, c }) => (
            <DeviationRow key={r.dateKey} row={r} kcalDelta={c.kcalDelta} todayKey={todayKey} onOpenDay={onOpenDay} />
          ))
        )}
      </section>
    </div>
  );
}

function DeviationRow({
  row,
  kcalDelta,
  todayKey,
  onOpenDay,
}: {
  row: WeekDayNutritionRow;
  kcalDelta: number | null;
  todayKey: string;
  onOpenDay: (k: string) => void;
}) {
  const detail = deviationDetail(row, todayKey);
  return (
    <button
      type="button"
      onClick={() => onOpenDay(row.dateKey)}
      className="app-card flex min-h-[68px] w-full items-center justify-between gap-3 px-4 py-3 text-left"
    >
      <span className="min-w-0">
        <span className="block text-[16px] font-bold text-white">
          {plDate(row.dateKey, { weekday: "long", day: "numeric", month: "long" }).replace(/^./, (x) => x.toUpperCase())}
        </span>
        <span className="mt-0.5 block text-[14px] text-white/70">
          {kcalDelta != null && kcalDelta > 0 ? "ponad cel" : "poniżej celu"}
          {detail ? ` · ${detail}` : ""}
        </span>
      </span>
      <span className="whitespace-nowrap text-right">
        <span
          className={cn(
            "block text-[18px] font-bold tabular-nums",
            kcalDelta != null && kcalDelta > 0 ? "text-[var(--gym-gold-bright)]" : "text-white",
          )}
        >
          {formatKcalDelta(kcalDelta)} kcal
        </span>
        <span className="block text-[13px] font-semibold text-[var(--gym-gold)]">Dziennik ›</span>
      </span>
    </button>
  );
}

/* ───────────────────────── MIESIĄC / 3 MIES. ───────────────────────── */

function monthSegments(startKey: string, endKey: string): { start: string; end: string; label: string }[] {
  const out: { start: string; end: string; label: string }[] = [];
  let cursor = startKey;
  while (cursor <= endKey) {
    const ym = cursor.slice(0, 7);
    let end = cursor;
    while (end < endKey && addCalendarDays(end, 1).slice(0, 7) === ym) {
      end = addCalendarDays(end, 1);
    }
    const label = plDate(cursor, { month: "long", year: "numeric" }).replace(/^./, (x) => x.toUpperCase());
    out.push({ start: cursor, end, label });
    cursor = addCalendarDays(end, 1);
  }
  return out;
}

function PeriodPanel({
  scope,
  todayKey,
  rows,
  onOpenDay,
}: {
  scope: "month" | "quarter";
  todayKey: string;
  rows: WeekDayNutritionRow[];
  onOpenDay: (k: string) => void;
}) {
  const days = PERIOD_DAYS[scope];
  const startKey = periodStartKey(todayKey, days);
  const windowRows = useMemo(() => rowsInRange(rows, startKey, todayKey), [rows, startKey, todayKey]);
  const summary = useMemo(() => summarizePeriod(windowRows, todayKey), [windowRows, todayKey]);
  const [filter, setFilter] = useState<MacroFilter>("all");
  const [limit, setLimit] = useState(10);

  const cells = useMemo(
    () => (scope === "month" ? buildPeriodCells(windowRows, startKey, todayKey, todayKey) : []),
    [scope, windowRows, startKey, todayKey],
  );

  const deviating = useMemo(() => {
    return windowRows
      .filter((r) => r.dateKey < todayKey && r.entryCount > 0)
      .map((r) => ({
        r,
        c: classifyPeriodDay(r, r.dateKey, todayKey),
        card: buildDayCardViewModel(r, todayKey),
      }))
      .filter((x) => x.card.deviations.length > 0)
      .reverse();
  }, [windowRows, todayKey]);

  const counts = useMemo(() => {
    const out: Record<MacroFilter, number> = { all: 0, calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (const d of deviating) {
      out.all += d.card.deviations.length;
      for (const dev of d.card.deviations) out[dev.key] += 1;
    }
    return out;
  }, [deviating]);

  const shown = filter === "all" ? deviating : deviating.filter((d) => d.card.deviations.some((x) => x.key === filter));

  const weekBars = useMemo(() => {
    if (scope !== "quarter") return [];
    const byWeek = new Map<string, WeekDayNutritionRow[]>();
    for (const r of windowRows) {
      const monday = addCalendarDays(r.dateKey, -((new Date(`${r.dateKey}T12:00:00`).getDay() + 6) % 7));
      byWeek.set(monday, [...(byWeek.get(monday) ?? []), r]);
    }
    return [...byWeek.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([monday, rs]) => {
        const closed = rs.filter((r) => r.dateKey < todayKey && r.entryCount > 0 && r.caloriesGoal);
        const goal = closed.reduce((n, r) => n + (r.caloriesGoal ?? 0), 0);
        const eaten = closed.reduce((n, r) => n + r.caloriesConsumed, 0);
        const pct = goal > 0 ? Math.round((eaten / goal) * 100) : null;
        return { monday, pct };
      });
  }, [scope, windowRows, todayKey]);

  const months = useMemo(
    () =>
      scope === "quarter"
        ? monthSegments(startKey, todayKey).map((m) => {
            const mrows = rowsInRange(rows, m.start, m.end);
            const s = summarizePeriod(mrows, todayKey);
            return {
              ...m,
              cells: buildPeriodCells(mrows, m.start, m.end, todayKey),
              avg: s.daysCounted > 0 && s.kcal.avgDelta != null ? Math.round(s.kcal.avgDelta) : null,
            };
          })
        : [],
    [scope, rows, startKey, todayKey],
  );

  const rangeLabel = `${plDate(startKey, { day: "numeric", month: "long" })} – ${plDate(todayKey, { day: "numeric", month: "long", year: "numeric" })}`;

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-[16px] font-bold text-white">
          {scope === "month" ? "Ostatnie 30 dni" : "Ostatnie 3 miesiące"}
        </p>
        <p className="text-[13px] text-white/65">{rangeLabel}</p>
      </div>

      <SummaryCard summary={summary} intro="Średnie odchylenie od celu" />

      {summary.daysCounted > 0 ? (
        <section className="space-y-2.5" aria-labelledby="stats-per-macro-h">
          <h2 id="stats-per-macro-h" className={h2Class}>
            Średnio wg makro
          </h2>
          <MacroAverageCards summary={summary} />
        </section>
      ) : null}

      {scope === "quarter" && weekBars.length > 0 ? (
        <section className="space-y-2.5" aria-labelledby="stats-trend-h">
          <h2 id="stats-trend-h" className={h2Class}>
            Trend tygodni (% celu kcal)
          </h2>
          <div className="app-card px-3 pb-3 pt-4">
            <div className="relative flex h-[150px] items-end gap-1.5">
              <div
                className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-white/60"
                style={{ bottom: 115 }}
                aria-hidden
              />
              {weekBars.map((b) => {
                const pct = b.pct;
                const h = pct == null ? 6 : Math.max(6, Math.round(Math.min(130, pct) / 130 * 150));
                const tone =
                  pct == null
                    ? "bg-[var(--gym-iron)]"
                    : pct > 105
                      ? "bg-[var(--gym-gold)]"
                      : pct < 95
                        ? "bg-white/40"
                        : "bg-[var(--gym-success)]";
                return (
                  <div
                    key={b.monday}
                    className="flex h-[150px] flex-1 items-end"
                    role="img"
                    aria-label={`Tydzień od ${plDate(b.monday, { day: "numeric", month: "long" })}: ${pct == null ? "brak danych" : `${pct}% celu`}`}
                  >
                    <span className={cn("block w-full rounded-t", tone)} style={{ height: h }} />
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[12px] text-white/65">
              Przerywana linia = 100% celu. Złoto = ponad cel, szary = poniżej, zielony = w normie.
            </p>
          </div>
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="stats-cal-h">
        <h2 id="stats-cal-h" className={h2Class}>
          {scope === "month" ? "Kalendarz odchyleń" : "Mapa dni"}
        </h2>
        <CalendarLegend />
        {scope === "month" ? (
          <>
            <WeekdayHeader />
            <CalendarGrid cells={cells} size="lg" onPick={onOpenDay} />
          </>
        ) : (
          months.map((m) => (
            <div key={m.start} className="app-card space-y-2 p-3">
              <div className="flex items-baseline justify-between">
                <p className="text-[14px] font-bold text-white">{m.label}</p>
                <p className="text-[12px] text-white/65">
                  {m.avg == null ? "brak danych" : `śr. ${formatKcalDelta(m.avg)} kcal / dzień`}
                </p>
              </div>
              <CalendarGrid cells={m.cells} size="sm" onPick={onOpenDay} />
            </div>
          ))
        )}
        <p className="text-[13px] text-white/65">Dotknij dnia, aby zobaczyć pełny dziennik żywienia.</p>
      </section>

      <section className="space-y-2.5" aria-labelledby="stats-dev-h">
        <h2 id="stats-dev-h" className={h2Class}>
          Dni z odchyleniem
        </h2>
        {deviating.length === 0 ? (
          <EmptyNote>Brak odchyleń w zamkniętych dniach tego okresu.</EmptyNote>
        ) : (
          <>
            <MacroFilterChips value={filter} counts={counts} onChange={(f) => { setFilter(f); setLimit(10); }} />
            {shown.slice(0, limit).map(({ r, c }) => (
              <DeviationRow key={r.dateKey} row={r} kcalDelta={c.kcalDelta} todayKey={todayKey} onOpenDay={onOpenDay} />
            ))}
            {shown.length > limit ? (
              <button
                type="button"
                onClick={() => setLimit((n) => n + 10)}
                className="min-h-11 w-full rounded-2xl border border-[var(--gym-border-gold)] text-[14px] font-semibold text-[var(--gym-gold)]"
              >
                Pokaż więcej ({shown.length - limit})
              </button>
            ) : null}
            {shown.length === 0 ? <EmptyNote>Brak dni z odchyleniem dla tego filtra.</EmptyNote> : null}
          </>
        )}
      </section>
    </div>
  );
}

/* ───────────────────────── POWŁOKA ───────────────────────── */

export function NutritionStatsView({
  todayKey,
  weeks: initialWeeks,
  initialTab,
}: {
  todayKey: string;
  /** Najnowszy pierwszy; co najmniej 14 tygodni (pokrywa 90 dni). Starsze doładowywane. */
  weeks: PreviousWeekNutritionSheetWeek[];
  initialTab: StatsTab;
}) {
  const [tab, setTab] = useState<StatsTab>(initialTab);
  const [weeks, setWeeks] = useState(initialWeeks);
  const [viewIndex, setViewIndex] = useState(0);
  const [diaryKey, setDiaryKey] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (done || loadingRef.current || tab !== "week") return;
    if (viewIndex < weeks.length - 4) return;
    loadingRef.current = true;
    void loadMoreNutritionWeeks(weeks.length)
      .then((res) => {
        if (res.weeks.length) setWeeks((prev) => [...prev, ...res.weeks]);
        if (res.done || res.weeks.length === 0) setDone(true);
      })
      .catch(() => setDone(true))
      .finally(() => {
        loadingRef.current = false;
      });
  }, [viewIndex, weeks.length, done, tab]);

  const rows = useMemo(() => flattenWeekRows(weeks), [weeks]);
  const minKey = rows[0]?.dateKey ?? todayKey;

  if (diaryKey) {
    return (
      <NutritionDayDiary
        dateKey={diaryKey}
        row={rows.find((r) => r.dateKey === diaryKey)}
        todayKey={todayKey}
        minKey={minKey}
        onClose={() => setDiaryKey(null)}
        onNavigate={setDiaryKey}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-5 px-4 pb-10 sm:px-5">
      <div className="flex items-center gap-2.5">
        <Link
          href="/meal-suggestions"
          aria-label="Wróć do diety"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--gym-border-gold)] bg-black/25 text-white/90"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
            Makro
          </p>
          <h1 className="font-heading text-[24px] font-semibold leading-tight text-white">Bilans</h1>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Zakres statystyk"
        className="grid grid-cols-4 gap-1 rounded-[14px] border border-[var(--gym-border-gold)] bg-[var(--gym-surface-sunken)] p-1"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "h-11 rounded-[10px] text-[14px] font-semibold transition",
              tab === t.id ? "bg-[var(--gym-gold)] font-bold text-[var(--gym-on-gold)]" : "text-white/70",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="space-y-5">
        {tab === "today" ? (
          <TodayPanel todayKey={todayKey} rows={rows} onOpenDay={setDiaryKey} />
        ) : tab === "week" ? (
          <WeekPanel
            todayKey={todayKey}
            weeks={weeks}
            viewIndex={viewIndex}
            setViewIndex={setViewIndex}
            onOpenDay={setDiaryKey}
          />
        ) : (
          <PeriodPanel scope={tab} todayKey={todayKey} rows={rows} onOpenDay={setDiaryKey} />
        )}
      </div>
    </div>
  );
}
