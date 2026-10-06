"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Beef,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Flame,
  Wheat,
} from "lucide-react";
import type { PreviousWeekNutritionSheetWeek } from "@/lib/nutrition-dashboard";
import {
  adherenceDeltaPp,
  adherencePct,
  avgDayAdherencePct,
  avgWeeksAdherencePct,
  dayVsWeekAverageDelta,
  formatSignedPp,
  rollupWeekThroughIndex,
  weekDayIndexThroughToday,
  type MacroKey,
  type MacroTotals,
  type WeekMacroRollup,
} from "@/lib/nutrition-week-stats";
import type { WeekDayNutritionRow } from "@/lib/week-nutrition-rows";
import { cn } from "@/lib/utils";

type DayStatus = "on_track" | "under" | "over" | "empty" | "future";

function dayStatus(row: WeekDayNutritionRow, todayKey: string): DayStatus {
  if (row.dateKey > todayKey) return "future";
  const hasGoal = row.caloriesGoal != null && row.caloriesGoal > 0;
  const hasFood = row.caloriesConsumed > 0;
  if (!hasFood && !hasGoal) return "empty";
  if (!hasFood) return "empty";
  if (!hasGoal) return "on_track";
  const pct = row.caloriesConsumed / row.caloriesGoal!;
  if (pct > 1.1) return "over";
  if (pct < 0.85) return "under";
  return "on_track";
}

function statusLabel(s: DayStatus): string {
  switch (s) {
    case "on_track":
      return "W normie";
    case "under":
      return "Poniżej";
    case "over":
      return "Nadwyżka";
    case "future":
      return "Przed nami";
    default:
      return "Brak wpisów";
  }
}

function statusTone(s: DayStatus): string {
  switch (s) {
    case "on_track":
      return "bg-emerald-400/20 text-emerald-300 border-emerald-400/35";
    case "under":
      return "bg-sky-400/20 text-sky-300 border-sky-400/35";
    case "over":
      return "bg-rose-400/20 text-rose-300 border-rose-400/35";
    case "future":
      return "bg-white/[0.04] text-white/40 border-white/10";
    default:
      return "bg-white/[0.04] text-white/45 border-white/12";
  }
}

function weekdayShort(dateKey: string): string {
  try {
    return new Intl.DateTimeFormat("pl-PL", { weekday: "short" })
      .format(new Date(`${dateKey}T12:00:00`))
      .replace(".", "");
  } catch {
    return dateKey.slice(8);
  }
}

function dayNum(dateKey: string): string {
  return dateKey.slice(8).replace(/^0/, "");
}

function dayMacro(
  row: WeekDayNutritionRow,
  key: MacroKey,
): { consumed: number; goal: number | null } {
  switch (key) {
    case "calories":
      return { consumed: row.caloriesConsumed, goal: row.caloriesGoal };
    case "protein":
      return { consumed: row.proteinConsumed, goal: row.proteinGoal };
    case "carbs":
      return { consumed: row.carbsConsumed, goal: row.carbsGoal };
    case "fat":
      return { consumed: row.fatConsumed, goal: row.fatGoal };
  }
}

function macroFromRollup(r: WeekMacroRollup, key: MacroKey): MacroTotals {
  return r[key];
}

function deltaTone(delta: number | null, invert = false): string {
  if (delta == null || Math.round(delta) === 0) return "text-white/45";
  const better = invert ? delta < 0 : delta > 0;
  // Dla kcal/tłuszcz/węgle nadwyżka (plus) = gorzej (róż); dla białka plus = lepiej
  if (invert) {
    return better ? "text-emerald-300" : "text-rose-300";
  }
  return better ? "text-emerald-300" : "text-rose-300";
}

function MacroBar({
  label,
  icon,
  consumed,
  goal,
  unit,
  barClass,
  compareLabel,
}: {
  label: string;
  icon: ReactNode;
  consumed: number;
  goal: number | null;
  unit: string;
  barClass: string;
  compareLabel?: ReactNode;
}) {
  const pct = adherencePct(consumed, goal);
  const width = pct == null ? 0 : Math.min(100, pct);
  const over = pct != null && pct > 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-medium text-white/85">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-[var(--gym-gold)]">
            {icon}
          </span>
          {label}
        </span>
        <span className="font-metric text-[13px] tabular-nums text-white/70">
          {Math.round(consumed)}
          {goal != null ? ` / ${Math.round(goal)}` : ""} {unit}
          {pct != null ? (
            <span
              className={cn(
                "ml-2 text-[12px] font-semibold",
                over ? "text-rose-300" : "text-white/45",
              )}
            >
              {pct}%
            </span>
          ) : null}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className={cn("h-full rounded-full", barClass)}
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.65, ease: "easeOut" }}
        />
      </div>
      {compareLabel ? (
        <p className="text-[11px] tabular-nums text-white/40">{compareLabel}</p>
      ) : null}
    </div>
  );
}

