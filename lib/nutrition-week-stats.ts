import type { WeekDayNutritionRow } from "@/lib/week-nutrition-rows";

export type MacroKey = "calories" | "protein" | "carbs" | "fat";

/** Próg „w normie”: |Δ%| ≤ MACRO_TOLERANCE_PP albo |Δ| < 1 (Q-O1). */
export const MACRO_TOLERANCE_PP = 5;

export type DayEvaluationState =
  | "future"
  | "in_progress"
  | "no_entries"
  | "evaluated";

export type MacroTotals = {
  /** Spożycie tylko z dni mających cel dla tego makro (spójne z goal). */
  consumed: number;
  /** Suma celów w oknie; null gdy żaden dzień nie ma celu. */
  goal: number | null;
  daysWithGoal: number;
  daysInWindow: number;
};

export type MacroWindowRollup = MacroTotals & {
  daysEvaluated: number;
  daysNoEntries: number;
  consumedClosed: number;
  consumedToday: number;
  goalClosed: number;
  goalToday: number;
};

export type WeekMacroRollup = {
  calories: MacroTotals;
  protein: MacroTotals;
  carbs: MacroTotals;
  fat: MacroTotals;
};

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

function emptyTotals(daysInWindow: number): MacroTotals {
  return {
    consumed: 0,
    goal: null,
    daysWithGoal: 0,
    daysInWindow,
  };
}

export function classifyDayState(
  row: WeekDayNutritionRow,
  todayKey: string,
): DayEvaluationState {
  if (row.dateKey > todayKey) return "future";
  if (row.dateKey === todayKey) return "in_progress";
  if (!(row.entryCount > 0)) return "no_entries";
  return "evaluated";
}

/**
 * Jedno źródło sum makro (ADR 0005): wspólna pętla z jawnym zakresem.
 * Dni `no_entries` nigdy nie wchodzą do sumy celów ani spożycia.
 */
export function rollupMacroWindow(
  rows: WeekDayNutritionRow[],
  todayKey: string,
  key: MacroKey,
  opts: {
    includeFutureDays: boolean;
    includeInProgressGoal: "only_if_consumed" | "always" | "never";
  },
): MacroWindowRollup {
  let consumed = 0;
  let goalSum = 0;
  let daysWithGoal = 0;
  let daysInWindow = 0;
  let daysEvaluated = 0;
  let daysNoEntries = 0;
  let consumedClosed = 0;
  let consumedToday = 0;
  let goalClosed = 0;
  let goalToday = 0;

  for (const row of rows) {
    const state = classifyDayState(row, todayKey);
    if (state === "future" && !opts.includeFutureDays) continue;

    daysInWindow += 1;

    if (state === "no_entries") {
      daysNoEntries += 1;
      continue;
    }
    if (state === "future") {
      // Przyszłość w rollupie „cały tydzień”: cel wchodzi, spożycie 0.
      const m = dayMacro(row, key);
      if (m.goal != null && m.goal > 0) {
        daysWithGoal += 1;
        goalSum += m.goal;
      }
      continue;
    }

    const m = dayMacro(row, key);
    const safeConsumed = Number.isFinite(m.consumed) ? m.consumed : 0;
    const hasGoal = m.goal != null && m.goal > 0;
    const hasEntries = row.entryCount > 0;

    if (state === "in_progress") {
      if (!hasEntries) {
        daysNoEntries += 1;
        if (opts.includeInProgressGoal === "always" && hasGoal) {
          daysWithGoal += 1;
          goalSum += m.goal!;
          goalToday += m.goal!;
        }
        continue;
      }
      // BR-5: od pierwszego wpisu dziś wchodzi do sumy.
      consumedToday += safeConsumed;
      consumed += safeConsumed;
      daysEvaluated += 1;
      const includeGoal =
        opts.includeInProgressGoal === "always" ||
        opts.includeInProgressGoal === "only_if_consumed";
      if (includeGoal && hasGoal) {
        daysWithGoal += 1;
        goalSum += m.goal!;
        goalToday += m.goal!;
      }
      continue;
    }

    // evaluated (zamknięty z wpisami)
    consumedClosed += safeConsumed;
    consumed += safeConsumed;
    daysEvaluated += 1;
    if (hasGoal) {
      daysWithGoal += 1;
      goalSum += m.goal!;
      goalClosed += m.goal!;
    }
  }

  return {
    consumed,
    goal: daysWithGoal > 0 ? goalSum : null,
    daysWithGoal,
    daysInWindow,
    daysEvaluated,
    daysNoEntries,
    consumedClosed,
    consumedToday,
    goalClosed,
    goalToday,
  };
}

