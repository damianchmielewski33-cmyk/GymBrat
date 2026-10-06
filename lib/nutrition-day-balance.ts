import type { WeekDayNutritionRow } from "@/lib/week-nutrition-rows";
import {
  adherencePct,
  type MacroKey,
} from "@/lib/nutrition-week-stats";

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
};

export type DayMacroBalance = {
  dateKey: string;
  headline: string;
  isToday: boolean;
  hasFood: boolean;
  macros: MacroBalance[];
  /** Tylko odchylenia (brak / nadwyżka) — do listy skrótów. */
  highlights: MacroBalance[];
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
 * Próg „w normie”: |Δ%| ≤ 5 pp albo |Δ| poniżej 1 jednostki (g/kcal).
 * Dzięki temu drobne zaokrąglenia nie krzyczą na liście.
 */
export function classifyMacroBalance(
  delta: number | null,
  deltaPct: number | null,
): MacroBalance["status"] {
  if (delta == null || deltaPct == null) return "no_goal";
  if (Math.abs(delta) < 1 || Math.abs(deltaPct) <= 5) return "on_track";
  return delta > 0 ? "surplus" : "deficit";
}

export function buildMacroBalance(
  consumed: number,
  goal: number | null,
  meta: { key: MacroKey; label: string; unit: "g" | "kcal" },
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
    };
  }
  const delta = safeConsumed - goal;
  const pct = adherencePct(safeConsumed, goal);
  const deltaPct =
    pct == null ? null : Math.round((safeConsumed / goal - 1) * 100);
  return {
    key: meta.key,
    label: meta.label,
    unit: meta.unit,
    consumed: safeConsumed,
    goal,
    delta,
    adherencePct: pct,
    deltaPct,
    status: classifyMacroBalance(delta, deltaPct),
  };
}

export function buildDayMacroBalance(
  row: WeekDayNutritionRow,
  todayKey: string,
): DayMacroBalance {
  const macros = MACRO_META.map((meta) => {
    const { consumed, goal } = dayConsumedGoal(row, meta.key);
    return buildMacroBalance(consumed, goal, meta);
  });
  const hasFood = macros.some((m) => m.consumed > 0);
  const highlights = macros.filter(
    (m) => m.status === "deficit" || m.status === "surplus",
  );
  return {
    dateKey: row.dateKey,
    headline: row.headline,
    isToday: row.dateKey === todayKey,
    hasFood,
    macros,
    highlights,
  };
}

/** Dni od poniedziałku do dziś (włącznie), bez przyszłości. */
export function daysThroughToday(
  rows: WeekDayNutritionRow[],
  todayKey: string,
): WeekDayNutritionRow[] {
  return rows.filter((r) => r.dateKey <= todayKey);
}

export function buildDaysMacroBalance(
  rows: WeekDayNutritionRow[],
  todayKey: string,
): DayMacroBalance[] {
  return daysThroughToday(rows, todayKey).map((r) =>
    buildDayMacroBalance(r, todayKey),
  );
}

/** Suma spożycia i celów pn→dziś (tylko dni z celem dla danego makro). */
export function buildPeriodMacroBalance(
  rows: WeekDayNutritionRow[],
  todayKey: string,
): PeriodMacroBalance {
  const past = daysThroughToday(rows, todayKey);
  let daysCounted = 0;
  for (const row of past) {
    if (MACRO_META.some((m) => dayConsumedGoal(row, m.key).goal != null)) {
      daysCounted += 1;
    } else if (MACRO_META.some((m) => dayConsumedGoal(row, m.key).consumed > 0)) {
      daysCounted += 1;
    }
  }

  const macros = MACRO_META.map((meta) => {
    let consumed = 0;
    let goalSum = 0;
    let withGoal = 0;
    for (const row of past) {
      const m = dayConsumedGoal(row, meta.key);
      if (m.goal == null || !(m.goal > 0)) continue;
      withGoal += 1;
      goalSum += m.goal;
      consumed += Number.isFinite(m.consumed) ? m.consumed : 0;
    }
    return buildMacroBalance(
      consumed,
      withGoal > 0 ? goalSum : null,
      meta,
    );
  });

  return {
    macros,
    highlights: macros.filter(
      (m) => m.status === "deficit" || m.status === "surplus",
    ),
    daysCounted,
  };
}

/** Skróty „brak / za dużo” z dni pn→dziś — najpierw dziś, potem wstecz. */
export function collectDayHighlights(
  days: DayMacroBalance[],
): { day: DayMacroBalance; macro: MacroBalance }[] {
  const ordered = [...days].sort((a, b) => {
    if (a.isToday !== b.isToday) return a.isToday ? -1 : 1;
    return b.dateKey.localeCompare(a.dateKey);
  });
  const out: { day: DayMacroBalance; macro: MacroBalance }[] = [];
  for (const day of ordered) {
    if (!day.hasFood && day.highlights.length === 0) continue;
    for (const macro of day.highlights) {
      out.push({ day, macro });
    }
  }
  return out;
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

export function dayRelativeLabel(
  day: DayMacroBalance,
  todayKey: string,
): string {
  if (day.isToday) return "Dziś";
  const y = new Date(`${todayKey}T12:00:00`);
  y.setDate(y.getDate() - 1);
  const yKey = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
  if (day.dateKey === yKey) return "Wczoraj";
  try {
    return new Intl.DateTimeFormat("pl-PL", { weekday: "long" })
      .format(new Date(`${day.dateKey}T12:00:00`))
      .replace(/^./, (c) => c.toUpperCase());
  } catch {
    return day.headline;
  }
}

export function highlightVerb(status: MacroBalance["status"]): string {
  if (status === "deficit") return "brakuje";
  if (status === "surplus") return "za dużo";
  return "w normie";
}
