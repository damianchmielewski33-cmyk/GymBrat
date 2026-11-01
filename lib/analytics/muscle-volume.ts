import {
  ANALYTICS_MUSCLE_GROUPS,
  muscleGroupLabel,
  regionToAnalyticsGroup,
} from "@/lib/analytics/muscle-groups";
import { inWindow, round0, round1 } from "@/lib/analytics/math";
import type {
  AnalyticsMuscleGroupId,
  MuscleAcuteChronic,
  MuscleBalanceSnapshot,
  MuscleGroupRow,
  MuscleGroupWindowStats,
  MuscleImbalanceAlert,
} from "@/lib/analytics/types";
import type { MuscleRegionId } from "@/lib/resolve-exercise-muscles";

export type MuscleSetContribution = {
  date: string;
  primary: AnalyticsMuscleGroupId | null;
  secondary: AnalyticsMuscleGroupId[];
  sets: number;
  /** Serie efektywne (≤4 powt. w zapasie lub bez danych o wysiłku), bez rozgrzewek. */
  effectiveSets: number;
  reps: number;
  tonnageKg: number;
};

const emptyStats = (): MuscleGroupWindowStats => ({
  sets: 0,
  effectiveSets: 0,
  reps: 0,
  tonnageKg: 0,
  sharePct: 0,
});

export function contributionFromExercise(args: {
  date: string;
  primaryRegion: MuscleRegionId | null;
  secondaryRegions: MuscleRegionId[];
  sets: number;
  effectiveSets?: number;
  reps: number;
  tonnageKg: number;
}): MuscleSetContribution {
  return {
    date: args.date,
    primary: regionToAnalyticsGroup(args.primaryRegion),
    secondary: args.secondaryRegions
      .map(regionToAnalyticsGroup)
      .filter((x): x is AnalyticsMuscleGroupId => x != null),
    sets: args.sets,
    effectiveSets: args.effectiveSets ?? args.sets,
    reps: args.reps,
    tonnageKg: args.tonnageKg,
  };
}

type Acc = { sets: number; effectiveSets: number; reps: number; tonnageKg: number };

function accumulate(
  contributions: MuscleSetContribution[],
  today: string,
  lookbackDays: number,
): Map<AnalyticsMuscleGroupId, Acc> {
  const map = new Map<AnalyticsMuscleGroupId, Acc>();
  for (const g of ANALYTICS_MUSCLE_GROUPS) {
    map.set(g.id, { sets: 0, effectiveSets: 0, reps: 0, tonnageKg: 0 });
  }
  const add = (row: Acc, c: MuscleSetContribution, w: number) => {
    row.sets += c.sets * w;
    row.effectiveSets += (c.effectiveSets ?? c.sets) * w;
    row.reps += c.reps * w;
    row.tonnageKg += c.tonnageKg * w;
  };
  for (const c of contributions) {
    if (!inWindow(c.date, today, lookbackDays)) continue;
    if (c.primary) add(map.get(c.primary)!, c, 1);
    for (const sec of c.secondary) {
      if (sec === c.primary) continue;
      add(map.get(sec)!, c, 0.5);
    }
  }
  return map;
}

function withShare(
  map: Map<AnalyticsMuscleGroupId, Acc>,
): Map<AnalyticsMuscleGroupId, MuscleGroupWindowStats> {
  const totalSets = [...map.values()].reduce((a, r) => a + r.sets, 0);
  const out = new Map<AnalyticsMuscleGroupId, MuscleGroupWindowStats>();
  for (const [id, r] of map) {
    out.set(id, {
      sets: round1(r.sets),
      effectiveSets: round1(r.effectiveSets),
      reps: round0(r.reps),
      tonnageKg: round1(r.tonnageKg),
      sharePct: totalSets > 0 ? round0((r.sets / totalSets) * 100) : 0,
    });
  }
  return out;
}