/** Realizacja celu bez wcześniejszego zaokrąglania (0–∞, np. 0.973). */
export function adherenceRatio(
  consumed: number,
  goal: number | null,
): number | null {
  if (goal == null || !(goal > 0) || !Number.isFinite(consumed)) return null;
  return consumed / goal;
}

/** % realizacji celu, zaokrąglone dopiero na końcu. */
export function adherencePct(
  consumed: number,
  goal: number | null,
): number | null {
  const r = adherenceRatio(consumed, goal);
  if (r == null) return null;
  return Math.round(r * 100);
}

/**
 * Różnica realizacji w punktach procentowych (nie „% z %”).
 * np. 95% vs 90% → +5.
 */
export function adherenceDeltaPp(
  currentPct: number | null,
  baselinePct: number | null,
): number | null {
  if (currentPct == null || baselinePct == null) return null;
  if (!Number.isFinite(currentPct) || !Number.isFinite(baselinePct)) return null;
  return currentPct - baselinePct;
}

export function formatSignedPp(delta: number | null): string | null {
  if (delta == null || !Number.isFinite(delta)) return null;
  const r = Math.round(delta);
  if (r === 0) return "0%";
  return r > 0 ? `+${r}%` : `${r}%`;
}

/**
 * Sumuje makro w oknie pn→indeks.
 * Do % biorą się wyłącznie dni z celem — spożycie z dni bez celu nie zawyża realizacji.
 */
export function rollupMacroThroughIndex(
  rows: WeekDayNutritionRow[],
  throughIndexInclusive: number,
  key: MacroKey,
): MacroTotals {
  const end = Math.max(-1, Math.min(throughIndexInclusive, rows.length - 1));
  const daysInWindow = end + 1;
  if (daysInWindow <= 0) return emptyTotals(0);

  let consumed = 0;
  let goalSum = 0;
  let daysWithGoal = 0;

  for (let i = 0; i <= end; i++) {
    const m = dayMacro(rows[i]!, key);
    if (m.goal == null || !(m.goal > 0)) continue;
    daysWithGoal += 1;
    goalSum += m.goal;
    consumed += Number.isFinite(m.consumed) ? m.consumed : 0;
  }

  return {
    consumed,
    goal: daysWithGoal > 0 ? goalSum : null,
    daysWithGoal,
    daysInWindow,
  };
}

export function rollupWeekThroughIndex(
  rows: WeekDayNutritionRow[],
  throughIndexInclusive: number,
): WeekMacroRollup {
  return {
    calories: rollupMacroThroughIndex(rows, throughIndexInclusive, "calories"),
    protein: rollupMacroThroughIndex(rows, throughIndexInclusive, "protein"),
    carbs: rollupMacroThroughIndex(rows, throughIndexInclusive, "carbs"),
    fat: rollupMacroThroughIndex(rows, throughIndexInclusive, "fat"),
  };
}

