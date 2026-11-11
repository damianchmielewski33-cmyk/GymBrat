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
  /** Wszystkie makro dnia (do wykresu z przełącznikiem makro). */
  macros: Record<MacroKey, TrendMacro>;
  dayType: NutritionDayType;
};

export type TrendMacro = {
  consumed: number;
  goal: number | null;
  pct: number | null;
  status: MacroBalance["status"];
};

/** Średnia dzienna z dni zamkniętych z wpisami (bez dnia w toku). */
export type WeekAverage = {
  key: MacroKey;
  label: string;
  unit: "g" | "kcal";
  avgConsumed: number;
  avgGoal: number | null;
  /** avgConsumed − avgGoal */
  avgDelta: number | null;
  pct: number | null;
  status: MacroBalance["status"];
  /** Dni zamknięte, w których cel został przekroczony / niedobór / norma. */
  daysOver: number;
  daysUnder: number;
  daysOk: number;
  daysCounted: number;
};

/** Skąd bierze się różnica kcal: wkład makro w nadwyżkę/niedobór. */
export type KcalDriver = {
  key: Exclude<MacroKey, "calories">;
  label: string;
  /** kcal wynikające z różnicy gramów (białko/węgle ×4, tłuszcz ×9). */
  kcal: number;
  grams: number;
};

export type WeekInsight = {
  tone: "good" | "warn" | "info";
  text: string;
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
  /** Dzień do porównania (ostatni zamknięty z wpisami) + średnie dzienne. */
  weekAverages: WeekAverage[];
  insights: WeekInsight[];
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

    const macros = {} as Record<MacroKey, TrendMacro>;
    for (const meta of MACRO_META) {
      const { consumed: c, goal: g } = dayConsumedGoal(row, meta.key);
      const b = buildMacroBalance(c, g, meta);
      macros[meta.key] = {
        consumed: b.consumed,
        goal: b.goal,
        pct: b.adherencePct,
        status: b.status,
      };
    }
    return {
      macros,
      dayType: row.dayType,
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

/** Średnie dzienne z dni zamkniętych z wpisami — porównywalne z celem dziennym. */
export function buildWeekAverages(
  rows: WeekDayNutritionRow[],
  todayKey: string,
): WeekAverage[] {
  const closed = rows.filter(
    (r) => r.dateKey < todayKey && r.entryCount > 0,
  );
  return MACRO_META.map((meta) => {
    let sumC = 0;
    let sumG = 0;
    let goalDays = 0;
    let over = 0;
    let under = 0;
    let ok = 0;
    for (const r of closed) {
      const { consumed, goal } = dayConsumedGoal(r, meta.key);
      sumC += consumed;
      if (goal != null && goal > 0) {
        sumG += goal;
        goalDays += 1;
        const b = buildMacroBalance(consumed, goal, meta);
        if (b.status === "surplus") over += 1;
        else if (b.status === "deficit") under += 1;
        else ok += 1;
      }
    }
    const n = closed.length;
    const avgConsumed = n > 0 ? sumC / n : 0;
    const avgGoal = goalDays > 0 ? sumG / goalDays : null;
    const b = buildMacroBalance(avgConsumed, avgGoal, meta);
    return {
      key: meta.key,
      label: meta.label,
      unit: meta.unit,
      avgConsumed,
      avgGoal,
      avgDelta: b.delta,
      pct: b.adherencePct,
      status: n > 0 ? b.status : "no_goal",
      daysOver: over,
      daysUnder: under,
      daysOk: ok,
      daysCounted: n,
    };
  });
}

/** Wkład makro w różnicę kcal dnia (tylko makro z celem). */
export function kcalDrivers(
  macros: MacroBalance[],
): KcalDriver[] {
  const factor = { protein: 4, carbs: 4, fat: 9 } as const;
  const out: KcalDriver[] = [];
  for (const m of macros) {
    if (m.key === "calories" || m.delta == null) continue;
    out.push({
      key: m.key,
      label: m.label,
      grams: m.delta,
      kcal: Math.round(m.delta * factor[m.key]),
    });
  }
  return out;
}

const NAME_GEN: Record<MacroKey, string> = {
  calories: "kalorii",
  protein: "białka",
  carbs: "węglowodanów",
  fat: "tłuszczu",
};

/** Krótkie wnioski słowami dla tygodnia (max 3). */
export function buildWeekInsights(
  averages: WeekAverage[],
  pastDays: DayCardViewModel[],
): WeekInsight[] {
  const out: WeekInsight[] = [];
  const counted = averages[0]?.daysCounted ?? 0;
  if (counted === 0) return out;

  const kcal = averages.find((a) => a.key === "calories");
  if (kcal && kcal.avgGoal != null && kcal.avgDelta != null) {
    const d = Math.round(Math.abs(kcal.avgDelta));
    if (kcal.status === "surplus") {
      out.push({
        tone: "warn",
        text: `Średnio jesz o ${formatPlNumber(d)} kcal dziennie ponad cel (${kcal.pct}%).`,
      });
    } else if (kcal.status === "deficit") {
      out.push({
        tone: "warn",
        text: `Średnio brakuje Ci ${formatPlNumber(d)} kcal dziennie do celu (${kcal.pct}%).`,
      });
    } else {
      out.push({
        tone: "good",
        text: `Kalorie w normie: średnio ${formatPlNumber(kcal.avgConsumed)} z ${formatPlNumber(kcal.avgGoal)} kcal dziennie.`,
      });
    }
  }

  const macros = averages.filter(
    (a) => a.key !== "calories" && a.avgGoal != null && a.pct != null,
  );
  const worst = [...macros]
    .filter((a) => a.status === "surplus" || a.status === "deficit")
    .sort(
      (a, b) =>
        Math.abs((b.pct ?? 100) - 100) - Math.abs((a.pct ?? 100) - 100),
    )[0];
  if (worst) {
    const d = Math.round(Math.abs(worst.avgDelta ?? 0));
    out.push({
      tone: "warn",
      text:
        worst.status === "surplus"
          ? `Najbardziej odstaje ${NAME_GEN[worst.key]}: +${d} g dziennie ponad cel, w ${worst.daysOver} z ${worst.daysCounted} dni.`
          : `Najbardziej odstaje ${NAME_GEN[worst.key]}: −${d} g dziennie poniżej celu, w ${worst.daysUnder} z ${worst.daysCounted} dni.`,
    });
  }
  const best = [...macros]
    .filter((a) => a.status === "on_track")
    .sort((a, b) => b.daysOk - a.daysOk)[0];
  if (best) {
    out.push({
      tone: "good",
      text: `Najlepiej idzie ${NAME_GEN[best.key]}: w normie w ${best.daysOk} z ${best.daysCounted} dni.`,
    });
  } else if (pastDays.length > 0 && !worst) {
    out.push({ tone: "info", text: "Brak odchyleń w zamkniętych dniach." });
  }
  return out.slice(0, 3);
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

  const trendDays = buildTrendDays(rows, todayKey);
  const weekAverages = buildWeekAverages(rows, todayKey);

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
    trendDays,
    weekAverages,
    insights: buildWeekInsights(weekAverages, pastDays),
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