function remainingHint(
  consumed: number,
  goal: number | null,
  unit: string,
): string | null {
  if (goal == null || !(goal > 0)) return null;
  const diff = Math.round(goal - consumed);
  if (diff > 0) return `zostało ${diff} ${unit}`;
  if (diff < 0) return `+${Math.abs(diff)} ${unit} ponad cel`;
  return "cel osiągnięty";
}

function DayCompareBars({
  dayRows,
  selectedKey,
  todayKey,
  onSelect,
}: {
  dayRows: WeekDayNutritionRow[];
  selectedKey: string;
  todayKey: string;
  onSelect: (key: string) => void;
}) {
  const maxPct = useMemo(() => {
    let m = 100;
    for (const row of dayRows) {
      const p = adherencePct(row.caloriesConsumed, row.caloriesGoal);
      if (p != null) m = Math.max(m, p);
    }
    return Math.max(100, Math.min(160, m));
  }, [dayRows]);

  const weekAvg = avgDayAdherencePct(dayRows, todayKey, "calories");

  return (
    <section className="app-card space-y-3 p-4">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
            Porównanie dni
          </p>
          <p className="mt-1 text-[13px] text-white/50">
            % celu kalorii · średnia z dni z celem
          </p>
        </div>
        {weekAvg != null ? (
          <p className="text-right text-[12px] tabular-nums text-white/45">
            średnia {Math.round(weekAvg)}%
          </p>
        ) : null}
      </div>

      <div className="relative flex h-36 items-end gap-1.5 pt-2">
        {weekAvg != null ? (
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-white/25"
            style={{ bottom: `${(weekAvg / maxPct) * 100}%` }}
            aria-hidden
          />
        ) : null}
        {dayRows.map((row) => {
          const st = dayStatus(row, todayKey);
          const p = adherencePct(row.caloriesConsumed, row.caloriesGoal);
          const height =
            p == null || row.caloriesConsumed <= 0
              ? 4
              : Math.max(8, (p / maxPct) * 100);
          const active = row.dateKey === selectedKey;
          const vsAvg = adherenceDeltaPp(p, weekAvg);

          return (
            <button
              key={row.dateKey}
              type="button"
              onClick={() => onSelect(row.dateKey)}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1.5",
                st === "future" && "opacity-40",
              )}
              aria-pressed={active}
              aria-label={`${weekdayShort(row.dateKey)}: ${p != null ? `${p}% celu` : "brak"}`}
            >
              <span
                className={cn(
                  "text-[10px] font-semibold tabular-nums",
                  active ? "text-[var(--gym-gold)]" : "text-white/45",
                )}
              >
                {p != null && row.caloriesConsumed > 0 ? `${p}%` : "—"}
              </span>
              <div className="relative flex h-24 w-full items-end justify-center">
                <motion.div
                  className={cn(
                    "w-full max-w-[28px] rounded-t-md",
                    active
                      ? "bg-[var(--gym-gold)]"
                      : st === "over"
                        ? "bg-rose-400/80"
                        : st === "under"
                          ? "bg-sky-400/70"
                          : st === "on_track"
                            ? "bg-emerald-400/75"
                            : "bg-white/15",
                  )}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-[0.06em]",
                  active ? "text-white" : "text-white/40",
                )}
              >
                {weekdayShort(row.dateKey)}
              </span>
              {active && vsAvg != null ? (
                <span
                  className={cn(
                    "text-[10px] font-semibold tabular-nums",
                    deltaTone(vsAvg, true),
                  )}
                >
                  {formatSignedPp(vsAvg)} śr.
                </span>
              ) : (
                <span className="h-3.5" />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DayDetailCard({
  row,
  status,
  dayRows,
  todayKey,
}: {
  row: WeekDayNutritionRow;
  status: DayStatus;
  dayRows: WeekDayNutritionRow[];
  todayKey: string;
}) {
  const kcalHint = remainingHint(row.caloriesConsumed, row.caloriesGoal, "kcal");

  const compares = useMemo(() => {
    const keys: { key: MacroKey; unit: string; invert: boolean }[] = [
      { key: "calories", unit: "kcal", invert: true },
      { key: "protein", unit: "g", invert: false },
      { key: "carbs", unit: "g", invert: true },
      { key: "fat", unit: "g", invert: true },
    ];
    return keys.map(({ key, unit, invert }) => {
      const m = dayMacro(row, key);
      const dayPct = adherencePct(m.consumed, m.goal);
      const delta = dayVsWeekAverageDelta(row, dayRows, todayKey, key);
      return { key, unit, invert, dayPct, delta };
    });
  }, [row, dayRows, todayKey]);

  const labeledDays = dayRows.filter(
    (d) => d.dateKey <= todayKey && d.caloriesConsumed > 0,
  );
  const higherKcal = labeledDays.filter(
    (d) => d.caloriesConsumed > row.caloriesConsumed,
  ).length;
  const lowerKcal = labeledDays.filter(
    (d) =>
      d.dateKey !== row.dateKey && d.caloriesConsumed < row.caloriesConsumed,
  ).length;

  return (
    <section className="app-card space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold leading-snug text-white">
            {row.headline}
          </h2>
          {kcalHint ? (
            <p className="mt-1 text-[13px] text-white/50">{kcalHint}</p>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            statusTone(status),
          )}
        >
          {statusLabel(status)}
        </span>
      </div>

      {labeledDays.length > 1 && row.caloriesConsumed > 0 ? (
        <p className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-[12px] leading-snug text-white/55">
          W tym tygodniu{" "}
          {higherKcal === 0
            ? "najwyższe kcal spośród dni z wpisami"
            : lowerKcal === 0
              ? "najniższe kcal spośród dni z wpisami"
              : `więcej kcal niż ${lowerKcal} ${lowerKcal === 1 ? "dzień" : "dni"}, mniej niż ${higherKcal}`}
          .
        </p>
      ) : null}

      <div className="space-y-3.5">
        {(
          [
            ["Kalorie", "calories", <Flame className="h-3.5 w-3.5" />, "kcal", "bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400"],
            ["Białko", "protein", <Beef className="h-3.5 w-3.5" />, "g", "bg-gradient-to-r from-sky-400 to-cyan-300"],
            ["Węgle", "carbs", <Wheat className="h-3.5 w-3.5" />, "g", "bg-gradient-to-r from-violet-400 to-fuchsia-300"],
            ["Tłuszcz", "fat", <Droplets className="h-3.5 w-3.5" />, "g", "bg-gradient-to-r from-amber-300 to-yellow-200"],
          ] as const
        ).map(([label, key, icon, unit, barClass]) => {
          const m = dayMacro(row, key);
          const c = compares.find((x) => x.key === key);
          const d = c?.delta ?? null;
          const compareLabel =
            d != null
              ? `${formatSignedPp(d)} vs średnia dni tygodnia`
              : null;
          return (
            <MacroBar
              key={key}
              label={label}
              icon={icon}
              consumed={m.consumed}
              goal={m.goal}
              unit={unit}
              barClass={barClass}
              compareLabel={
                compareLabel ? (
                  <span className={deltaTone(d, c?.invert)}>
                    {compareLabel}
                  </span>
                ) : null
              }
            />
          );
        })}
      </div>

      <Link
        href={`/meal-suggestions?tab=diary`}
        className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--gym-gold)]"
      >
        Otwórz dziennik
        <ChevronRight className="h-4 w-4" />
      </Link>
    </section>
  );
}

function WeekNavButton({
  direction,
  disabled,
  label,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/80 transition",
        disabled
          ? "cursor-not-allowed opacity-30"
          : "hover:bg-white/[0.08] hover:text-white",
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

function WeekVsWeeksCard({
  weekToDateRollup,
  compareWeek,
  compareRollup,
  compareIndex,
  maxCompareIndex,
  minCompareIndex,
  onCompareIndexChange,
  throughDayIndex,
  avgSourceWeeks,
  periodHint,
}: {
  weekToDateRollup: WeekMacroRollup;
  compareWeek: PreviousWeekNutritionSheetWeek | null;
  compareRollup: WeekMacroRollup | null;
  compareIndex: number;
  maxCompareIndex: number;
  minCompareIndex: number;
  onCompareIndexChange: (index: number) => void;
  throughDayIndex: number;
  avgSourceWeeks: PreviousWeekNutritionSheetWeek[];
  periodHint: string;
}) {
  const thisPct = adherencePct(
    weekToDateRollup.calories.consumed,
    weekToDateRollup.calories.goal,
  );
  const comparePct = compareRollup
    ? adherencePct(
        compareRollup.calories.consumed,
        compareRollup.calories.goal,
      )
    : null;
  const vsCompare = adherenceDeltaPp(thisPct, comparePct);

  const avgPrev = avgWeeksAdherencePct(
    avgSourceWeeks.map((w) => w.dayRows),
    throughDayIndex,
    "calories",
  );
  const vsAvg = adherenceDeltaPp(thisPct, avgPrev);
  const avgWeekCount = avgSourceWeeks.filter((w) => {
    const t = rollupWeekThroughIndex(w.dayRows, throughDayIndex).calories;
    return adherencePct(t.consumed, t.goal) != null;
  }).length;

  const macros: {
    key: MacroKey;
    label: string;
    invert: boolean;
  }[] = [
    { key: "calories", label: "Kcal", invert: true },
    { key: "protein", label: "Białko", invert: false },
    { key: "carbs", label: "Węgle", invert: true },
    { key: "fat", label: "Tłuszcz", invert: true },
  ];

  if (!compareWeek && avgSourceWeeks.length === 0) return null;

  return (
    <section className="app-card space-y-3.5 p-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
          Porównanie tygodni
        </p>
        <p className="mt-1 text-[13px] text-white/50">{periodHint}</p>
      </div>

      {compareWeek ? (
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/25 px-2 py-2">
          <WeekNavButton
            direction="prev"
            disabled={compareIndex >= maxCompareIndex}
            label="Starszy tydzień do porównania"
            onClick={() =>
              onCompareIndexChange(Math.min(maxCompareIndex, compareIndex + 1))
            }
          />
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">
              Porównaj z
            </p>
            <p className="truncate text-[13px] font-semibold text-white">
              {compareWeek.weekLabel}
            </p>
          </div>
          <WeekNavButton
            direction="next"
            disabled={compareIndex <= minCompareIndex}
            label="Nowszy tydzień do porównania"
            onClick={() =>
              onCompareIndexChange(Math.max(minCompareIndex, compareIndex - 1))
            }
          />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">
            Vs wybrany
          </p>
          <p
            className={cn(
              "mt-1 font-display text-[26px] leading-none tabular-nums",
              vsCompare != null ? deltaTone(vsCompare, true) : "text-white/35",
            )}
          >
            {formatSignedPp(vsCompare) ?? "—"}
          </p>
          <p className="mt-1.5 text-[11px] tabular-nums text-white/40">
            ten {thisPct != null ? `${thisPct}%` : "—"} · wybr.{" "}
            {comparePct != null ? `${comparePct}%` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">
            Vs średnia {avgWeekCount || "—"} tyg.
          </p>
          <p
            className={cn(
              "mt-1 font-display text-[26px] leading-none tabular-nums",
              vsAvg != null ? deltaTone(vsAvg, true) : "text-white/35",
            )}
          >
            {formatSignedPp(vsAvg) ?? "—"}
          </p>
          <p className="mt-1.5 text-[11px] tabular-nums text-white/40">
            średnia {avgPrev != null ? `${avgPrev}%` : "—"}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/[0.08]">
        <div className="grid grid-cols-[1fr_repeat(3,minmax(0,1fr))] gap-px bg-white/[0.06] text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">
          <div className="bg-[#121212] px-2.5 py-2">Makro</div>
          <div className="bg-[#121212] px-2 py-2 text-center">Ten</div>
          <div className="bg-[#121212] px-2 py-2 text-center">Wybr.</div>
          <div className="bg-[#121212] px-2 py-2 text-center">Δ pp</div>
        </div>
        {macros.map(({ key, label, invert }) => {
          const cur = macroFromRollup(weekToDateRollup, key);
          const prev = compareRollup
            ? macroFromRollup(compareRollup, key)
            : null;
          const curP = adherencePct(cur.consumed, cur.goal);
          const prevP = prev ? adherencePct(prev.consumed, prev.goal) : null;
          const d = adherenceDeltaPp(curP, prevP);
          return (
            <div
              key={key}
              className="grid grid-cols-[1fr_repeat(3,minmax(0,1fr))] gap-px bg-white/[0.06] text-[12px] tabular-nums"
            >
              <div className="bg-[#0e0e0e] px-2.5 py-2.5 font-medium text-white/80">
                {label}
              </div>
              <div className="bg-[#0e0e0e] px-2 py-2.5 text-center text-white/75">
                {curP != null ? `${curP}%` : "—"}
              </div>
              <div className="bg-[#0e0e0e] px-2 py-2.5 text-center text-white/45">
                {prevP != null ? `${prevP}%` : "—"}
              </div>
              <div
                className={cn(
                  "bg-[#0e0e0e] px-2 py-2.5 text-center font-semibold",
                  d != null ? deltaTone(d, invert) : "text-white/30",
                )}
              >
                {formatSignedPp(d) ?? "—"}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function macroCompareLabel(
  current: WeekMacroRollup,
  previous: WeekMacroRollup | null,
  key: MacroKey,
  compareWeekLabel: string | null,
): string | null {
  const cur = macroFromRollup(current, key);
  const prev = previous ? macroFromRollup(previous, key) : null;
  const d = adherenceDeltaPp(
    adherencePct(cur.consumed, cur.goal),
    prev ? adherencePct(prev.consumed, prev.goal) : null,
  );
  if (d == null) return null;
  const target = compareWeekLabel
    ? `vs ${compareWeekLabel}`
    : "vs wybrany tydzień";
  return `${formatSignedPp(d)} ${target}`;
}

function defaultSelectedDayKey(
  dayRows: WeekDayNutritionRow[],
  todayKey: string,
): string {
  if (dayRows.some((r) => r.dateKey === todayKey)) return todayKey;
  for (let i = dayRows.length - 1; i >= 0; i--) {
    if (dayRows[i]!.dateKey <= todayKey) return dayRows[i]!.dateKey;
  }
  return dayRows[0]?.dateKey ?? todayKey;
}

export function NutritionWeekView({
  todayKey,
  weeks,
}: {
  todayKey: string;
  /** Najnowszy pierwszy: [bieżący, -1 tyg., … do ~roku wstecz]. */
  weeks: PreviousWeekNutritionSheetWeek[];
}) {
  const [viewIndex, setViewIndex] = useState(0);
  const [compareIndex, setCompareIndex] = useState(
    weeks.length > 1 ? 1 : 0,
  );
  const [selectedKey, setSelectedKey] = useState(() =>
    defaultSelectedDayKey(weeks[0]?.dayRows ?? [], todayKey),
  );

  const maxViewIndex = Math.max(0, weeks.length - 1);
  const minCompareIndex = Math.min(viewIndex + 1, maxViewIndex);
  const maxCompareIndex = maxViewIndex;

  const viewWeek = weeks[viewIndex] ?? weeks[0] ?? null;
  const dayRows = viewWeek?.dayRows ?? [];

  useEffect(() => {
    if (!viewWeek) return;
    setSelectedKey(defaultSelectedDayKey(viewWeek.dayRows, todayKey));
    setCompareIndex(Math.min(viewIndex + 1, maxViewIndex));
  }, [viewIndex, viewWeek, todayKey, maxViewIndex]);

  const isCurrentWeek = Boolean(
    viewWeek &&
      viewWeek.weekStart <= todayKey &&
      todayKey <= viewWeek.weekEnd,
  );

  const throughDayIndex = useMemo(() => {
    if (!viewWeek) return 0;
    if (isCurrentWeek) {
      return weekDayIndexThroughToday(viewWeek.dayRows, todayKey);
    }
    return Math.max(0, viewWeek.dayRows.length - 1);
  }, [viewWeek, isCurrentWeek, todayKey]);

  const weekToDateRollup = useMemo(
    () => rollupWeekThroughIndex(dayRows, throughDayIndex),
    [dayRows, throughDayIndex],
  );

  const compareWeek =
    compareIndex > viewIndex && compareIndex < weeks.length
      ? (weeks[compareIndex] ?? null)
      : null;

  const compareRollup = useMemo(() => {
    if (!compareWeek) return null;
    return rollupWeekThroughIndex(compareWeek.dayRows, throughDayIndex);
  }, [compareWeek, throughDayIndex]);

  const avgSourceWeeks = useMemo(
    () => weeks.slice(viewIndex + 1, viewIndex + 5),
    [weeks, viewIndex],
  );

  const periodHint = isCurrentWeek
    ? "Różnica realizacji celu (pp) · pn→dziś vs ten sam okres"
    : "Różnica realizacji celu (pp) · cały tydzień vs ten sam okres";

  const selected = useMemo(
    () => dayRows.find((r) => r.dateKey === selectedKey) ?? dayRows[0] ?? null,
    [dayRows, selectedKey],
  );

  const selectedStatus = selected
    ? dayStatus(selected, todayKey)
    : ("empty" as DayStatus);

  const kcalPct = adherencePct(
    weekToDateRollup.calories.consumed,
    weekToDateRollup.calories.goal,
  );

  const comparePct = compareRollup
    ? adherencePct(
        compareRollup.calories.consumed,
        compareRollup.calories.goal,
      )
    : null;
  const vsCompareWeek = adherenceDeltaPp(kcalPct, comparePct);

  if (!viewWeek) {
    return (
      <div className="mx-auto w-full max-w-lg pb-10 text-[14px] text-white/55">
        Brak danych tygodnia.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 pb-10">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]"
          aria-label="Wróć na Pulpit"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
            Makro tydzień
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <WeekNavButton
              direction="prev"
              disabled={viewIndex >= maxViewIndex}
              label="Poprzedni tydzień"
              onClick={() => setViewIndex((i) => Math.min(maxViewIndex, i + 1))}
            />
            <div className="min-w-0 flex-1 text-center">
              <h1 className="truncate text-[18px] font-semibold text-white sm:text-[20px]">
                {viewWeek.weekLabel}
              </h1>
              <p className="text-[11px] text-white/40">
                {isCurrentWeek
                  ? "Bieżący tydzień"
                  : `Historia · ${viewIndex} tyg. wstecz`}
              </p>
            </div>
            <WeekNavButton
              direction="next"
              disabled={viewIndex <= 0}
              label="Nowszy tydzień"
              onClick={() => setViewIndex((i) => Math.max(0, i - 1))}
            />
          </div>
        </div>
      </div>

      <section className="app-card relative overflow-hidden p-4">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "linear-gradient(165deg, rgba(235,196,74,0.14) 0%, transparent 55%)",
          }}
          aria-hidden
        />
        <div className="relative">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                Realizacja kcal
              </p>
              <p className="mt-1 font-display text-[40px] leading-none text-white">
                {kcalPct != null ? `${kcalPct}%` : "—"}
              </p>
              {vsCompareWeek != null && compareWeek ? (
                <p
                  className={cn(
                    "mt-1.5 text-[12px] font-semibold tabular-nums",
                    deltaTone(vsCompareWeek, true),
                  )}
                >
                  {formatSignedPp(vsCompareWeek)} vs {compareWeek.weekLabel}
                </p>
              ) : null}
            </div>
            <p className="pb-1 text-right text-[12px] tabular-nums text-white/50">
              {Math.round(weekToDateRollup.calories.consumed)}
              {weekToDateRollup.calories.goal != null
                ? ` / ${Math.round(weekToDateRollup.calories.goal)} kcal`
                : " kcal"}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-1">
            {dayRows.map((row) => {
              const st = dayStatus(row, todayKey);
              const active = row.dateKey === selectedKey;
              const isToday = row.dateKey === todayKey;
              const dayPct = adherencePct(
                row.caloriesConsumed,
                row.caloriesGoal,
              );
              return (
                <button
                  key={row.dateKey}
                  type="button"
                  onClick={() => setSelectedKey(row.dateKey)}
                  className={cn(
                    "flex flex-col items-center rounded-2xl border px-0.5 py-2 transition",
                    active
                      ? "border-[var(--gym-gold)]/55 bg-[var(--gym-gold)]/12"
                      : "border-transparent bg-black/20 hover:bg-white/[0.04]",
                  )}
                  aria-pressed={active}
                  aria-label={`${row.headline}, ${statusLabel(st)}`}
                >
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-[0.08em]",
                      isToday ? "text-[var(--gym-gold)]" : "text-white/45",
                    )}
                  >
                    {weekdayShort(row.dateKey)}
                  </span>
                  <span
                    className={cn(
                      "mt-1.5 flex h-9 w-9 items-center justify-center rounded-full border-2 text-[13px] font-semibold tabular-nums",
                      st === "on_track" &&
                        "border-emerald-400 bg-emerald-400/20 text-emerald-100",
                      st === "under" &&
                        "border-sky-400 bg-sky-400/20 text-sky-100",
                      st === "over" &&
                        "border-rose-400 bg-rose-400/25 text-rose-100",
                      (st === "empty" || st === "future") &&
                        "border-white/15 bg-white/[0.04] text-white/55",
                      isToday &&
                        st !== "over" &&
                        st !== "on_track" &&
                        st !== "under"
                        ? "border-[var(--gym-gold)]"
                        : null,
                    )}
                  >
                    {dayNum(row.dateKey)}
                  </span>
                  <span
                    className={cn(
                      "mt-1 text-[9px] font-semibold tabular-nums",
                      dayPct != null && row.caloriesConsumed > 0
                        ? "text-white/55"
                        : "text-white/25",
                    )}
                  >
                    {dayPct != null && row.caloriesConsumed > 0
                      ? `${dayPct}%`
                      : "—"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-white/40">
            Zieleń — w normie · niebieski — poniżej · czerwony — nadwyżka
          </p>
        </div>
      </section>

      <DayCompareBars
        dayRows={dayRows}
        selectedKey={selectedKey}
        todayKey={todayKey}
        onSelect={setSelectedKey}
      />

      <WeekVsWeeksCard
        weekToDateRollup={weekToDateRollup}
        compareWeek={compareWeek}
        compareRollup={compareRollup}
        compareIndex={compareIndex}
        maxCompareIndex={maxCompareIndex}
        minCompareIndex={minCompareIndex}
        onCompareIndexChange={setCompareIndex}
        throughDayIndex={throughDayIndex}
        avgSourceWeeks={avgSourceWeeks}
        periodHint={periodHint}
      />

      <section className="app-card space-y-4 p-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
            Statystyki tygodnia
          </p>
          <p className="mt-1 text-[13px] text-white/50">
            {isCurrentWeek
              ? "Pn→dziś · tylko dni z celem makro"
              : "Cały tydzień · tylko dni z celem makro"}
          </p>
        </div>
        <MacroBar
          label="Kalorie"
          icon={<Flame className="h-3.5 w-3.5" />}
          consumed={weekToDateRollup.calories.consumed}
          goal={weekToDateRollup.calories.goal}
          unit="kcal"
          barClass="bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400"
          compareLabel={macroCompareLabel(
            weekToDateRollup,
            compareRollup,
            "calories",
            compareWeek?.weekLabel ?? null,
          )}
        />
        <MacroBar
          label="Białko"
          icon={<Beef className="h-3.5 w-3.5" />}
          consumed={weekToDateRollup.protein.consumed}
          goal={weekToDateRollup.protein.goal}
          unit="g"
          barClass="bg-gradient-to-r from-sky-400 to-cyan-300"
          compareLabel={macroCompareLabel(
            weekToDateRollup,
            compareRollup,
            "protein",
            compareWeek?.weekLabel ?? null,
          )}
        />
        <MacroBar
          label="Węglowodany"
          icon={<Wheat className="h-3.5 w-3.5" />}
          consumed={weekToDateRollup.carbs.consumed}
          goal={weekToDateRollup.carbs.goal}
          unit="g"
          barClass="bg-gradient-to-r from-violet-400 to-fuchsia-300"
          compareLabel={macroCompareLabel(
            weekToDateRollup,
            compareRollup,
            "carbs",
            compareWeek?.weekLabel ?? null,
          )}
        />
        <MacroBar
          label="Tłuszcz"
          icon={<Droplets className="h-3.5 w-3.5" />}
          consumed={weekToDateRollup.fat.consumed}
          goal={weekToDateRollup.fat.goal}
          unit="g"
          barClass="bg-gradient-to-r from-amber-300 to-yellow-200"
          compareLabel={macroCompareLabel(
            weekToDateRollup,
            compareRollup,
            "fat",
            compareWeek?.weekLabel ?? null,
          )}
        />
      </section>

      {selected ? (
        <DayDetailCard
          row={selected}
          status={selectedStatus}
          dayRows={dayRows}
          todayKey={todayKey}
        />
      ) : null}
    </div>
  );
}