/** Kompatybilny kształt ze starym WeekRollupPick (sum*). */
export function weekRollupPickFromMacros(r: WeekMacroRollup): {
  sumProteinGoal: number;
  sumProteinConsumed: number;
  sumFatGoal: number;
  sumFatConsumed: number;
  sumCarbsGoal: number;
  sumCarbsConsumed: number;
  sumCaloriesGoal: number;
  sumCaloriesConsumed: number;
} {
  return {
    sumCaloriesConsumed: r.calories.consumed,
    sumCaloriesGoal: r.calories.goal ?? 0,
    sumProteinConsumed: r.protein.consumed,
    sumProteinGoal: r.protein.goal ?? 0,
    sumCarbsConsumed: r.carbs.consumed,
    sumCarbsGoal: r.carbs.goal ?? 0,
    sumFatConsumed: r.fat.consumed,
    sumFatGoal: r.fat.goal ?? 0,
  };
}

/**
 * Średnia realizacja dni w oknie (najpierw średnia surowych ratio, potem %).
 * Pomija dni przyszłe i dni bez celu; dni z celem i 0 spożycia liczą się jako 0%.
 */
export function avgDayAdherencePct(
  rows: WeekDayNutritionRow[],
  todayKey: string,
  key: MacroKey,
): number | null {
  const ratios: number[] = [];
  for (const row of rows) {
    if (row.dateKey > todayKey) continue;
    const m = dayMacro(row, key);
    const r = adherenceRatio(m.consumed, m.goal);
    if (r == null) continue;
    ratios.push(r);
  }
  if (!ratios.length) return null;
  const avg = ratios.reduce((s, v) => s + v, 0) / ratios.length;
  return Math.round(avg * 100);
}

/** Średnia spożycia z dni ≤ today mających wpis (>0). */
export function avgDayConsumed(
  rows: WeekDayNutritionRow[],
  todayKey: string,
  key: MacroKey,
): number | null {
  const vals: number[] = [];
  for (const row of rows) {
    if (row.dateKey > todayKey) continue;
    const m = dayMacro(row, key);
    if (!(m.consumed > 0)) continue;
    vals.push(m.consumed);
  }
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

/**
 * Delta dnia vs średnia: punkty % realizacji, a gdy brak celów — % różnicy spożycia.
 */
export function dayVsWeekAverageDelta(
  row: WeekDayNutritionRow,
  dayRows: WeekDayNutritionRow[],
  todayKey: string,
  key: MacroKey,
): number | null {
  const m = dayMacro(row, key);
  const dayPct = adherencePct(m.consumed, m.goal);
  const avgPct = avgDayAdherencePct(dayRows, todayKey, key);
  const pp = adherenceDeltaPp(dayPct, avgPct);
  if (pp != null) return pp;

  const avgCons = avgDayConsumed(dayRows, todayKey, key);
  if (avgCons == null || !(avgCons > 0) || !Number.isFinite(m.consumed)) {
    return null;
  }
  return ((m.consumed - avgCons) / avgCons) * 100;
}

/** Średnia realizacji kcal z wielu tygodni (ten sam throughIndex), z surowych ratio. */
export function avgWeeksAdherencePct(
  weekDayRows: WeekDayNutritionRow[][],
  throughIndexInclusive: number,
  key: MacroKey = "calories",
): number | null {
  const ratios: number[] = [];
  for (const rows of weekDayRows) {
    const t = rollupMacroThroughIndex(rows, throughIndexInclusive, key);
    const r = adherenceRatio(t.consumed, t.goal);
    if (r != null) ratios.push(r);
  }
  if (!ratios.length) return null;
  const avg = ratios.reduce((s, v) => s + v, 0) / ratios.length;
  return Math.round(avg * 100);
}

export function weekDayIndexThroughToday(
  dayRows: WeekDayNutritionRow[],
  todayKey: string,
): number {
  const idx = dayRows.findIndex((r) => r.dateKey === todayKey);
  if (idx >= 0) return idx;
  let lastPast = -1;
  for (let i = 0; i < dayRows.length; i++) {
    if (dayRows[i]!.dateKey <= todayKey) lastPast = i;
  }
  return lastPast >= 0 ? lastPast : Math.max(0, dayRows.length - 1);
}
