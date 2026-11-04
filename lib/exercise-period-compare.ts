/**
 * Porównania okresów dla jednego ćwiczenia: tydzień / miesiąc / 3 miesiące
 * (kwartał kalendarzowy) / rok oraz zakres dowolny (vs poprzedni okres tej
 * samej długości).
 * Źródło: punkty z getExerciseProgressSeries (sesje dzienne).
 */

import {
  addCalendarDays,
  calendarDateKey,
  daysBetweenDateKeys,
  parseDateKey,
  weekDateKeysMondayFirst,
} from "@/lib/local-date";
import type {
  ExerciseMetricKind,
  ExerciseProgressPoint,
} from "@/lib/exercise-progress";

export type ExercisePeriodKind = "week" | "month" | "quarter" | "year";

/** Rodzaj porównania: okres kalendarzowy albo zakres wybrany przez użytkownika. */
export type ExerciseCompareKind = ExercisePeriodKind | "range";

/** Minimalna liczba sesji w okresie, by wynik uznać za wiarygodny. */
export const MIN_RELIABLE_SESSIONS = 2;

/** Maks. długość zakresu dowolnego (dni) — chroni przed absurdalnymi wejściami. */
export const MAX_RANGE_DAYS = 800;

export type ExercisePeriodOutcome =
  | "progress"
  | "regress"
  | "flat"
  | "none";

export type ExercisePeriodMetric = {
  key:
    | "sessions"
    | "bestE1rm"
    | "maxWeight"
    | "avgVolume"
    | "totalVolume"
    | "avgRir"
    | "avgRpe";
  label: string;
  unit: string;
  current: number | null;
  previous: number | null;
  deltaAbs: number | null;
  deltaPct: number | null;
  outcome: ExercisePeriodOutcome;
  higherIsBetter: boolean;
};

export type ExercisePeriodSeriesPoint = {
  key: string;
  label: string;
  /** Główna metryka (e1RM / objętość / powt.). */
  value: number;
  /** % vs poprzedni bucket w serii (null = brak bazy). */
  deltaPct: number | null;
  sessions: number;
};

export type ExercisePeriodCompare = {
  kind: ExerciseCompareKind;
  currentLabel: string;
  previousLabel: string;
  metrics: ExercisePeriodMetric[];
  /** Ostatnie buckety do wykresu % (najstarszy → najnowszy). */
  series: ExercisePeriodSeriesPoint[];
  rising: ExercisePeriodMetric[];
  falling: ExercisePeriodMetric[];
  verdict: "progress" | "regress" | "flat" | "insufficient";
  verdictLabel: string;
  /**
   * true, gdy w bieżącym lub poprzednim okresie jest mniej niż
   * MIN_RELIABLE_SESSIONS sesji — wynik jest szumny (np. jedna słaba sesja).
   */
  lowConfidence: boolean;
};

export type ExercisePeriodCompares = {
  week: ExercisePeriodCompare;
  month: ExercisePeriodCompare;
  quarter: ExercisePeriodCompare;
  year: ExercisePeriodCompare;
};

