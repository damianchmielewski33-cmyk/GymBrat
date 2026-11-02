import type { ProgressHubData } from "@/lib/progress-hub";

/** Raport Premium (DK-8): zaawansowana analiza postępów w formie do wydruku / zapisu jako PDF. */
export type PremiumReport = {
  generatedAt: string;
  strength: {
    workoutCount: number;
    sinceDate: string | null;
    volumeCounts: { up: number; flat: number; down: number };
    /** Top 5 maksów wg e1RM. */
    topMaxes: { name: string; e1rm: number; weight: number; reps: number; date: string; isNew: boolean }[];
    streakWeeks: number;
  };
  weeks: { label: string; workouts: number; tonnageKg: number; cardioMinutes: number }[];
  /** Dane o ciele — tylko za zgodą `health` (RODO art. 9); `null` = pominięte. */
  body: {
    currentKg: number | null;
    startKg: number | null;
    deltaFromStartKg: number | null;
    kgPerWeekLast6: number | null;
    measures: { label: string; currentCm: number | null; deltaFromStartCm: number | null }[];
  } | null;
};

export function buildPremiumReport(
  hub: ProgressHubData,
  opts: { includeBody: boolean; now?: Date },
): PremiumReport {
  const topMaxes = hub.strength.maxes
    .filter((m) => m.kind === "weighted" && m.bestE1rm > 0)
    .sort((a, b) => b.bestE1rm - a.bestE1rm)
    .slice(0, 5)
    .map((m) => ({
      name: m.name,
      e1rm: Math.round(m.bestE1rm * 10) / 10,
      weight: m.bestWeight,
      reps: m.bestReps,
      date: m.date,
      isNew: m.isNew,
    }));

  const body = opts.includeBody
    ? {
        currentKg: hub.body.tempo.currentKg,
        startKg: hub.body.tempo.startKg,
        deltaFromStartKg: hub.body.tempo.deltaFromStartKg,
        kgPerWeekLast6: hub.body.tempo.kgPerWeekLast6,
        measures: hub.body.measures.map((m) => ({
          label: m.label,
          currentCm: m.currentCm,
          deltaFromStartCm: m.deltaFromStartCm,
        })),
      }
    : null;

  return {
    generatedAt: (opts.now ?? new Date()).toISOString(),
    strength: {
      workoutCount: hub.strength.workoutCount,
      sinceDate: hub.strength.sinceDate,
      volumeCounts: hub.strength.volumeCounts,
      topMaxes,
      streakWeeks: hub.week.summary.streakWeeks,
    },
    weeks: hub.week.last8.map((w) => ({
      label: w.label,
      workouts: w.workouts,
      tonnageKg: w.tonnageKg,
      cardioMinutes: w.cardioMinutes,
    })),
    body,
  };
}
