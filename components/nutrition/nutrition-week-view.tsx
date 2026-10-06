"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Beef,
  ChevronRight,
  Droplets,
  Flame,
  Wheat,
} from "lucide-react";
import type { PreviousWeekNutritionSheetWeek } from "@/lib/nutrition-dashboard";
import type { NutritionWeekRollup } from "@/lib/nutrition-goals";
import type { WeekDayNutritionRow } from "@/lib/week-nutrition-rows";
import { formatPlCalendarRange } from "@/lib/local-date";
import { cn } from "@/lib/utils";

type WeekRollupPick = Pick<
  NutritionWeekRollup,
  | "sumProteinGoal"
  | "sumProteinConsumed"
  | "sumFatGoal"
  | "sumFatConsumed"
  | "sumCarbsGoal"
  | "sumCarbsConsumed"
  | "sumCaloriesGoal"
  | "sumCaloriesConsumed"
>;

type DayStatus = "on_track" | "under" | "over" | "empty" | "future";

type MacroKey = "calories" | "protein" | "carbs" | "fat";

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

function pctOf(consumed: number, goal: number | null): number | null {
  if (goal == null || !(goal > 0)) return null;
  return Math.round((consumed / goal) * 100);
}

function signedPct(delta: number | null): string | null {
  if (delta == null || !Number.isFinite(delta)) return null;
  const r = Math.round(delta);
  if (r === 0) return "0%";
  return r > 0 ? `+${r}%` : `${r}%`;
}