type BucketAgg = {
  key: string;
  label: string;
  sessions: number;
  e1rms: number[];
  weights: number[];
  volumes: number[];
  totalVolume: number;
  rirs: number[];
  rpes: number[];
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return round1(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function maxOf(nums: number[]): number | null {
  if (!nums.length) return null;
  return round1(Math.max(...nums));
}

function mondayKey(dateKey: string): string {
  return weekDateKeysMondayFirst(dateKey)[0]!;
}

function monthKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

function yearKey(dateKey: string): string {
  return dateKey.slice(0, 4);
}

function weekLabel(monday: string): string {
  const sun = addCalendarDays(monday, 6);
  const a = new Date(`${monday}T12:00:00`);
  const b = new Date(`${sun}T12:00:00`);
  const fmt = (d: Date) =>
    d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  return `${fmt(a)}–${fmt(b)}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
  return d.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
}

function yearLabel(y: string): string {
  return y;
}

const QUARTER_ROMAN = ["I", "II", "III", "IV"] as const;

/** Klucz kwartału kalendarzowego `YYYY-Qn` (sortuje się leksykograficznie). */
function quarterKey(dateKey: string): string {
  const month = Number(dateKey.slice(5, 7));
  const q = Math.min(4, Math.max(1, Math.ceil(month / 3)));
  return `${dateKey.slice(0, 4)}-Q${q}`;
}

function quarterLabel(key: string): string {
  const [y, q] = key.split("-Q");
  const idx = Math.min(4, Math.max(1, Number(q))) - 1;
  return `${QUARTER_ROMAN[idx]} kw. ${y}`;
}

function volumeOf(
  p: ExerciseProgressPoint,
  metric: ExerciseMetricKind,
): number {
  return metric === "reps" ? p.totalReps : p.tonnageKg;
}

function bucketKeyFor(
  date: string,
  kind: ExercisePeriodKind,
): { key: string; label: string } {
  if (kind === "week") {
    const mon = mondayKey(date);
    return { key: mon, label: weekLabel(mon) };
  }
  if (kind === "month") {
    const k = monthKey(date);
    return { key: k, label: monthLabel(k) };
  }
  if (kind === "quarter") {
    const k = quarterKey(date);
    return { key: k, label: quarterLabel(k) };
  }
  const k = yearKey(date);
  return { key: k, label: yearLabel(k) };
}

function newBucket(key: string, label: string): BucketAgg {
  return {
    key,
    label,
    sessions: 0,
    e1rms: [],
    weights: [],
    volumes: [],
    totalVolume: 0,
    rirs: [],
    rpes: [],
  };
}

function addPointToBucket(
  b: BucketAgg,
  p: ExerciseProgressPoint,
  metric: ExerciseMetricKind,
): void {
  b.sessions += 1;
  if (p.bestE1rm > 0) b.e1rms.push(p.bestE1rm);
  if (p.bestWeight > 0) b.weights.push(p.bestWeight);
  const vol = volumeOf(p, metric);
  if (vol > 0) {
    b.volumes.push(vol);
    b.totalVolume += vol;
  }
  if (p.avgRir != null) b.rirs.push(p.avgRir);
  if (p.avgRpe != null) b.rpes.push(p.avgRpe);
}

function aggregateBuckets(
  points: ExerciseProgressPoint[],
  kind: ExercisePeriodKind,
  metric: ExerciseMetricKind,
): BucketAgg[] {
  const map = new Map<string, BucketAgg>();
  for (const p of points) {
    const { key, label } = bucketKeyFor(p.date, kind);
    let b = map.get(key);
    if (!b) {
      b = newBucket(key, label);
      map.set(key, b);
    }
    addPointToBucket(b, p, metric);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return round1(((current - previous) / Math.abs(previous)) * 100);
}

function outcomeOf(
  current: number | null,
  previous: number | null,
  higherIsBetter: boolean,
): ExercisePeriodOutcome {
  if (current == null || previous == null) return "none";
  const pct = deltaPct(current, previous);
  if (pct == null) return "none";
  if (Math.abs(pct) < 3) return "flat";
  const up = pct > 0;
  if (higherIsBetter) return up ? "progress" : "regress";
  return up ? "regress" : "progress";
}

function buildMetricRow(
  key: ExercisePeriodMetric["key"],
  label: string,
  unit: string,
  current: number | null,
  previous: number | null,
  higherIsBetter: boolean,
): ExercisePeriodMetric {
  const deltaAbs =
    current != null && previous != null ? round1(current - previous) : null;
  const pct =
    current != null && previous != null ? deltaPct(current, previous) : null;
  return {
    key,
    label,
    unit,
    current,
    previous,
    deltaAbs,
    deltaPct: pct,
    outcome: outcomeOf(current, previous, higherIsBetter),
    higherIsBetter,
  };
}

function primaryValue(
  b: BucketAgg,
  metric: ExerciseMetricKind,
): number {
  if (metric === "reps") {
    return avg(b.volumes) ?? 0;
  }
  // Preferuj średnie e1RM; fallback objętość sesji
  return avg(b.e1rms) ?? avg(b.volumes) ?? 0;
}

const VERDICT_LABELS: Record<
  ExerciseCompareKind,
  { insufficient: string; flat: string; up: string; down: string }
> = {
  week: {
    insufficient: "Za mało danych do porównania tygodni",
    flat: "Tydzień do tygodnia bez wyraźnej zmiany",
    up: "Wynik wyższy niż w poprzednim tygodniu",
    down: "Wynik niższy niż w poprzednim tygodniu",
  },
  month: {
    insufficient: "Za mało danych do porównania miesięcy",
    flat: "Miesiąc do miesiąca bez wyraźnej zmiany",
    up: "Wynik wyższy niż w poprzednim miesiącu",
    down: "Wynik niższy niż w poprzednim miesiącu",
  },
  quarter: {
    insufficient: "Za mało danych do porównania kwartałów",
    flat: "Kwartał do kwartału bez wyraźnej zmiany",
    up: "Wynik wyższy niż w poprzednim kwartale",
    down: "Wynik niższy niż w poprzednim kwartale",
  },
  year: {
    insufficient: "Za mało danych do porównania lat",
    flat: "Rok do roku bez wyraźnej zmiany",
    up: "Wynik wyższy niż w poprzednim roku",
    down: "Wynik niższy niż w poprzednim roku",
  },
  range: {
    insufficient: "Za mało danych do porównania wybranych okresów",
    flat: "Okres do okresu bez wyraźnej zmiany",
    up: "Wynik wyższy niż w poprzednim okresie",
    down: "Wynik niższy niż w poprzednim okresie",
  },
};

function emptyCompare(kind: ExerciseCompareKind): ExercisePeriodCompare {
  return {
    kind,
    currentLabel: "—",
    previousLabel: "—",
    metrics: [],
    series: [],
    rising: [],
    falling: [],
    verdict: "insufficient",
    verdictLabel: VERDICT_LABELS[kind].insufficient,
    lowConfidence: false,
  };
}

function buildSeries(
  seriesBuckets: BucketAgg[],
  metric: ExerciseMetricKind,
): ExercisePeriodSeriesPoint[] {
  return seriesBuckets.map((b, i) => {
    const value = round1(primaryValue(b, metric));
    const prev = i > 0 ? seriesBuckets[i - 1]! : null;
    const prevVal = prev ? primaryValue(prev, metric) : null;
    return {
      key: b.key,
      label: b.label,
      value,
      deltaPct:
        prevVal != null && prevVal > 0 ? deltaPct(value, prevVal) : null,
      sessions: b.sessions,
    };
  });
}

function buildCompare(
  kind: ExercisePeriodKind,
  buckets: BucketAgg[],
  metric: ExerciseMetricKind,
): ExercisePeriodCompare {
  if (buckets.length === 0) return emptyCompare(kind);

  const seriesLimit = kind === "week" ? 8 : kind === "month" ? 6 : 4;
  const series = buildSeries(buckets.slice(-seriesLimit), metric);
  const current = buckets[buckets.length - 1]!;
  const previous = buckets.length >= 2 ? buckets[buckets.length - 2]! : null;

  return composeCompare(kind, current, previous, series, metric);
}

/** Wspólny rdzeń: metryki, werdykt i flaga wiarygodności dla pary okresów. */
function composeCompare(
  kind: ExerciseCompareKind,
  current: BucketAgg,
  previous: BucketAgg | null,
  series: ExercisePeriodSeriesPoint[],
  metric: ExerciseMetricKind,
): ExercisePeriodCompare {
  const empty = emptyCompare(kind);
  const lowConfidence =
    previous != null &&
    (current.sessions < MIN_RELIABLE_SESSIONS ||
      previous.sessions < MIN_RELIABLE_SESSIONS);

  const volumeUnit = metric === "reps" ? "powt." : "kg";
  const volumeLabel =
    metric === "reps" ? "Śr. powtórzeń / sesja" : "Śr. objętość / sesja";
  const totalLabel =
    metric === "reps" ? "Suma powtórzeń" : "Suma objętości";

  const metrics: ExercisePeriodMetric[] = [
    buildMetricRow(
      "sessions",
      "Sesje",
      "",
      current.sessions,
      previous?.sessions ?? null,
      true,
    ),
  ];

  if (metric === "kg") {
    metrics.push(
      buildMetricRow(
        "bestE1rm",
        "Śr. e1RM",
        "kg",
        avg(current.e1rms),
        previous ? avg(previous.e1rms) : null,
        true,
      ),
      buildMetricRow(
        "maxWeight",
        "Max ciężar",
        "kg",
        maxOf(current.weights),
        previous ? maxOf(previous.weights) : null,
        true,
      ),
    );
  }

  metrics.push(
    buildMetricRow(
      "avgVolume",
      volumeLabel,
      volumeUnit,
      avg(current.volumes),
      previous ? avg(previous.volumes) : null,
      true,
    ),
    buildMetricRow(
      "totalVolume",
      totalLabel,
      volumeUnit,
      round1(current.totalVolume) || null,
      previous ? round1(previous.totalVolume) || null : null,
      true,
    ),
    buildMetricRow(
      "avgRir",
      "Śr. RIR",
      "",
      avg(current.rirs),
      previous ? avg(previous.rirs) : null,
      false,
    ),
    buildMetricRow(
      "avgRpe",
      "Śr. RPE",
      "",
      avg(current.rpes),
      previous ? avg(previous.rpes) : null,
      true,
    ),
  );

  const rising = metrics.filter((m) => m.outcome === "progress");
  const falling = metrics.filter((m) => m.outcome === "regress");
  const scored = [...rising, ...falling];

  if (!previous || scored.length === 0) {
    return {
      ...empty,
      currentLabel: current.label,
      previousLabel: previous?.label ?? "—",
      metrics,
      series,
      rising,
      falling,
      lowConfidence,
    };
  }

  const labels = VERDICT_LABELS[kind];
  let verdict: ExercisePeriodCompare["verdict"] = "flat";
  let verdictLabel = labels.flat;

  if (rising.length > falling.length) {
    verdict = "progress";
    verdictLabel = labels.up;
  } else if (falling.length > rising.length) {
    verdict = "regress";
    verdictLabel = labels.down;
  }

  return {
    kind,
    currentLabel: current.label,
    previousLabel: previous.label,
    metrics,
    series,
    rising,
    falling,
    verdict,
    verdictLabel,
    lowConfidence,
  };
}

export function buildExercisePeriodCompares(
  points: ExerciseProgressPoint[],
  metric: ExerciseMetricKind,
): ExercisePeriodCompares {
  const weekBuckets = aggregateBuckets(points, "week", metric);
  const monthBuckets = aggregateBuckets(points, "month", metric);
  const quarterBuckets = aggregateBuckets(points, "quarter", metric);
  const yearBuckets = aggregateBuckets(points, "year", metric);

  return {
    week: buildCompare("week", weekBuckets, metric),
    month: buildCompare("month", monthBuckets, metric),
    quarter: buildCompare("quarter", quarterBuckets, metric),
    year: buildCompare("year", yearBuckets, metric),
  };
}

export type ExerciseCompareRange = {
  /** Początek zakresu (YYYY-MM-DD, włącznie). */
  from: string;
  /** Koniec zakresu (YYYY-MM-DD, włącznie). */
  to: string;
  /** Długość zakresu w dniach kalendarzowych (włącznie z oboma końcami). */
  days: number;
};

function isValidDateKey(key: string): boolean {
  return parseDateKey(key) != null && addCalendarDays(key, 0) === key;
}

/**
 * Waliduje zakres dowolny. Zwraca `null` dla złego formatu/nieistniejącej daty,
 * odwróconego zakresu (od > do) albo zakresu dłuższego niż MAX_RANGE_DAYS.
 */
export function normalizeCompareRange(
  from: string,
  to: string,
): ExerciseCompareRange | null {
  if (!isValidDateKey(from) || !isValidDateKey(to)) return null;
  if (from > to) return null;
  const days = daysBetweenDateKeys(from, to) + 1;
  if (days < 1 || days > MAX_RANGE_DAYS) return null;
  return { from, to, days };
}

function formatRangeLabel(from: string, to: string): string {
  const fmt = (key: string) => {
    const d = new Date(`${key}T12:00:00`);
    return d.toLocaleDateString("pl-PL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };
  return `${fmt(from)} – ${fmt(to)}`;
}

/**
 * Porównanie zakresu dowolnego z poprzednim zakresem tej samej długości
 * (kończącym się dzień przed `from`). Seria = tygodnie obejmujące oba okresy.
 */
export function buildExerciseRangeCompare(
  points: ExerciseProgressPoint[],
  metric: ExerciseMetricKind,
  from: string,
  to: string,
): ExercisePeriodCompare {
  const range = normalizeCompareRange(from, to);
  if (!range) return emptyCompare("range");

  const prevTo = addCalendarDays(range.from, -1);
  const prevFrom = addCalendarDays(range.from, -range.days);

  const current = newBucket("current", formatRangeLabel(range.from, range.to));
  const previous = newBucket("previous", formatRangeLabel(prevFrom, prevTo));
  const seriesPoints: ExerciseProgressPoint[] = [];

  for (const p of points) {
    if (p.date >= range.from && p.date <= range.to) {
      addPointToBucket(current, p, metric);
      seriesPoints.push(p);
    } else if (p.date >= prevFrom && p.date <= prevTo) {
      addPointToBucket(previous, p, metric);
      seriesPoints.push(p);
    }
  }

  if (current.sessions === 0 && previous.sessions === 0) {
    return emptyCompare("range");
  }

  const weekly = aggregateBuckets(seriesPoints, "week", metric).slice(-12);
  const series = buildSeries(weekly, metric);

  // Brak sesji w jednym z okresów = brak bazy porównania (nie „zerowy wynik”).
  if (current.sessions === 0 || previous.sessions === 0) {
    return {
      ...emptyCompare("range"),
      currentLabel: current.label,
      previousLabel: previous.label,
      series,
    };
  }

  return composeCompare("range", current, previous, series, metric);
}

/** Etykieta skrócona na osi X wykresu. */
export function shortPeriodAxisLabel(
  kind: ExercisePeriodKind,
  key: string,
): string {
  if (kind === "year") return key;
  if (kind === "quarter") {
    const [y, q] = key.split("-");
    return `${q ?? ""} '${y?.slice(2) ?? ""}`;
  }
  if (kind === "month") {
    const [y, m] = key.split("-");
    return `${m}.${y?.slice(2) ?? ""}`;
  }
  // week key = monday YYYY-MM-DD
  const d = new Date(`${key}T12:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

export function formatPeriodDeltaPct(pct: number | null): string {
  if (pct == null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}%`;
}

/** Dzisiaj w kalendarzu app — do testów / etykiet. */
export function exerciseCompareTodayKey(): string {
  return calendarDateKey();
}
