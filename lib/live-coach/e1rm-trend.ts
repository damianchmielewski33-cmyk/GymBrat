/**
 * e1RM trend engine — Epley via estimated1RM.
 * Rosnący e1RM przy spadających reps = progres (nie stagnacja).
 */

import { estimated1RM } from "@/lib/workout-history";
import type {
  E1rmTrendDirection,
  E1rmTrendReport,
  SessionSnapForTrends,
} from "@/lib/live-coach/types";

export { estimated1RM };

const FLAT_EPS = 1.5; // kg e1RM

export function setE1rm(weight: number, reps: number | null | undefined): number {
  if (reps == null || !Number.isFinite(reps) || reps <= 0) return 0;
  if (!Number.isFinite(weight) || weight <= 0) return 0;
  return estimated1RM(weight, Math.round(reps));
}

export function bestE1rmFromSets(
  sets: Array<{ weight: number; reps: number | null | undefined }>,
): number {
  let best = 0;
  for (const s of sets) {
    const e = setE1rm(s.weight, s.reps);
    if (e > best) best = e;
  }
  return best;
}

export function classifyE1rmTrend(
  sessionsNewestFirst: SessionSnapForTrends[],
): E1rmTrendDirection {
  const vals = sessionsNewestFirst
    .map((s) => s.bestE1rm)
    .filter((v) => v > 0);
  if (vals.length < 2) return "flat";
  const newest = vals[0]!;
  const oldest = vals[vals.length - 1]!;
  const delta = newest - oldest;
  if (delta > FLAT_EPS) return "up";
  if (delta < -FLAT_EPS) return "down";
  // Sprawdź monotoniczny wzrost sesja-do-sesji
  let ups = 0;
  let downs = 0;
  for (let i = 0; i < vals.length - 1; i++) {
    const d = vals[i]! - vals[i + 1]!;
    if (d > FLAT_EPS) ups += 1;
    else if (d < -FLAT_EPS) downs += 1;
  }
  if (ups > downs) return "up";
  if (downs > ups) return "down";
  return "flat";
}

export function buildE1rmTrendReport(
  sessionsNewestFirst: SessionSnapForTrends[],
): E1rmTrendReport {
  const vals = sessionsNewestFirst
    .map((s) => s.bestE1rm)
    .filter((v) => Number.isFinite(v) && v > 0);
  const last = vals[0] ?? null;
  const avg =
    vals.length > 0
      ? vals.reduce((a, b) => a + b, 0) / vals.length
      : null;
  const best = vals.length > 0 ? Math.max(...vals) : null;
  const oldest = vals.length >= 2 ? vals[vals.length - 1]! : null;
  const delta =
    last != null && oldest != null ? last - oldest : null;
  return {
    last,
    avg,
    best,
    trend4: classifyE1rmTrend(sessionsNewestFirst),
    delta,
    sessionCount: vals.length,
  };
}

/** Czy e1RM wyraźnie rośnie — wyklucza stagnację. */
export function isE1rmRising(report: E1rmTrendReport): boolean {
  return report.trend4 === "up";
}
