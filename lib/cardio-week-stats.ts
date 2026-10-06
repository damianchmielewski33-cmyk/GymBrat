/** Statystyki i porównania tygodni cardio — bez DB (OK na kliencie). */

export type CardioWeekDays = {
  monday: string;
  label: string;
  /** Minuty pn→nd (indeks 0 = poniedziałek). */
  dayMinutes: number[];
  minutes: number;
  distanceKm: number;
  calories: number;
  steps: number;
  entries: number;
};

export const CARDIO_WEEKDAY_SHORT = [
  "Pn",
  "Wt",
  "Śr",
  "Cz",
  "Pt",
  "So",
  "Nd",
] as const;

export function emptyDayMinutes(): number[] {
  return [0, 0, 0, 0, 0, 0, 0];
}

export function sumMinutesThrough(
  dayMinutes: number[],
  throughIndexInclusive: number,
): number {
  const end = Math.max(-1, Math.min(throughIndexInclusive, dayMinutes.length - 1));
  let sum = 0;
  for (let i = 0; i <= end; i++) sum += dayMinutes[i] ?? 0;
  return sum;
}

/** Indeks dnia pn=0…nd=6 względem poniedziałku tygodnia. */
export function weekdayIndexMon0(dateKey: string, weekMonday: string): number {
  const [y1, m1, d1] = weekMonday.split("-").map(Number);
  const [y2, m2, d2] = dateKey.split("-").map(Number);
  const a = Date.UTC(y1!, m1! - 1, d1!);
  const b = Date.UTC(y2!, m2! - 1, d2!);
  const diff = Math.round((b - a) / (24 * 60 * 60 * 1000));
  if (diff < 0 || diff > 6) return -1;
  return diff;
}

export function throughDayIndexForToday(
  weekMonday: string,
  todayKey: string,
): number {
  const idx = weekdayIndexMon0(todayKey, weekMonday);
  if (idx >= 0) return idx;
  if (todayKey < weekMonday) return -1;
  return 6;
}

export function goalAdherencePct(
  minutes: number,
  goalMinutes: number,
): number | null {
  if (!(goalMinutes > 0) || !Number.isFinite(minutes)) return null;
  return Math.round((minutes / goalMinutes) * 100);
}

export type WeekCompareMetrics = {
  currentMinutes: number;
  previousMinutes: number;
  deltaMinutes: number;
  deltaPct: number | null;
  currentGoalPct: number | null;
  previousGoalPct: number | null;
  deltaGoalPp: number | null;
};

/** Porównanie pn→throughIdx (włącznie) bieżącego vs poprzedniego tygodnia. */
export function compareWeeksThrough(
  current: CardioWeekDays,
  previous: CardioWeekDays | null,
  throughIndexInclusive: number,
  goalMinutes: number,
): WeekCompareMetrics | null {
  if (!previous) return null;
  const currentMinutes = Math.round(
    sumMinutesThrough(current.dayMinutes, throughIndexInclusive),
  );
  const previousMinutes = Math.round(
    sumMinutesThrough(previous.dayMinutes, throughIndexInclusive),
  );
  const deltaMinutes = currentMinutes - previousMinutes;
  const deltaPct =
    previousMinutes > 0
      ? Math.round((deltaMinutes / previousMinutes) * 100)
      : currentMinutes > 0
        ? 100
        : null;
  const currentGoalPct = goalAdherencePct(currentMinutes, goalMinutes);
  const previousGoalPct = goalAdherencePct(previousMinutes, goalMinutes);
  const deltaGoalPp =
    currentGoalPct != null && previousGoalPct != null
      ? currentGoalPct - previousGoalPct
      : null;
  return {
    currentMinutes,
    previousMinutes,
    deltaMinutes,
    deltaPct,
    currentGoalPct,
    previousGoalPct,
    deltaGoalPp,
  };
}

export type DayCompareRow = {
  dayIndex: number;
  label: string;
  currentMinutes: number;
  previousMinutes: number;
  deltaMinutes: number;
  deltaPct: number | null;
  /** true gdy dzień jeszcze nie nastąpił w bieżącym tygodniu */
  future: boolean;
};

export function compareDaysThrough(
  current: CardioWeekDays,
  previous: CardioWeekDays | null,
  throughIndexInclusive: number,
): DayCompareRow[] {
  const rows: DayCompareRow[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = Math.round(current.dayMinutes[i] ?? 0);
    const prev = Math.round(previous?.dayMinutes[i] ?? 0);
    const future = i > throughIndexInclusive;
    const deltaMinutes = future ? 0 : cur - prev;
    const deltaPct =
      future || prev <= 0
        ? future
          ? null
          : cur > 0
            ? 100
            : null
        : Math.round((deltaMinutes / prev) * 100);
    rows.push({
      dayIndex: i,
      label: CARDIO_WEEKDAY_SHORT[i]!,
      currentMinutes: future ? 0 : cur,
      previousMinutes: prev,
      deltaMinutes,
      deltaPct,
      future,
    });
  }
  return rows;
}

export function formatSignedMinutes(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const r = Math.round(n);
  if (r === 0) return "0 min";
  return r > 0 ? `+${r} min` : `${r} min`;
}

export function formatSignedPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const r = Math.round(n);
  if (r === 0) return "0%";
  return r > 0 ? `+${r}%` : `${r}%`;
}
