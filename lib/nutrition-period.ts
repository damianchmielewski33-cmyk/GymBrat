import { addCalendarDays, calendarWeekdaySun0 } from "@/lib/local-date";
import {
  buildMacroBalance,
  buildWeekAverages,
  type WeekAverage,
} from "@/lib/nutrition-day-balance";
import type { WeekDayNutritionRow } from "@/lib/week-nutrition-rows";

/** Zakresy ekranu statystyk: ostatnie dni liczone do dziś włącznie. */
export const PERIOD_DAYS = { month: 30, quarter: 90 } as const;

export type PeriodDayStatus =
  | "ok"
  | "over"
  | "under"
  | "empty"
  | "today"
  | "no_goal"
  | "future"
  | "out";

export type PeriodCell = {
  dateKey: string;
  dayOfMonth: number;
  status: PeriodDayStatus;
  /** Różnica kcal względem celu (tylko dni zamknięte z wpisami i celem). */
  kcalDelta: number | null;
};

const KCAL_META = { key: "calories", label: "Kalorie", unit: "kcal" } as const;

/** Spłaszcza tygodnie (dowolna kolejność) do dni unikalnych po dacie, rosnąco. */
export function flattenWeekRows(
  weeks: { dayRows: WeekDayNutritionRow[] }[],
): WeekDayNutritionRow[] {
  const map = new Map<string, WeekDayNutritionRow>();
  for (const w of weeks) for (const r of w.dayRows) map.set(r.dateKey, r);
  return [...map.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

/** Klucz pierwszego dnia okna „ostatnie N dni” kończącego się dziś. */
export function periodStartKey(todayKey: string, days: number): string {
  return addCalendarDays(todayKey, -(Math.max(1, days) - 1));
}

export function rowsInRange(
  rows: WeekDayNutritionRow[],
  startKey: string,
  endKey: string,
): WeekDayNutritionRow[] {
  return rows.filter((r) => r.dateKey >= startKey && r.dateKey <= endKey);
}

export function classifyPeriodDay(
  row: WeekDayNutritionRow | undefined,
  dateKey: string,
  todayKey: string,
): { status: PeriodDayStatus; kcalDelta: number | null } {
  if (dateKey > todayKey) return { status: "future", kcalDelta: null };
  if (dateKey === todayKey) return { status: "today", kcalDelta: null };
  if (!row || !(row.entryCount > 0)) return { status: "empty", kcalDelta: null };
  const b = buildMacroBalance(row.caloriesConsumed, row.caloriesGoal, KCAL_META);
  if (b.status === "no_goal") return { status: "no_goal", kcalDelta: null };
  const kcalDelta = b.delta == null ? null : Math.round(b.delta);
  if (b.status === "surplus") return { status: "over", kcalDelta };
  if (b.status === "deficit") return { status: "under", kcalDelta };
  return { status: "ok", kcalDelta };
}

/**
 * Siatka kalendarza pn→nd obejmująca okno [startKey, endKey];
 * dni spoza okna to `out` (wypełnienie do pełnych tygodni).
 */
export function buildPeriodCells(
  rows: WeekDayNutritionRow[],
  startKey: string,
  endKey: string,
  todayKey: string,
): PeriodCell[] {
  const byKey = new Map(rows.map((r) => [r.dateKey, r]));
  const startDow = calendarWeekdaySun0(startKey);
  const lead = startDow === 0 ? 6 : startDow - 1;
  const endDow = calendarWeekdaySun0(endKey);
  const trail = endDow === 0 ? 0 : 7 - endDow;
  const first = addCalendarDays(startKey, -lead);
  const total = lead + (daysInclusive(startKey, endKey)) + trail;
  const cells: PeriodCell[] = [];
  for (let i = 0; i < total; i++) {
    const dateKey = addCalendarDays(first, i);
    const dayOfMonth = Number(dateKey.slice(8, 10));
    if (dateKey < startKey || dateKey > endKey) {
      cells.push({ dateKey, dayOfMonth, status: "out", kcalDelta: null });
      continue;
    }
    const c = classifyPeriodDay(byKey.get(dateKey), dateKey, todayKey);
    cells.push({ dateKey, dayOfMonth, ...c });
  }
  return cells;
}

function daysInclusive(a: string, b: string): number {
  let n = 0;
  let k = a;
  while (k <= b && n < 400) {
    n += 1;
    k = addCalendarDays(k, 1);
  }
  return n;
}

export type PeriodSummary = {
  averages: WeekAverage[];
  kcal: WeekAverage;
  /** Dni zamknięte z wpisami (podstawa średnich). */
  daysCounted: number;
  /** Dni zamknięte w oknie (bez dziś i przyszłości). */
  daysClosed: number;
  counts: { ok: number; over: number; under: number };
  /** Dzień z największą nadwyżką / największym niedoborem kcal. */
  maxOver: { dateKey: string; delta: number } | null;
  maxUnder: { dateKey: string; delta: number } | null;
};

export function summarizePeriod(
  rows: WeekDayNutritionRow[],
  todayKey: string,
): PeriodSummary {
  const averages = buildWeekAverages(rows, todayKey);
  const kcal = averages.find((a) => a.key === "calories")!;
  let maxOver: PeriodSummary["maxOver"] = null;
  let maxUnder: PeriodSummary["maxUnder"] = null;
  let daysClosed = 0;
  for (const r of rows) {
    if (r.dateKey >= todayKey) continue;
    daysClosed += 1;
    const c = classifyPeriodDay(r, r.dateKey, todayKey);
    if (c.kcalDelta == null) continue;
    if (c.status === "over" && (!maxOver || c.kcalDelta > maxOver.delta)) {
      maxOver = { dateKey: r.dateKey, delta: c.kcalDelta };
    }
    if (c.status === "under" && (!maxUnder || c.kcalDelta < maxUnder.delta)) {
      maxUnder = { dateKey: r.dateKey, delta: c.kcalDelta };
    }
  }
  return {
    averages,
    kcal,
    daysCounted: kcal.daysCounted,
    daysClosed,
    counts: { ok: kcal.daysOk, over: kcal.daysOver, under: kcal.daysUnder },
    maxOver,
    maxUnder,
  };
}

/** „+96” / „−380” / „0”; null → „–”. */
export function formatKcalDelta(n: number | null): string {
  if (n == null) return "–";
  const r = Math.round(n);
  if (r === 0) return "0";
  return r > 0 ? `+${r}` : `−${Math.abs(r)}`;
}
