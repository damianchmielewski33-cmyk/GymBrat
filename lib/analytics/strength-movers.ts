import { round1 } from "@/lib/analytics/math";
import { pickVelocity, velocityTone } from "@/lib/analytics/strength-velocity";
import type {
  PredictionItem,
  StrengthVelocityExercise,
  StrengthVelocitySnapshot,
} from "@/lib/analytics/types";

export type StrengthMover = {
  exerciseKey: string;
  name: string;
  /** Główny score (objętość 30 dni, fallback e1RM). */
  scorePct: number;
  volumePct: number | null;
  e1rmPct: number | null;
};

export type StrengthMoversLists = {
  rising: StrengthMover[];
  falling: StrengthMover[];
};

export type PredictionAggregate = {
  count: number;
  avgE1rmDeltaPct30: number | null;
  avgE1rmDeltaPct90: number | null;
  avgTonnageDeltaPct30: number | null;
  avgTonnageDeltaPct90: number | null;
  /** Ćwiczenia posortowane po największym wzroście e1RM 30 dni. */
  items: Array<
    PredictionItem & {
      e1rmDeltaPct30: number | null;
      e1rmDeltaPct90: number | null;
    }
  >;
};

function deltaPct(now: number, future: number): number | null {
  if (!Number.isFinite(now) || !Number.isFinite(future) || now <= 0) return null;
  return round1(((future - now) / now) * 100);
}

function meanPct(vals: Array<number | null>): number | null {
  const xs = vals.filter((n): n is number => n != null && Number.isFinite(n));
  if (!xs.length) return null;
  return round1(xs.reduce((a, b) => a + b, 0) / xs.length);
}

function moverScore(ex: StrengthVelocityExercise): number | null {
  const volume = pickVelocity(ex.volumePct, "days30");
  const e1rm = pickVelocity(ex.e1rmPct, "days30");
  if (volume != null) return volume;
  if (e1rm != null) return e1rm;
  return null;
}

export function buildStrengthMovers(
  velocity: StrengthVelocitySnapshot,
  limit = 5,
): StrengthMoversLists {
  const ranked: StrengthMover[] = velocity.exercises
    .map((ex) => {
      const scorePct = moverScore(ex);
      if (scorePct == null) return null;
      return {
        exerciseKey: ex.exerciseKey,
        name: ex.name,
        scorePct,
        volumePct: pickVelocity(ex.volumePct, "days30"),
        e1rmPct: pickVelocity(ex.e1rmPct, "days30"),
      };
    })
    .filter((m): m is StrengthMover => m != null)
    .sort((a, b) => b.scorePct - a.scorePct);

  return {
    rising: ranked
      .filter((m) => velocityTone(m.scorePct) === "up")
      .slice(0, limit),
    falling: [...ranked]
      .filter((m) => velocityTone(m.scorePct) === "down")
      .sort((a, b) => a.scorePct - b.scorePct)
      .slice(0, limit),
  };
}

export function buildPredictionAggregate(
  predictions: PredictionItem[],
): PredictionAggregate {
  const items = predictions
    .map((p) => ({
      ...p,
      e1rmDeltaPct30: deltaPct(p.e1rmNow, p.e1rm30d),
      e1rmDeltaPct90: deltaPct(p.e1rmNow, p.e1rm90d),
    }))
    .sort(
      (a, b) => (b.e1rmDeltaPct30 ?? -Infinity) - (a.e1rmDeltaPct30 ?? -Infinity),
    );

  return {
    count: items.length,
    avgE1rmDeltaPct30: meanPct(items.map((i) => i.e1rmDeltaPct30)),
    avgE1rmDeltaPct90: meanPct(items.map((i) => i.e1rmDeltaPct90)),
    avgTonnageDeltaPct30: meanPct(
      items.map((i) => deltaPct(i.tonnageNow, i.tonnage30d)),
    ),
    avgTonnageDeltaPct90: meanPct(
      items.map((i) => deltaPct(i.tonnageNow, i.tonnage90d)),
    ),
    items,
  };
}

export function confidenceLabelPl(
  c: PredictionItem["confidence"],
): string {
  if (c === "high") return "wysoka";
  if (c === "medium") return "średnia";
  return "niska";
}
