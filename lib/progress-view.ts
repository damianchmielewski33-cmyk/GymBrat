import type { FatigueComponentKey, FatigueSnapshot } from "@/lib/analytics/types";
import { addCalendarDays } from "@/lib/local-date";
import { mondayOfWeek } from "@/lib/progress-hub-helpers";

/** Czyste funkcje widoków Analizy (wykresy, zakresy, progres tydzień po tygodniu). */

export type ChartRange = "1M" | "3M" | "6M" | "all";

export const CHART_RANGES: ReadonlyArray<{ id: ChartRange; label: string; days: number | null }> = [
  { id: "1M", label: "1M", days: 30 },
  { id: "3M", label: "3M", days: 90 },
  { id: "6M", label: "6M", days: 180 },
  { id: "all", label: "Całość", days: null },
];

export type DatedValue = { date: string; value: number };

/** Punkty z ostatnich N dni (włącznie z dniem `today`). `all` zwraca wszystko. */
export function filterByRange<T extends { date: string }>(
  points: readonly T[],
  range: ChartRange,
  today: string,
): T[] {
  const days = CHART_RANGES.find((r) => r.id === range)?.days ?? null;
  if (days == null) return [...points];
  const cutoff = addCalendarDays(today, -(days - 1));
  return points.filter((p) => p.date >= cutoff);
}

export type ChartPoint = { x: number; y: number };

export type ChartModel = {
  points: ChartPoint[];
  line: string;
  area: string;
  grid: Array<{ y: number; value: number }>;
  min: number;
  max: number;
  yOf: (value: number) => number;
};

export const CHART_BOX = { width: 340, height: 170, left: 40, right: 334, top: 40, bottom: 148 } as const;

/** Gładka krzywa Catmull-Rom → Bézier przez wszystkie punkty. */
export function smoothPath(p: readonly ChartPoint[]): string {
  if (p.length === 0) return "";
  const f = (n: number) => n.toFixed(1);
  let d = `M${f(p[0]!.x)},${f(p[0]!.y)}`;
  if (p.length === 1) return d;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] ?? p[i]!;
    const b = p[i]!;
    const c = p[i + 1]!;
    const e = p[i + 2] ?? c;
    d += ` C${f(b.x + (c.x - a.x) / 6)},${f(b.y + (c.y - a.y) / 6)} ${f(c.x - (e.x - b.x) / 6)},${f(c.y - (e.y - b.y) / 6)} ${f(c.x)},${f(c.y)}`;
  }
  return d;
}

/**
 * Model wykresu liniowego. Punkty rozłożone równomiernie w czasie kolejnych pomiarów.
 * `include` poszerza oś Y (np. cel wagi), żeby linia celu zawsze była widoczna.
 */
export function buildChartModel(values: readonly number[], include: readonly number[] = []): ChartModel {
  const { left, right, top, bottom } = CHART_BOX;
  const all = [...values, ...include].filter((v) => Number.isFinite(v));
  const lo = all.length ? Math.min(...all) : 0;
  const hi = all.length ? Math.max(...all) : 1;
  const pad = Math.max((hi - lo) * 0.08, hi === lo ? 1 : 0);
  const min = lo - pad;
  const max = hi + pad;
  const span = max - min || 1;
  const yOf = (v: number) => bottom - ((v - min) / span) * (bottom - top);
  const n = values.length;
  const step = n > 1 ? (right - left) / (n - 1) : 0;
  const points = values.map((v, i) => ({
    x: n > 1 ? left + i * step : (left + right) / 2,
    y: yOf(v),
  }));
  const line = smoothPath(points);
  const area =
    points.length > 1
      ? `${line} L${points[n - 1]!.x.toFixed(1)},${bottom} L${points[0]!.x.toFixed(1)},${bottom} Z`
      : "";
  const grid = [0, 1, 2, 3].map((i) => {
    const value = max - (i * span) / 3;
    return { y: yOf(value), value };
  });
  return { points, line, area, grid, min, max, yOf };
}

