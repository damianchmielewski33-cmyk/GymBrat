/**
 * Widok zbiorczy siły: czy w wybranym okresie siła „średnio rośnie czy spada”
 * po wszystkich ćwiczeniach i po grupach mięśniowych.
 *
 * Zasady (weryfikacja trenerska):
 * - metryka = średnie e1RM z najlepszej serii roboczej sesji (jak w panelu ćwiczenia),
 * - najpierw zmiana % per ćwiczenie, dopiero potem MEDIANA po ćwiczeniach
 *   (nigdy średnia kilogramów z różnych ćwiczeń),
 * - ćwiczenie wchodzi do indeksu tylko z min. MIN_RELIABLE_SESSIONS sesjami
 *   w obu okresach (inaczej „za mało danych”),
 * - pasmo „stabilnie” = ±STRENGTH_FLAT_BAND_PCT (spójne z panelem ćwiczenia).
 *
 * Moduł jest czysty (bez bazy i katalogu ćwiczeń) — etykiety grup dostarcza loader.
 */

import {
  MAX_RANGE_DAYS,
  MIN_RELIABLE_SESSIONS,
  buildExerciseRangeCompare,
  normalizeCompareRange,
} from "@/lib/exercise-period-compare";
import type { ExerciseProgressPoint } from "@/lib/exercise-progress";
import { addCalendarDays } from "@/lib/local-date";

export type OverviewPreset = "7" | "30" | "90" | "range";

/** Maks. zakres w widoku zbiorczym — loader czyta oba okresy (≤ 2 × tyle dni). */
export const MAX_OVERVIEW_RANGE_DAYS = Math.min(365, MAX_RANGE_DAYS);

/** Pasmo „stabilnie” dla mediany; to samo 3% co `outcomeOf` w panelu ćwiczenia. */
export const STRENGTH_FLAT_BAND_PCT = 3;

/** Poniżej tylu ćwiczeń z wiarygodnym wynikiem wynik zbiorczy jest orientacyjny. */
export const MIN_EXERCISES_FOR_CONFIDENT_INDEX = 3;

export type OverviewSeriesInput = {
  key: string;
  name: string;
  /** Id kategorii z katalogu (np. "chest") albo null poza katalogiem. */
  groupId: string | null;
  groupLabel: string;
  /** Punkty sesyjne ćwiczenia z ciężarem (bestE1rm > 0). */
  points: ExerciseProgressPoint[];
};

export type OverviewStatus = "up" | "flat" | "down" | "insufficient";

export type OverviewExerciseRow = {
  key: string;
  name: string;
  groupId: string | null;
  groupLabel: string;
  previousE1rm: number | null;
  currentE1rm: number | null;
  deltaPct: number | null;
  sessionsPrevious: number;
  sessionsCurrent: number;
  status: OverviewStatus;
};

export type OverviewGroupRow = {
  id: string;
  label: string;
  medianDeltaPct: number | null;
  status: OverviewStatus;
  up: number;
  flat: number;
  down: number;
  insufficient: number;
};

export type StrengthOverviewVerdict = "progress" | "regress" | "flat" | "insufficient";

export type StrengthOverview = {
  from: string;
  to: string;
  days: number;
  previousFrom: string;
  previousTo: string;
  /** Mediana Δ% e1RM po ćwiczeniach z wiarygodnym wynikiem. */
  indexDeltaPct: number | null;
  verdict: StrengthOverviewVerdict;
  verdictLabel: string;
  counts: { up: number; flat: number; down: number; insufficient: number };
  /** Za mało ćwiczeń z wiarygodnym wynikiem, by ufać indeksowi. */
  lowConfidence: boolean;
  groups: OverviewGroupRow[];
  exercises: OverviewExerciseRow[];
};

/** Wynik akcji serwerowej widoku zbiorczego (błąd walidacji bez rzucania wyjątku). */
export type StrengthOverviewResult =
  | { ok: true; overview: StrengthOverview }
  | { ok: false; error: string };

const OTHER_GROUP_ID = "other";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : round1((sorted[mid - 1]! + sorted[mid]!) / 2);
}

function statusOfMedian(pct: number | null): OverviewStatus {
  if (pct == null) return "insufficient";
  if (Math.abs(pct) < STRENGTH_FLAT_BAND_PCT) return "flat";
  return pct > 0 ? "up" : "down";
}

/**
 * Zakres do analizy z presetu. Presety to okna kroczące kończące się dziś
 * (7/30/90 dni vs poprzednie okno tej samej długości); „range” = własny zakres.
 * `null` gdy zakres jest niepoprawny, z przyszłości albo dłuższy niż limit.
 */
export function resolveOverviewRange(
  preset: OverviewPreset,
  today: string,
  custom?: { from?: string; to?: string },
): { from: string; to: string } | null {
  if (preset !== "range") {
    const n = Number(preset);
    return { from: addCalendarDays(today, -(n - 1)), to: today };
  }
  const range = normalizeCompareRange(custom?.from ?? "", custom?.to ?? "");
  if (!range) return null;
  if (range.to > today) return null;
  if (range.days > MAX_OVERVIEW_RANGE_DAYS) return null;
  return { from: range.from, to: range.to };
}

