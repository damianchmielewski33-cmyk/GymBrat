import type { NutritionDayType } from "@/lib/nutrition-goals";
import type { WeekDayNutritionRow } from "@/lib/week-nutrition-rows";
import {
  adherencePct,
  classifyDayState,
  MACRO_TOLERANCE_PP,
  rollupMacroWindow,
  type DayEvaluationState,
  type MacroKey,
} from "@/lib/nutrition-week-stats";

export type { DayEvaluationState, MacroKey };
export { MACRO_TOLERANCE_PP };

export type MacroDirection = "under" | "over" | "in_range" | "none";

export type MacroBalance = {
  key: MacroKey;
  label: string;
  unit: "g" | "kcal";
  consumed: number;
  goal: number | null;
  /** spożycie − cel; ujemne = brak, dodatnie = nadwyżka */
  delta: number | null;
  /** % realizacji celu (zaokrąglone) */
  adherencePct: number | null;
  /** (spożycie/cel − 1) × 100; ujemne = brak % */
  deltaPct: number | null;
  status: "deficit" | "surplus" | "on_track" | "no_goal";
  remaining: number | null;
  direction: MacroDirection;
  isPartial: boolean;
  /** Segmenty tygodnia (opcjonalnie). */
  consumedClosed?: number;
  consumedToday?: number;
  goalClosed?: number;
  goalToday?: number;
};

export type DayCardStatus =
  | "in_range"
  | "deviations"
  | "empty"
  | "partial"
  | "no_goal"
  | "in_progress";

export type DayCardViewModel = {
  dateKey: string;
  headline: string;
  weekdayLabel: string;
  shortDateLabel: string;
  state: DayEvaluationState;
  dayType: NutritionDayType;
  status: DayCardStatus;
  hasIncompleteData: boolean;
  /** Czy są wpisy meal_logs (AU-4; nie mylić z 0 kcal). */
  hasEntries: boolean;
  macros: MacroBalance[];
  highlightsCount: number;
  /** Odchylenia (zamknięte dni) — stała kolejność makro. */
  deviations: MacroBalance[];
};

export type WeekTrendDay = {
  dateKey: string;
  weekdayShort: string;
  label: string;
  kcalPct: number | null;
  caloriesConsumed: number;
  caloriesGoal: number | null;
  kind: "filled" | "today" | "empty" | "no_goal";
  ariaLabel: string;
};

export type MacroBalanceViewModel = {
  todayKey: string;
  weekLabel: string;
  weekRangeMeta: string;
  today: DayCardViewModel | null;
  period: {
    state: "evaluated" | "no_data";
    daysWithEntries: number;
    daysInWeek: number;
    macros: MacroBalance[];
  };
  pastDays: DayCardViewModel[];
  trendDays: WeekTrendDay[];
  deviationCountByMacro: Record<MacroKey, number>;
  totalDeviations: number;
  daysWithDeviations: number;
  goalsAnnotation: string | null;
};

export type PeriodMacroBalance = {
  macros: MacroBalance[];
  highlights: MacroBalance[];
  daysCounted: number;
};

const MACRO_META: {
  key: MacroKey;
  label: string;
  unit: "g" | "kcal";
}[] = [
  { key: "calories", label: "Kalorie", unit: "kcal" },
  { key: "protein", label: "Białko", unit: "g" },
  { key: "carbs", label: "Węglowodany", unit: "g" },
  { key: "fat", label: "Tłuszcz", unit: "g" },
];

function dayConsumedGoal(
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

/**
 * Próg „w normie”: |Δ%| ≤ MACRO_TOLERANCE_PP albo |Δ| poniżej 1 jednostki.
 * Nadwyżka = surplus (ton komunikatu to sprawa UI).
 */
export function classifyMacroBalance(
  delta: number | null,
  deltaPct: number | null,
): MacroBalance["status"] {
  if (delta == null || deltaPct == null) return "no_goal";
  if (Math.abs(delta) < 1 || Math.abs(deltaPct) <= MACRO_TOLERANCE_PP) {
    return "on_track";
  }
  return delta > 0 ? "surplus" : "deficit";
}

function directionFromStatus(
  status: MacroBalance["status"],
): MacroDirection {
  if (status === "deficit") return "under";
  if (status === "surplus") return "over";
  if (status === "on_track") return "in_range";
  return "none";
}

export function buildMacroBalance(
  consumed: number,
  goal: number | null,
  meta: { key: MacroKey; label: string; unit: "g" | "kcal" },
  opts?: { isPartial?: boolean },
): MacroBalance {
  const safeConsumed = Number.isFinite(consumed) ? consumed : 0;
  if (goal == null || !(goal > 0)) {
    return {
      key: meta.key,
      label: meta.label,
      unit: meta.unit,
      consumed: safeConsumed,
      goal: null,
      delta: null,
      adherencePct: null,
      deltaPct: null,
      status: "no_goal",
      remaining: null,
      direction: "none",
      isPartial: opts?.isPartial ?? false,
    };
  }
  const delta = safeConsumed - goal;
  const pct = adherencePct(safeConsumed, goal);
  const deltaPct =
    pct == null ? null : Math.round((safeConsumed / goal - 1) * 100);
  const status = classifyMacroBalance(delta, deltaPct);
  return {
    key: meta.key,
    label: meta.label,
    unit: meta.unit,
    consumed: safeConsumed,
    goal,
    delta,
    adherencePct: pct,
    deltaPct,
    status,
    remaining: Math.max(0, goal - safeConsumed),
    direction: directionFromStatus(status),
    isPartial: opts?.isPartial ?? false,
  };
}

function weekdayLong(dateKey: string): string {
  try {
    return new Intl.DateTimeFormat("pl-PL", { weekday: "long" })
      .format(new Date(`${dateKey}T12:00:00`))
      .replace(/^./, (c) => c.toUpperCase());
  } catch {
    return dateKey;
  }
}

function shortDateLabel(dateKey: string): string {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      day: "numeric",
      month: "short",
    }).format(new Date(`${dateKey}T12:00:00`));
  } catch {
    return dateKey;
  }
}

