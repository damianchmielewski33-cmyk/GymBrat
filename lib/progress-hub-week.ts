import { addCalendarDays } from "@/lib/local-date";
import { buildWeekTrainingCompare, compareProgressWeekPicks, type ProgressWeekPick } from "@/lib/week-training-compare";
import { safeRound1, weekShortLabel } from "@/lib/progress-hub-helpers";
import type { ProgressWeekBar } from "@/lib/progress-hub-types";

/** Sekcja tygodniowa Postępów (Z88a). */
export const COMPARE_WEEK_COUNT = 12;

export type WeekAggBucket = {
  workouts: number;
  tonnageKg: number;
  cardioMinutes: number;
  rpe: number[];
  rir: number[];
};
export const emptyWeekAgg = (): WeekAggBucket => ({
  workouts: 0,
  tonnageKg: 0,
  cardioMinutes: 0,
  rpe: [],
  rir: [],
});

/** Puste kubełki tygodni (ostatnie `COMPARE_WEEK_COUNT` tygodni od poniedziałku `monday`). */
export function createWeekBuckets(monday: string) {
  const weekBuckets = new Map<string, { workouts: number; tonnageKg: number; cardioMinutes: number }>();
  /** Pełny Pn–Nd oraz wyrównany Pn→(Pn+daysIntoWeek) dla pickera porównań. */
  const weekFull = new Map<string, WeekAggBucket>();
  const weekPartial = new Map<string, WeekAggBucket>();
  for (let w = 0; w < COMPARE_WEEK_COUNT; w++) {
    const m = addCalendarDays(monday, -7 * w);
    weekBuckets.set(m, { workouts: 0, tonnageKg: 0, cardioMinutes: 0 });
    weekFull.set(m, emptyWeekAgg());
    weekPartial.set(m, emptyWeekAgg());
  }
  return { weekBuckets, weekFull, weekPartial };
}

/** Seria tygodni, ostatnie 8 tygodni, porównania tygodni i dni do końca tygodnia. */
export function buildWeekSection(args: {
  weeksWithGuided: Set<string>;
  weekBuckets: ReturnType<typeof createWeekBuckets>["weekBuckets"];
  weekFull: Map<string, WeekAggBucket>;
  weekPartial: Map<string, WeekAggBucket>;
  monday: string;
  sunday: string;
  today: string;
  prevMonday: string;
  prevSameEnd: string;
  daysIntoWeek: number;
  weeklyTarget: number;
}) {
  const { weeksWithGuided, weekBuckets, weekFull, weekPartial, monday, sunday, today, prevMonday, prevSameEnd, daysIntoWeek, weeklyTarget } = args;
  // --- Streak ---
  let streakWeeks = 0;
  for (let w = 0; w < 12; w++) {
    const weekMonday = addCalendarDays(monday, -7 * w);
    if (!weeksWithGuided.has(weekMonday)) break;
    streakWeeks += 1;
  }

  const last8: ProgressWeekBar[] = [];
  for (let w = 7; w >= 0; w--) {
    const m = addCalendarDays(monday, -7 * w);
    const b = weekBuckets.get(m) ?? { workouts: 0, tonnageKg: 0, cardioMinutes: 0 };
    last8.push({
      monday: m,
      label: weekShortLabel(m),
      workouts: b.workouts,
      tonnageKg: safeRound1(b.tonnageKg),
      cardioMinutes: Math.round(b.cardioMinutes),
      complete: b.workouts >= weeklyTarget,
    });
  }

  const prevWeekTonnageKg = safeRound1(
    weekBuckets.get(prevMonday)?.tonnageKg ?? 0,
  );

  const avgOrNull = (nums: number[]): number | null =>
    nums.length
      ? safeRound1(nums.reduce((a, b) => a + b, 0) / nums.length)
      : null;

  const rangeLabel = (from: string, to: string) => {
    const a = new Date(`${from}T12:00:00`);
    const b = new Date(`${to}T12:00:00`);
    const fmt = (d: Date) =>
      d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
    return `${fmt(a)}–${fmt(b)}`;
  };

  const toWeekMetrics = (
    mondayKey: string,
    agg: WeekAggBucket,
    rangeEnd: string,
  ) => ({
    rangeEnd,
    rangeLabel: rangeLabel(mondayKey, rangeEnd),
    workouts: agg.workouts,
    tonnageKg: safeRound1(agg.tonnageKg),
    cardioMinutes: Math.round(agg.cardioMinutes),
    avgRpe: avgOrNull(agg.rpe),
    avgRir: avgOrNull(agg.rir),
  });

  const compareWeeks: ProgressWeekPick[] = [];
  for (let w = 0; w < COMPARE_WEEK_COUNT; w++) {
    const m = addCalendarDays(monday, -7 * w);
    const sun = addCalendarDays(m, 6);
    const partialEnd = addCalendarDays(m, daysIntoWeek);
    const full = weekFull.get(m) ?? emptyWeekAgg();
    const partial = weekPartial.get(m) ?? emptyWeekAgg();
    const isCurrent = m === monday;
    compareWeeks.push({
      monday: m,
      sunday: sun,
      label: weekShortLabel(m),
      isCurrent,
      full: toWeekMetrics(m, full, isCurrent ? today : sun),
      partial: toWeekMetrics(m, partial, partialEnd),
    });
  }

  const primaryPick = compareWeeks[0]!;
  const baselinePick =
    compareWeeks.find((w) => w.monday === prevMonday) ?? compareWeeks[1]!;
  const weekCompare =
    primaryPick && baselinePick
      ? compareProgressWeekPicks(primaryPick, baselinePick)
      : buildWeekTrainingCompare({
          thisRangeLabel: rangeLabel(monday, today),
          prevRangeLabel: rangeLabel(prevMonday, prevSameEnd),
          workouts: { current: 0, previous: 0 },
          tonnageKg: { current: 0, previous: 0 },
          cardioMinutes: { current: 0, previous: 0 },
          avgRpe: { current: null, previous: null },
          avgRir: { current: null, previous: null },
        });

  const daysLeftRaw = Math.round(
    (new Date(`${sunday}T12:00:00`).getTime() -
      new Date(`${today}T12:00:00`).getTime()) /
      (24 * 60 * 60 * 1000),
  );
  const daysLeft = Math.max(0, daysLeftRaw);
  return { streakWeeks, last8, prevWeekTonnageKg, compareWeeks, weekCompare, daysLeft };
}