function buildExerciseRow(
  s: OverviewSeriesInput,
  from: string,
  to: string,
  days: number,
): OverviewExerciseRow {
  const weighted = s.points.filter((p) => p.bestE1rm > 0);
  const cmp = buildExerciseRangeCompare(weighted, "kg", from, to);
  const e1rm = cmp.metrics.find((m) => m.key === "bestE1rm");
  const sessions = cmp.metrics.find((m) => m.key === "sessions");

  // buildExerciseRangeCompare zwraca puste metryki, gdy któryś okres nie ma sesji —
  // sesje liczymy wtedy sami, żeby wiersz pokazał, czego brakuje.
  const sessionsCurrent =
    sessions?.current ??
    weighted.filter((p) => p.date >= from && p.date <= to).length;
  const prevFrom = addCalendarDays(from, -days);
  const prevTo = addCalendarDays(from, -1);
  const sessionsPrevious =
    sessions?.previous ??
    weighted.filter((p) => p.date >= prevFrom && p.date <= prevTo).length;

  const reliable =
    sessionsCurrent >= MIN_RELIABLE_SESSIONS &&
    sessionsPrevious >= MIN_RELIABLE_SESSIONS;

  let status: OverviewStatus = "insufficient";
  if (reliable && e1rm) {
    status =
      e1rm.outcome === "progress"
        ? "up"
        : e1rm.outcome === "regress"
          ? "down"
          : e1rm.outcome === "flat"
            ? "flat"
            : "insufficient";
  }

  return {
    key: s.key,
    name: s.name,
    groupId: s.groupId,
    groupLabel: s.groupLabel,
    previousE1rm: e1rm?.previous ?? null,
    currentE1rm: e1rm?.current ?? null,
    deltaPct: e1rm?.deltaPct ?? null,
    sessionsPrevious,
    sessionsCurrent,
    status,
  };
}

function countStatuses(rows: OverviewExerciseRow[]) {
  const counts = { up: 0, flat: 0, down: 0, insufficient: 0 };
  for (const r of rows) counts[r.status] += 1;
  return counts;
}

/**
 * Buduje widok zbiorczy dla zakresu [from, to] vs poprzedni zakres tej samej długości.
 * Zwraca `null`, gdy zakres jest niepoprawny.
 */
export function buildStrengthOverview(
  series: OverviewSeriesInput[],
  from: string,
  to: string,
): StrengthOverview | null {
  const range = normalizeCompareRange(from, to);
  if (!range) return null;

  const previousTo = addCalendarDays(range.from, -1);
  const previousFrom = addCalendarDays(range.from, -range.days);

  const exercises = series
    .map((s) => buildExerciseRow(s, range.from, range.to, range.days))
    // Ćwiczenia bez żadnej sesji w obu okresach nie wnoszą nic do widoku.
    .filter((r) => r.sessionsCurrent > 0 || r.sessionsPrevious > 0)
    .sort((a, b) => {
      // Najpierw ćwiczenia z wiarygodnym wynikiem (od największego wzrostu), potem reszta.
      const ra = a.status === "insufficient" ? 1 : 0;
      const rb = b.status === "insufficient" ? 1 : 0;
      if (ra !== rb) return ra - rb;
      return (b.deltaPct ?? -Infinity) - (a.deltaPct ?? -Infinity);
    });

  const counts = countStatuses(exercises);
  const reliable = exercises.filter(
    (r) => r.status !== "insufficient" && r.deltaPct != null,
  );
  const indexDeltaPct = median(reliable.map((r) => r.deltaPct as number));
  const indexStatus = statusOfMedian(indexDeltaPct);

  const verdict: StrengthOverviewVerdict =
    indexStatus === "up"
      ? "progress"
      : indexStatus === "down"
        ? "regress"
        : indexStatus === "flat"
          ? "flat"
          : "insufficient";

  const verdictLabel =
    verdict === "progress"
      ? "Siła średnio rośnie"
      : verdict === "regress"
        ? "Siła średnio spada"
        : verdict === "flat"
          ? "Siła bez wyraźnej zmiany"
          : `Za mało danych: potrzeba min. ${MIN_RELIABLE_SESSIONS} sesji ćwiczenia w obu okresach`;

  // Grupy mięśniowe: mediana Δ% z wiarygodnych ćwiczeń grupy.
  const byGroup = new Map<string, OverviewExerciseRow[]>();
  for (const r of exercises) {
    const id = r.groupId ?? OTHER_GROUP_ID;
    const list = byGroup.get(id);
    if (list) list.push(r);
    else byGroup.set(id, [r]);
  }
  const groups: OverviewGroupRow[] = [...byGroup.entries()]
    .map(([id, rows]) => {
      const rel = rows.filter(
        (r) => r.status !== "insufficient" && r.deltaPct != null,
      );
      const medianDeltaPct = median(rel.map((r) => r.deltaPct as number));
      const c = countStatuses(rows);
      return {
        id,
        label: rows[0]!.groupLabel,
        medianDeltaPct,
        status: statusOfMedian(medianDeltaPct),
        ...c,
      };
    })
    .sort((a, b) => {
      const ra = a.medianDeltaPct == null ? 1 : 0;
      const rb = b.medianDeltaPct == null ? 1 : 0;
      if (ra !== rb) return ra - rb;
      return (b.medianDeltaPct ?? 0) - (a.medianDeltaPct ?? 0);
    });

  return {
    from: range.from,
    to: range.to,
    days: range.days,
    previousFrom,
    previousTo,
    indexDeltaPct,
    verdict,
    verdictLabel,
    counts,
    lowConfidence:
      verdict !== "insufficient" && reliable.length < MIN_EXERCISES_FOR_CONFIDENT_INDEX,
    groups,
    exercises,
  };
}