function weekdayShortLetter(dateKey: string): string {
  const letters = ["P", "W", "Ś", "C", "P", "S", "N"];
  const d = new Date(`${dateKey}T12:00:00`);
  const js = d.getDay(); // 0=Nd
  const idx = js === 0 ? 6 : js - 1;
  return letters[idx] ?? "?";
}

function resolveDayCardStatus(
  state: DayEvaluationState,
  macros: MacroBalance[],
  hasIncompleteData: boolean,
  entryCount: number,
): { status: DayCardStatus; deviations: MacroBalance[] } {
  if (state === "in_progress") {
    return { status: "in_progress", deviations: [] };
  }
  if (state === "no_entries" || entryCount === 0) {
    return { status: "empty", deviations: [] };
  }
  if (hasIncompleteData) {
    return { status: "partial", deviations: [] };
  }
  const hasAnyGoal = macros.some((m) => m.goal != null && m.goal > 0);
  if (!hasAnyGoal) {
    return { status: "no_goal", deviations: [] };
  }
  const deviations = macros.filter(
    (m) => m.status === "deficit" || m.status === "surplus",
  );
  if (deviations.length === 0) {
    return { status: "in_range", deviations: [] };
  }
  return { status: "deviations", deviations };
}

export function buildDayCardViewModel(
  row: WeekDayNutritionRow,
  todayKey: string,
  opts?: { hasIncompleteData?: boolean },
): DayCardViewModel {
  const state = classifyDayState(row, todayKey);
  const hasIncompleteData = opts?.hasIncompleteData ?? false;
  const macros = MACRO_META.map((meta) => {
    const { consumed, goal } = dayConsumedGoal(row, meta.key);
    return buildMacroBalance(consumed, goal, meta, {
      isPartial: hasIncompleteData,
    });
  });
  const { status, deviations } = resolveDayCardStatus(
    state,
    macros,
    hasIncompleteData,
    row.entryCount,
  );
  return {
    dateKey: row.dateKey,
    headline: row.headline,
    weekdayLabel: weekdayLong(row.dateKey),
    shortDateLabel: shortDateLabel(row.dateKey),
    state,
    dayType: row.dayType,
    status,
    hasIncompleteData,
    hasEntries: row.entryCount > 0,
    macros,
    highlightsCount: deviations.length,
    deviations,
  };
}

/** Suma spożycia i celów pn→dziś (ADR: only_if_consumed, bez no_entries). */
export function buildPeriodMacroBalance(
  rows: WeekDayNutritionRow[],
  todayKey: string,
): PeriodMacroBalance {
  const window = rollupMacroWindow(rows, todayKey, "calories", {
    includeFutureDays: false,
    includeInProgressGoal: "only_if_consumed",
  });
  const macros = MACRO_META.map((meta) => {
    const r = rollupMacroWindow(rows, todayKey, meta.key, {
      includeFutureDays: false,
      includeInProgressGoal: "only_if_consumed",
    });
    const balance = buildMacroBalance(r.consumed, r.goal, meta);
    // Dziś w toku wlicza pełny cel dnia: status z dni zamkniętych, by nie sugerować „brakuje”.
    // Bez zamkniętych dni nie ma jeszcze czego oceniać — status neutralny.
    const partial = r.goalToday > 0;
    const closedStatus: MacroBalance["status"] = !partial
      ? balance.status
      : r.goalClosed > 0
        ? buildMacroBalance(r.consumedClosed, r.goalClosed, meta).status
        : "on_track";
    return {
      ...balance,
      status: closedStatus,
      direction: directionFromStatus(closedStatus),
      isPartial: partial,
      consumedClosed: r.consumedClosed,
      consumedToday: r.consumedToday,
      goalClosed: r.goalClosed,
      goalToday: r.goalToday,
    };
  });

  return {
    macros,
    highlights: macros.filter(
      (m) => m.status === "deficit" || m.status === "surplus",
    ),
    daysCounted: window.daysEvaluated,
  };
}