/** Różnica procentowa: a względem b (np. dzień vs średnia). */
function pctVs(a: number | null, b: number | null): number | null {
  if (a == null || b == null || !(b > 0)) return null;
  return ((a - b) / b) * 100;
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

function rollupMacro(
  r: WeekRollupPick,
  key: MacroKey,
): { consumed: number; goal: number | null } {
  switch (key) {
    case "calories":
      return {
        consumed: r.sumCaloriesConsumed,
        goal: r.sumCaloriesGoal > 0 ? r.sumCaloriesGoal : null,
      };
    case "protein":
      return {
        consumed: r.sumProteinConsumed,
        goal: r.sumProteinGoal > 0 ? r.sumProteinGoal : null,
      };
    case "carbs":
      return {
        consumed: r.sumCarbsConsumed,
        goal: r.sumCarbsGoal > 0 ? r.sumCarbsGoal : null,
      };
    case "fat":
      return {
        consumed: r.sumFatConsumed,
        goal: r.sumFatGoal > 0 ? r.sumFatGoal : null,
      };
  }
}

function avgDayPct(
  rows: WeekDayNutritionRow[],
  todayKey: string,
  key: MacroKey,
): number | null {
  const vals: number[] = [];
  for (const row of rows) {
    if (row.dateKey > todayKey) continue;
    const m = dayMacro(row, key);
    if (m.consumed <= 0) continue;
    const p = pctOf(m.consumed, m.goal);
    if (p != null) vals.push(p);
  }
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function avgDayConsumed(
  rows: WeekDayNutritionRow[],
  todayKey: string,
  key: MacroKey,
): number | null {
  const vals: number[] = [];
  for (const row of rows) {
    if (row.dateKey > todayKey) continue;
    const m = dayMacro(row, key);
    if (m.consumed <= 0) continue;
    vals.push(m.consumed);
  }
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
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
  const pct = pctOf(consumed, goal);
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
      const p = pctOf(row.caloriesConsumed, row.caloriesGoal);
      if (p != null) m = Math.max(m, p);
    }
    return Math.max(100, Math.min(160, m));
  }, [dayRows]);

  const weekAvg = avgDayPct(dayRows, todayKey, "calories");

  return (
    <section className="app-card space-y-3 p-4">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
            Porównanie dni
          </p>
          <p className="mt-1 text-[13px] text-white/50">
            % celu kalorii w tym tygodniu
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
          const p = pctOf(row.caloriesConsumed, row.caloriesGoal);
          const height =
            p == null || row.caloriesConsumed <= 0
              ? 4
              : Math.max(8, (p / maxPct) * 100);
          const active = row.dateKey === selectedKey;
          const vsAvg = pctVs(p, weekAvg);

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
                  {signedPct(vsAvg)} śr.
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
      const dayPct = pctOf(m.consumed, m.goal);
      const avgPct = avgDayPct(dayRows, todayKey, key);
      const avgCons = avgDayConsumed(dayRows, todayKey, key);
      const vsPct = pctVs(dayPct, avgPct);
      const vsCons =
        avgCons != null && avgCons > 0
          ? ((m.consumed - avgCons) / avgCons) * 100
          : null;
      const delta = vsPct ?? vsCons;
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
              ? `${signedPct(d)} vs średnia dni tygodnia`
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

function WeekVsWeeksCard({
  weekRollup,
  previousWeeks,
}: {
  weekRollup: WeekRollupPick;
  previousWeeks: PreviousWeekNutritionSheetWeek[];
}) {
  const thisPct = pctOf(
    weekRollup.sumCaloriesConsumed,
    weekRollup.sumCaloriesGoal > 0 ? weekRollup.sumCaloriesGoal : null,
  );
  const last = previousWeeks[0] ?? null;
  const lastPct = last
    ? pctOf(
        last.rollup.sumCaloriesConsumed,
        last.rollup.sumCaloriesGoal > 0 ? last.rollup.sumCaloriesGoal : null,
      )
    : null;
  const vsLast = pctVs(thisPct, lastPct);

  const prevPcts = previousWeeks
    .slice(0, 4)
    .map((w) =>
      pctOf(
        w.rollup.sumCaloriesConsumed,
        w.rollup.sumCaloriesGoal > 0 ? w.rollup.sumCaloriesGoal : null,
      ),
    )
    .filter((p): p is number => p != null);
  const avgPrev =
    prevPcts.length > 0
      ? prevPcts.reduce((s, v) => s + v, 0) / prevPcts.length
      : null;
  const vsAvg = pctVs(thisPct, avgPrev);

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

  if (!last && previousWeeks.length === 0) return null;

  return (
    <section className="app-card space-y-3.5 p-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
          Ten tydzień vs inne
        </p>
        <p className="mt-1 text-[13px] text-white/50">
          Porównanie % realizacji celu
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">
            Vs poprzedni
          </p>
          <p
            className={cn(
              "mt-1 font-display text-[26px] leading-none tabular-nums",
              vsLast != null ? deltaTone(vsLast, true) : "text-white/35",
            )}
          >
            {signedPct(vsLast) ?? "—"}
          </p>
          <p className="mt-1.5 text-[11px] tabular-nums text-white/40">
            ten {thisPct != null ? `${thisPct}%` : "—"} · poprz.{" "}
            {lastPct != null ? `${lastPct}%` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">
            Vs średnia {prevPcts.length || "—"} tyg.
          </p>
          <p
            className={cn(
              "mt-1 font-display text-[26px] leading-none tabular-nums",
              vsAvg != null ? deltaTone(vsAvg, true) : "text-white/35",
            )}
          >
            {signedPct(vsAvg) ?? "—"}
          </p>
          <p className="mt-1.5 text-[11px] tabular-nums text-white/40">
            średnia {avgPrev != null ? `${Math.round(avgPrev)}%` : "—"}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/[0.08]">
        <div className="grid grid-cols-[1fr_repeat(3,minmax(0,1fr))] gap-px bg-white/[0.06] text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">
          <div className="bg-[#121212] px-2.5 py-2">Makro</div>
          <div className="bg-[#121212] px-2 py-2 text-center">Ten</div>
          <div className="bg-[#121212] px-2 py-2 text-center">Poprz.</div>
          <div className="bg-[#121212] px-2 py-2 text-center">Δ%</div>
        </div>
        {macros.map(({ key, label, invert }) => {
          const cur = rollupMacro(weekRollup, key);
          const prev = last ? rollupMacro(last.rollup, key) : null;
          const curP = pctOf(cur.consumed, cur.goal);
          const prevP = prev ? pctOf(prev.consumed, prev.goal) : null;
          const d = pctVs(curP, prevP);
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
                {signedPct(d) ?? "—"}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function NutritionWeekView({
  todayKey,
  weekStart,
  weekEnd,
  dayRows,
  weekRollup,
  previousWeeks,
}: {
  todayKey: string;
  weekStart: string;
  weekEnd: string;
  dayRows: WeekDayNutritionRow[];
  weekRollup: WeekRollupPick;
  previousWeeks: PreviousWeekNutritionSheetWeek[];
}) {
  const [selectedKey, setSelectedKey] = useState(todayKey);

  const selected = useMemo(
    () => dayRows.find((r) => r.dateKey === selectedKey) ?? dayRows[0] ?? null,
    [dayRows, selectedKey],
  );

  const selectedStatus = selected
    ? dayStatus(selected, todayKey)
    : ("empty" as DayStatus);

  const kcalPct = pctOf(
    weekRollup.sumCaloriesConsumed,
    weekRollup.sumCaloriesGoal > 0 ? weekRollup.sumCaloriesGoal : null,
  );

  const lastWeek = previousWeeks[0] ?? null;
  const lastWeekPct = lastWeek
    ? pctOf(
        lastWeek.rollup.sumCaloriesConsumed,
        lastWeek.rollup.sumCaloriesGoal > 0
          ? lastWeek.rollup.sumCaloriesGoal
          : null,
      )
    : null;
  const vsLastWeek = pctVs(kcalPct, lastWeekPct);

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
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
            Makro tydzień
          </p>
          <h1 className="truncate text-[22px] font-semibold text-white">
            {formatPlCalendarRange(weekStart, weekEnd)}
          </h1>
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
              {vsLastWeek != null ? (
                <p
                  className={cn(
                    "mt-1.5 text-[12px] font-semibold tabular-nums",
                    deltaTone(vsLastWeek, true),
                  )}
                >
                  {signedPct(vsLastWeek)} vs poprzedni tydzień
                </p>
              ) : null}
            </div>
            <p className="pb-1 text-right text-[12px] tabular-nums text-white/50">
              {Math.round(weekRollup.sumCaloriesConsumed)}
              {weekRollup.sumCaloriesGoal > 0
                ? ` / ${Math.round(weekRollup.sumCaloriesGoal)} kcal`
                : " kcal"}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-1">
            {dayRows.map((row) => {
              const st = dayStatus(row, todayKey);
              const active = row.dateKey === selectedKey;
              const isToday = row.dateKey === todayKey;
              const dayPct = pctOf(row.caloriesConsumed, row.caloriesGoal);
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

      <WeekVsWeeksCard weekRollup={weekRollup} previousWeeks={previousWeeks} />

      <section className="app-card space-y-4 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
          Statystyki tygodnia
        </p>
        <MacroBar
          label="Kalorie"
          icon={<Flame className="h-3.5 w-3.5" />}
          consumed={weekRollup.sumCaloriesConsumed}
          goal={
            weekRollup.sumCaloriesGoal > 0 ? weekRollup.sumCaloriesGoal : null
          }
          unit="kcal"
          barClass="bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400"
          compareLabel={
            vsLastWeek != null
              ? `${signedPct(vsLastWeek)} vs poprzedni tydzień`
              : null
          }
        />
        <MacroBar
          label="Białko"
          icon={<Beef className="h-3.5 w-3.5" />}
          consumed={weekRollup.sumProteinConsumed}
          goal={
            weekRollup.sumProteinGoal > 0 ? weekRollup.sumProteinGoal : null
          }
          unit="g"
          barClass="bg-gradient-to-r from-sky-400 to-cyan-300"
          compareLabel={(() => {
            const cur = pctOf(
              weekRollup.sumProteinConsumed,
              weekRollup.sumProteinGoal > 0
                ? weekRollup.sumProteinGoal
                : null,
            );
            const prev = lastWeek
              ? pctOf(
                  lastWeek.rollup.sumProteinConsumed,
                  lastWeek.rollup.sumProteinGoal > 0
                    ? lastWeek.rollup.sumProteinGoal
                    : null,
                )
              : null;
            const d = pctVs(cur, prev);
            return d != null ? `${signedPct(d)} vs poprzedni tydzień` : null;
          })()}
        />
        <MacroBar
          label="Węglowodany"
          icon={<Wheat className="h-3.5 w-3.5" />}
          consumed={weekRollup.sumCarbsConsumed}
          goal={weekRollup.sumCarbsGoal > 0 ? weekRollup.sumCarbsGoal : null}
          unit="g"
          barClass="bg-gradient-to-r from-violet-400 to-fuchsia-300"
          compareLabel={(() => {
            const cur = pctOf(
              weekRollup.sumCarbsConsumed,
              weekRollup.sumCarbsGoal > 0 ? weekRollup.sumCarbsGoal : null,
            );
            const prev = lastWeek
              ? pctOf(
                  lastWeek.rollup.sumCarbsConsumed,
                  lastWeek.rollup.sumCarbsGoal > 0
                    ? lastWeek.rollup.sumCarbsGoal
                    : null,
                )
              : null;
            const d = pctVs(cur, prev);
            return d != null ? `${signedPct(d)} vs poprzedni tydzień` : null;
          })()}
        />
        <MacroBar
          label="Tłuszcz"
          icon={<Droplets className="h-3.5 w-3.5" />}
          consumed={weekRollup.sumFatConsumed}
          goal={weekRollup.sumFatGoal > 0 ? weekRollup.sumFatGoal : null}
          unit="g"
          barClass="bg-gradient-to-r from-amber-300 to-yellow-200"
          compareLabel={(() => {
            const cur = pctOf(
              weekRollup.sumFatConsumed,
              weekRollup.sumFatGoal > 0 ? weekRollup.sumFatGoal : null,
            );
            const prev = lastWeek
              ? pctOf(
                  lastWeek.rollup.sumFatConsumed,
                  lastWeek.rollup.sumFatGoal > 0
                    ? lastWeek.rollup.sumFatGoal
                    : null,
                )
              : null;
            const d = pctVs(cur, prev);
            return d != null ? `${signedPct(d)} vs poprzedni tydzień` : null;
          })()}
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

      {previousWeeks.length > 0 ? (
        <section className="space-y-2.5">
          <p className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
            Poprzednie tygodnie
          </p>
          {previousWeeks.slice(0, 4).map((w) => {
            const p = pctOf(
              w.rollup.sumCaloriesConsumed,
              w.rollup.sumCaloriesGoal > 0 ? w.rollup.sumCaloriesGoal : null,
            );
            const vsThis = pctVs(p, kcalPct);
            return (
              <details
                key={w.weekStart}
                className="app-card group overflow-hidden"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-white">
                      {w.weekLabel}
                    </p>
                    <p className="mt-0.5 text-[11px] tabular-nums text-white/45">
                      {Math.round(w.rollup.sumCaloriesConsumed)}
                      {w.rollup.sumCaloriesGoal > 0
                        ? ` / ${Math.round(w.rollup.sumCaloriesGoal)} kcal`
                        : " kcal"}
                      {p != null ? ` · ${p}%` : ""}
                      {vsThis != null ? (
                        <span className={cn("ml-1.5", deltaTone(vsThis, true))}>
                          {signedPct(vsThis)} vs ten tydzień
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/35 transition group-open:rotate-90" />
                </summary>
                <div className="space-y-2 border-t border-white/[0.06] px-4 py-3">
                  {w.dayRows.map((row) => {
                    const st = dayStatus(row, todayKey);
                    const dayPct = pctOf(row.caloriesConsumed, row.caloriesGoal);
                    return (
                      <div
                        key={row.dateKey}
                        className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] text-white/85">
                            {row.headline}
                          </p>
                          <p className="text-[11px] tabular-nums text-white/40">
                            {Math.round(row.caloriesConsumed)} kcal
                            {dayPct != null ? ` · ${dayPct}%` : ""} · B
                            {Math.round(row.proteinConsumed)} W
                            {Math.round(row.carbsConsumed)} T
                            {Math.round(row.fatConsumed)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            statusTone(st),
                          )}
                        >
                          {statusLabel(st)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
