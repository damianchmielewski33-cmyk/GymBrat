import {
  ANALYTICS_MUSCLE_GROUPS,
  muscleGroupLabel,
  regionToAnalyticsGroup,
} from "@/lib/analytics/muscle-groups";
import { inWindow, round0, round1 } from "@/lib/analytics/math";
import type {
  AnalyticsMuscleGroupId,
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
  reps: number;
  tonnageKg: number;
};

const emptyStats = (): MuscleGroupWindowStats => ({
  sets: 0,
  reps: 0,
  tonnageKg: 0,
  sharePct: 0,
});

export function contributionFromExercise(args: {
  date: string;
  primaryRegion: MuscleRegionId | null;
  secondaryRegions: MuscleRegionId[];
  sets: number;
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
    reps: args.reps,
    tonnageKg: args.tonnageKg,
  };
}

function accumulate(
  contributions: MuscleSetContribution[],
  today: string,
  lookbackDays: number,
): Map<AnalyticsMuscleGroupId, { sets: number; reps: number; tonnageKg: number }> {
  const map = new Map<
    AnalyticsMuscleGroupId,
    { sets: number; reps: number; tonnageKg: number }
  >();
  for (const g of ANALYTICS_MUSCLE_GROUPS) {
    map.set(g.id, { sets: 0, reps: 0, tonnageKg: 0 });
  }
  for (const c of contributions) {
    if (!inWindow(c.date, today, lookbackDays)) continue;
    if (c.primary) {
      const row = map.get(c.primary)!;
      row.sets += c.sets;
      row.reps += c.reps;
      row.tonnageKg += c.tonnageKg;
    }
    for (const sec of c.secondary) {
      if (sec === c.primary) continue;
      const row = map.get(sec)!;
      row.sets += c.sets * 0.5;
      row.reps += c.reps * 0.5;
      row.tonnageKg += c.tonnageKg * 0.5;
    }
  }
  return map;
}

function withShare(
  map: Map<AnalyticsMuscleGroupId, { sets: number; reps: number; tonnageKg: number }>,
): Map<AnalyticsMuscleGroupId, MuscleGroupWindowStats> {
  const totalSets = [...map.values()].reduce((a, r) => a + r.sets, 0);
  const out = new Map<AnalyticsMuscleGroupId, MuscleGroupWindowStats>();
  for (const [id, r] of map) {
    out.set(id, {
      sets: round1(r.sets),
      reps: round0(r.reps),
      tonnageKg: round1(r.tonnageKg),
      sharePct: totalSets > 0 ? round0((r.sets / totalSets) * 100) : 0,
    });
  }
  return out;
}

/** Alerty gdy grupa B ma ≥40% mniej serii niż A (w oknie 30d), min. 8 serii u wyższej. */
export function detectMuscleImbalances(
  rows: MuscleGroupRow[],
): MuscleImbalanceAlert[] {
  const alerts: MuscleImbalanceAlert[] = [];
  const pairs: Array<[AnalyticsMuscleGroupId, AnalyticsMuscleGroupId]> = [
    ["plecy", "klatka"],
    ["plecy", "biceps"],
    ["klatka", "triceps"],
    ["nogi", "posladki"],
    ["barki", "klatka"],
  ];
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const [a, b] of pairs) {
    const A = byId.get(a);
    const B = byId.get(b);
    if (!A || !B) continue;
    const ha = A.days30.sets;
    const hb = B.days30.sets;
    if (ha < 8 && hb < 8) continue;
    if (ha >= 8 && hb < ha * 0.6) {
      const deficitPct = round0(((ha - hb) / ha) * 100);
      if (deficitPct >= 40) {
        alerts.push({
          higherId: a,
          lowerId: b,
          higherSets: ha,
          lowerSets: hb,
          deficitPct,
          message: `${muscleGroupLabel(b)} otrzymuje ${deficitPct}% mniej objętości niż ${muscleGroupLabel(a)}.`,
        });
      }
    }
    if (hb >= 8 && ha < hb * 0.6) {
      const deficitPct = round0(((hb - ha) / hb) * 100);
      if (deficitPct >= 40) {
        alerts.push({
          higherId: b,
          lowerId: a,
          higherSets: hb,
          lowerSets: ha,
          deficitPct,
          message: `${muscleGroupLabel(a)} otrzymuje ${deficitPct}% mniej objętości niż ${muscleGroupLabel(b)}.`,
        });
      }
    }
  }
  return alerts.slice(0, 5);
}

export function computeMuscleBalance(args: {
  contributions: MuscleSetContribution[];
  today: string;
}): MuscleBalanceSnapshot {
  const w7 = withShare(accumulate(args.contributions, args.today, 7));
  const w30 = withShare(accumulate(args.contributions, args.today, 30));
  const w90 = withShare(accumulate(args.contributions, args.today, 90));

  const groups: MuscleGroupRow[] = ANALYTICS_MUSCLE_GROUPS.map((g) => ({
    id: g.id,
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