/** Indeks punktu najbliższego pozycji x (w układzie viewBox 340 px). */
export function nearestPointIndex(x: number, count: number): number {
  if (count <= 1) return 0;
  const { left, right } = CHART_BOX;
  const step = (right - left) / (count - 1);
  return Math.max(0, Math.min(count - 1, Math.round((x - left) / step)));
}

/** Najlepszy szacowany max z każdego tygodnia (poniedziałek → wartość), tylko tygodnie z danymi. */
export function weeklyBestE1rm(
  history: ReadonlyArray<{ date: string; bestE1rm: number }>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of history) {
    if (!(p.bestE1rm > 0)) continue;
    const monday = mondayOfWeek(p.date);
    out.set(monday, Math.max(out.get(monday) ?? 0, p.bestE1rm));
  }
  return out;
}

export type WeeklyProgressCell = { monday: string; value: number | null; delta: number | null };

/**
 * Seria tydzień po tygodniu dla listy poniedziałków (od najstarszego).
 * Zmiana liczona względem ostatniego wcześniejszego tygodnia z danymi,
 * żeby przerwa w treningach nie udawała spadku.
 */
export function weeklyProgressSeries(
  history: ReadonlyArray<{ date: string; bestE1rm: number }>,
  mondays: readonly string[],
): WeeklyProgressCell[] {
  const best = weeklyBestE1rm(history);
  const earlier = [...best.keys()].sort();
  const cells: WeeklyProgressCell[] = [];
  let last: number | null = null;
  // Ostatnia wartość sprzed okna – baza dla pierwszej komórki.
  if (mondays.length) {
    const before = earlier.filter((m) => m < mondays[0]!);
    if (before.length) last = best.get(before[before.length - 1]!) ?? null;
  }
  for (const monday of mondays) {
    const value = best.get(monday) ?? null;
    const delta = value != null && last != null ? Math.round((value - last) * 10) / 10 : null;
    cells.push({ monday, value, delta });
    if (value != null) last = value;
  }
  return cells;
}

export type ExerciseStatus = "up" | "flat" | "down";

export type ExerciseChange = {
  status: ExerciseStatus;
  /** Zmiana szacowanego maxa w kg względem poprzedniego okna; null bez porównania. */
  deltaKg: number | null;
  currentE1rm: number | null;
};

/**
 * Rośnie / stoi / spada: najlepszy szacowany max z ostatnich `days` dni
 * kontra najlepszy z poprzednich `days` dni. Zmiana poniżej 1% = „stoi”.
 * Gdy poprzednie okno jest puste, porównuje z najstarszym punktem okna.
 */
export function exerciseChange(
  history: ReadonlyArray<{ date: string; bestE1rm: number }>,
  today: string,
  days = 30,
): ExerciseChange {
  const pts = history.filter((p) => p.bestE1rm > 0);
  const cut1 = addCalendarDays(today, -(days - 1));
  const cut0 = addCalendarDays(today, -(2 * days - 1));
  const cur = pts.filter((p) => p.date >= cut1);
  const prev = pts.filter((p) => p.date >= cut0 && p.date < cut1);
  const currentE1rm = pts.length ? pts[pts.length - 1]!.bestE1rm : null;
  if (!cur.length) return { status: "flat", deltaKg: null, currentE1rm };
  const curBest = Math.max(...cur.map((p) => p.bestE1rm));
  let base: number | null = null;
  if (prev.length) base = Math.max(...prev.map((p) => p.bestE1rm));
  else if (cur.length > 1) base = cur[0]!.bestE1rm;
  if (base == null || base <= 0) return { status: "flat", deltaKg: null, currentE1rm };
  const deltaKg = Math.round((curBest - base) * 10) / 10;
  const pct = ((curBest - base) / base) * 100;
  const status: ExerciseStatus = pct >= 1 ? "up" : pct <= -1 ? "down" : "flat";
  return { status, deltaKg, currentE1rm };
}