/** Ostatni dzień, w którym grupa była trenowana (główny lub pomocniczy udział). */
function lastTrainedByGroup(
  contributions: MuscleSetContribution[],
  today: string,
): Map<AnalyticsMuscleGroupId, string> {
  const out = new Map<AnalyticsMuscleGroupId, string>();
  for (const c of contributions) {
    if (c.date > today) continue;
    const groups = [c.primary, ...c.secondary].filter(
      (g): g is AnalyticsMuscleGroupId => g != null,
    );
    for (const g of groups) {
      const prev = out.get(g);
      if (!prev || c.date > prev) out.set(g, c.date);
    }
  }
  return out;
}

/**
 * Alerty kierunkowe: grupa zależna (druga w parze) ma ≥40% mniej serii niż
 * referencyjna (pierwsza) w oknie 30d, min. 8 serii u referencyjnej.
 * Odwrotny kierunek (np. mniej klatki niż pleców) nie jest problemem.
 */
export function detectMuscleImbalances(
  rows: MuscleGroupRow[],
): MuscleImbalanceAlert[] {
  const alerts: MuscleImbalanceAlert[] = [];
  const pairs: Array<[AnalyticsMuscleGroupId, AnalyticsMuscleGroupId]> = [
    ["klatka", "plecy"],
    ["plecy", "biceps"],
    ["klatka", "triceps"],
    ["nogi", "posladki"],
  ];
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const [ref, dep] of pairs) {
    const A = byId.get(ref);
    const B = byId.get(dep);
    if (!A || !B) continue;
    const ha = A.days30.sets;
    const hb = B.days30.sets;
    if (ha < 8 || hb >= ha * 0.6) continue;
    const deficitPct = round0(((ha - hb) / ha) * 100);
    if (deficitPct < 40) continue;
    alerts.push({
      higherId: ref,
      lowerId: dep,
      higherSets: ha,
      lowerSets: hb,
      deficitPct,
      message: `${muscleGroupLabel(dep)} otrzymuje ${deficitPct}% mniej objętości niż ${muscleGroupLabel(ref)}.`,
    });
  }
  return alerts.slice(0, 5);
}

/**
 * Stosunek obciążenia ostrego do przewlekłego per grupa. Baza przewlekła to
 * 3 tygodnie PRZED ostatnim tygodniem (28d − 7d), więc ostry tydzień jej nie zawyża.
 */
export function acuteChronicOf(
  acute7: number,
  total28: number,
): MuscleAcuteChronic {
  const chronicWeekly = Math.max(0, (total28 - acute7) / 3);
  const acute = round1(acute7);
  if (chronicWeekly < 2) {
    return { acute, chronicWeekly: round1(chronicWeekly), ratio: null, band: "unknown" };
  }
  const ratio = Math.round((acute7 / chronicWeekly) * 100) / 100;
  const band =
    ratio < 0.8 ? "detraining" : ratio <= 1.3 ? "optimal" : ratio <= 1.6 ? "high" : "spike";
  return { acute, chronicWeekly: round1(chronicWeekly), ratio, band };
}

export function computeMuscleBalance(args: {
  contributions: MuscleSetContribution[];
  today: string;
}): MuscleBalanceSnapshot {
  const w7 = withShare(accumulate(args.contributions, args.today, 7));
  const w30 = withShare(accumulate(args.contributions, args.today, 30));
  const w90 = withShare(accumulate(args.contributions, args.today, 90));
  const w28 = accumulate(args.contributions, args.today, 28);
  const w7raw = accumulate(args.contributions, args.today, 7);

  const lastTrained = lastTrainedByGroup(args.contributions, args.today);
  const groups: MuscleGroupRow[] = ANALYTICS_MUSCLE_GROUPS.map((g) => ({
    id: g.id,
    lastTrainedDate: lastTrained.get(g.id) ?? null,
    acuteChronic: acuteChronicOf(
      w7raw.get(g.id)?.effectiveSets ?? 0,
      w28.get(g.id)?.effectiveSets ?? 0,
    ),
    label: g.label,
    week: w7.get(g.id) ?? emptyStats(),
    days30: w30.get(g.id) ?? emptyStats(),
    days90: w90.get(g.id) ?? emptyStats(),
  }));

  return {
    groups,
    alerts: detectMuscleImbalances(groups),
  };
}