function buildTrendDays(
  rows: WeekDayNutritionRow[],
  todayKey: string,
): WeekTrendDay[] {
  return rows.map((row) => {
    const state = classifyDayState(row, todayKey);
    const goal = row.caloriesGoal;
    const consumed = row.caloriesConsumed;
    const pct =
      goal != null && goal > 0 ? adherencePct(consumed, goal) : null;
    let kind: WeekTrendDay["kind"];
    if (state === "in_progress") kind = "today";
    else if (state === "no_entries" || !(row.entryCount > 0)) kind = "empty";
    else if (goal == null || !(goal > 0)) kind = "no_goal";
    else kind = "filled";

    const wd = weekdayLong(row.dateKey);
    const ariaLabel =
      kind === "empty"
        ? `${wd}: brak wpisów`
        : kind === "no_goal"
          ? `${wd}: ${Math.round(consumed)} kilokalorii, brak celu`
          : pct == null
            ? `${wd}: ${Math.round(consumed)} kilokalorii`
            : `${wd}: ${pct} procent celu, ${Math.round(consumed)} z ${Math.round(goal!)} kilokalorii`;

    return {
      dateKey: row.dateKey,
      weekdayShort: weekdayShortLetter(row.dateKey),
      label: wd,
      kcalPct: pct,
      caloriesConsumed: consumed,
      caloriesGoal: goal,
      kind,
      ariaLabel,
    };
  });
}

export function buildMacroBalanceViewModel(
  rows: WeekDayNutritionRow[],
  todayKey: string,
  weekLabel: string,
): MacroBalanceViewModel {
  const todayRow = rows.find((r) => r.dateKey === todayKey) ?? null;
  const today = todayRow ? buildDayCardViewModel(todayRow, todayKey) : null;

  const periodRaw = buildPeriodMacroBalance(rows, todayKey);
  const daysWithEntries = rows.filter(
    (r) => r.dateKey <= todayKey && r.entryCount > 0,
  ).length;
  const daysInWeek = 7;

  const pastDays = rows
    .filter((r) => r.dateKey < todayKey)
    .map((r) => buildDayCardViewModel(r, todayKey))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  const deviationCountByMacro: Record<MacroKey, number> = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };
  let totalDeviations = 0;
  let daysWithDeviations = 0;
  for (const day of pastDays) {
    if (day.status !== "deviations") continue;
    daysWithDeviations += 1;
    for (const d of day.deviations) {
      deviationCountByMacro[d.key] += 1;
      totalDeviations += 1;
    }
  }

  const weekStart = rows[0]?.dateKey;
  const weekEnd = rows[rows.length - 1]?.dateKey;
  const weekRangeMeta =
    weekStart && weekEnd
      ? `${formatRangeShort(weekStart, weekEnd)} · pn→dziś`
      : `${weekLabel} · pn→dziś`;

  return {
    todayKey,
    weekLabel,
    weekRangeMeta,
    today,
    period: {
      state: daysWithEntries > 0 ? "evaluated" : "no_data",
      daysWithEntries,
      daysInWeek,
      macros: periodRaw.macros,
    },
    pastDays,
    trendDays: buildTrendDays(rows, todayKey),
    deviationCountByMacro,
    totalDeviations,
    daysWithDeviations,
    goalsAnnotation:
      "Cele wg aktualnego planu żywieniowego (historia nie jest zamrażana).",
  };
}

function formatRangeShort(start: string, end: string): string {
  try {
    const a = new Intl.DateTimeFormat("pl-PL", {
      day: "numeric",
      month: "short",
    }).format(new Date(`${start}T12:00:00`));
    const b = new Intl.DateTimeFormat("pl-PL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(`${end}T12:00:00`));
    return `${a}–${b}`;
  } catch {
    return `${start}–${end}`;
  }
}

export function formatSignedAmount(
  n: number | null,
  unit: "g" | "kcal",
): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const r = Math.round(n);
  const sign = r > 0 ? "+" : "";
  return `${sign}${r} ${unit}`;
}

export function formatSignedPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const r = Math.round(n);
  if (r === 0) return "0%";
  return r > 0 ? `+${r}%` : `${r}%`;
}

export function formatPlNumber(n: number): string {
  return Math.round(n).toLocaleString("pl-PL");
}

export function plOdchylenia(n: number): string {
  if (n === 1) return "1 odchylenie";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${n} odchylenia`;
  }
  return `${n} odchyleń`;
}
