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

function MacroBar({
  label,
  icon,
  consumed,
  goal,
  unit,
  barClass,
}: {
  label: string;
  icon: ReactNode;
  consumed: number;
  goal: number | null;
  unit: string;
  barClass: string;
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
    </div>
  );
}

function DayDetailCard({ row, status }: { row: WeekDayNutritionRow; status: DayStatus }) {
  return (
    <section className="app-card space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
            Dzień
          </p>
          <h2 className="mt-1 text-[18px] font-semibold text-white">
            {row.headline}
          </h2>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            statusTone(status),
          )}
        >
          {statusLabel(status)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {(
          [
            ["Kcal", row.caloriesConsumed, row.caloriesGoal, "kcal"],
            ["Białko", row.proteinConsumed, row.proteinGoal, "g"],
            ["Węgle", row.carbsConsumed, row.carbsGoal, "g"],
            ["Tłuszcz", row.fatConsumed, row.fatGoal, "g"],
          ] as const
        ).map(([label, consumed, goal, unit]) => {
          const p = pctOf(consumed, goal);
          return (
            <div
              key={label}
              className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                {label}
              </p>
              <p className="mt-1 font-metric text-[22px] leading-none text-white">
                {Math.round(consumed)}
                <span className="ml-1 text-[12px] text-white/40">{unit}</span>
              </p>
              <p className="mt-1.5 text-[11px] tabular-nums text-white/45">
                {goal != null
                  ? `cel ${Math.round(goal)} · ${p ?? "—"}%`
                  : "brak celu"}
              </p>
            </div>
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
                      isToday && st !== "over" && st !== "on_track" && st !== "under"
                        ? "border-[var(--gym-gold)]"
                        : null,
                    )}
                  >
                    {dayNum(row.dateKey)}
                  </span>
                  <span
                    className={cn(
                      "mt-1.5 h-1.5 w-1.5 rounded-full",
                      st === "on_track" && "bg-emerald-400",
                      st === "under" && "bg-sky-400",
                      st === "over" && "bg-rose-400",
                      (st === "empty" || st === "future") && "bg-white/20",
                    )}
                  />
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-white/40">
            Zieleń — w normie · niebieski — poniżej · czerwony — nadwyżka
          </p>
        </div>
      </section>

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
        />
        <MacroBar
          label="Węglowodany"
          icon={<Wheat className="h-3.5 w-3.5" />}
          consumed={weekRollup.sumCarbsConsumed}
          goal={weekRollup.sumCarbsGoal > 0 ? weekRollup.sumCarbsGoal : null}
          unit="g"
          barClass="bg-gradient-to-r from-violet-400 to-fuchsia-300"
        />
        <MacroBar
          label="Tłuszcz"
          icon={<Droplets className="h-3.5 w-3.5" />}
          consumed={weekRollup.sumFatConsumed}
          goal={weekRollup.sumFatGoal > 0 ? weekRollup.sumFatGoal : null}
          unit="g"
          barClass="bg-gradient-to-r from-amber-300 to-yellow-200"
        />
      </section>

      {selected ? (
        <DayDetailCard row={selected} status={selectedStatus} />
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
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/35 transition group-open:rotate-90" />
                </summary>
                <div className="space-y-2 border-t border-white/[0.06] px-4 py-3">
                  {w.dayRows.map((row) => {
                    const st = dayStatus(row, todayKey);
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
                            {Math.round(row.caloriesConsumed)} kcal · B
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