/** Szacowany max z jednej serii. */
export function setE1rm(weight: number, reps: number): number {
  if (!(weight > 0) || !(reps > 0)) return 0;
  return weight * (1 + Math.min(reps, 12) / 30);
}

export const FATIGUE_COMPONENT_LABEL: Record<FatigueComponentKey, string> = {
  tonnage: "Tonaż tygodnia",
  trend: "Trend w tygodniu",
  hardSets: "Ciężkie serie",
  rpe: "Wysiłek (RPE)",
  sessions: "Liczba treningów",
  cardio: "Cardio",
  streak: "Dni treningowe z rzędu",
};

const fmt = (n: number, d = 0) =>
  n.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Jednozdaniowe wyjaśnienie składnika zmęczenia na podstawie danych wejściowych silnika. */
export function fatigueComponentWhy(key: FatigueComponentKey, f: FatigueSnapshot): string {
  const i = f.inputs;
  switch (key) {
    case "tonnage":
      return f.baselineWeeks < 2
        ? `${fmt(i.weeklyTonnageKg)} kg w ostatnich 7 dniach. Twoja norma opiera się na ${f.baselineWeeks} tyg. historii, więc ta ocena jest przybliżona.`
        : `${fmt(i.weeklyTonnageKg)} kg w ostatnich 7 dniach, porównane ze średnią z ${f.baselineWeeks} poprzednich tygodni.`;
    case "trend":
      return i.tonnageTrendPct == null
        ? "Za mało treningów w tygodniu, żeby porównać jego dwie połowy (potrzeba 3 dni treningowych)."
        : `Druga połowa tygodnia ${i.tonnageTrendPct >= 0 ? "cięższa" : "lżejsza"} o ${fmt(Math.abs(i.tonnageTrendPct))}%.`;
    case "hardSets":
      return i.hardSetPct == null
        ? "Brak zapisanego RIR lub RPE przy seriach, więc ten składnik to 0 punktów."
        : `${fmt(i.hardSetPct)}% serii kończysz blisko porażki.`;
    case "rpe":
      return i.avgRpe == null
        ? "Brak wpisów RPE (trudność serii 1–10), więc ten składnik to 0 punktów."
        : `Średnio ${fmt(i.avgRpe, 1)} z 10.`;
    case "sessions":
      return `${i.sessionsThisWeek} ${i.sessionsThisWeek === 1 ? "trening" : "treningi"} w ostatnich 7 dniach. Punkty liczą się od 5 treningów.`;
    case "cardio":
      return `Obciążenie cardio w tym tygodniu: ${fmt(i.cardioLoad)}.`;
    case "streak":
      return `${i.consecutiveTrainingDays} dni treningowych z rzędu. Punkty liczą się od 3.`;
  }
}

export function fatigueMissingNote(missing: FatigueSnapshot["missingInputs"]): string | null {
  if (!missing.length) return null;
  const names = missing.map((m) => (m === "rpe" ? "RPE" : "RIR/RPE przy seriach"));
  return `Brakuje danych: ${names.join(" i ")}. Te składniki liczą się jako 0 punktów, więc wynik może być zaniżony.`;
}

/** „Jak dziś możesz trenować” – jedno zdanie z pasma zmęczenia. */
export function fatigueBandCaption(band: FatigueSnapshot["band"]): string {
  switch (band) {
    case "fresh":
      return "Jesteś wypoczęty, to dobry dzień na ciężki trening.";
    case "normal":
      return "Obciążenie jest normalne, trenuj według planu.";
    case "fatigued":
      return "Obciążenie jest wysokie, rozważ lżejszy trening.";
    case "overreached":
      return "Obciążenie jest bardzo wysokie, daj sobie odpocząć.";
  }
}
