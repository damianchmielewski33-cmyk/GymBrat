/**
 * Global readiness score 0–100.
 */

import { hrReadinessAdjust } from "@/lib/live-coach/hr-signals";
import { prReadinessBonus } from "@/lib/live-coach/personal-records";
import { readinessBand } from "@/lib/live-coach/progression-bumps";
import type {
  E1rmTrendReport,
  FatigueReport,
  PersonalRecordsReport,
  ReadinessReport,
  SessionSnapForTrends,
} from "@/lib/live-coach/types";
import { classifyEffort } from "@/lib/set-effort";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export type ReadinessInput = {
  lastRir?: number | null;
  recentSessions?: SessionSnapForTrends[];
  e1rm: E1rmTrendReport;
  hardStreak: number;
  warnStreak: number;
  daysSinceLastSession?: number | null;
  stagnant: boolean;
  fatigue: FatigueReport;
  prs: PersonalRecordsReport;
  volumeTrend?: "down" | "flat" | "up";
  restingHR?: number | null;
  recoveryHR?: number | null;
  heartRate?: number | null;
  /** Trend RIR: wyższy = więcej zapasu w czasie. */
  rirTrend?: "down" | "flat" | "up";
};

function volumeTrendFromSessions(
  sessions: SessionSnapForTrends[] | undefined,
): "down" | "flat" | "up" {
  if (!sessions || sessions.length < 2) return "flat";
  const a = sessions[0]!.volumeKg;
  const b = sessions[sessions.length - 1]!.volumeKg;
  if (a <= 0 || b <= 0) return "flat";
  const ratio = a / b;
  if (ratio > 1.08) return "up";
  if (ratio < 0.92) return "down";
  return "flat";
}

function rirTrendFromSessions(
  sessions: SessionSnapForTrends[] | undefined,
): "down" | "flat" | "up" {
  if (!sessions || sessions.length < 2) return "flat";
  const vals = sessions
    .map((s) => s.avgRir)
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (vals.length < 2) return "flat";
  const newest = vals[0]!;
  const oldest = vals[vals.length - 1]!;
  if (newest - oldest >= 0.6) return "up";
  if (oldest - newest >= 0.6) return "down";
  return "flat";
}

export function computeReadiness(input: ReadinessInput): ReadinessReport {
  const factors: Record<string, number> = {};
  let score = 72;

  // Ostatni RIR
  if (input.lastRir != null && Number.isFinite(input.lastRir)) {
    const rir = input.lastRir;
    if (rir >= 3) {
      factors.lastRir = 10;
      score += 10;
    } else if (rir >= 2) {
      factors.lastRir = 4;
      score += 4;
    } else if (rir === 1) {
      factors.lastRir = -4;
      score -= 4;
    } else {
      factors.lastRir = -12;
      score -= 12;
    }
  } else {
    factors.lastRir = 0;
  }

  const rirTrend = input.rirTrend ?? rirTrendFromSessions(input.recentSessions);
  if (rirTrend === "up") {
    factors.rirTrend = 6;
    score += 6;
  } else if (rirTrend === "down") {
    factors.rirTrend = -8;
    score -= 8;
  } else {
    factors.rirTrend = 0;
  }

  const volTrend =
    input.volumeTrend ?? volumeTrendFromSessions(input.recentSessions);
  if (volTrend === "up") {
    factors.volumeTrend = 3;
    score += 3;
  } else if (volTrend === "down") {
    factors.volumeTrend = -5;
    score -= 5;
  }

  if (input.e1rm.trend4 === "up") {
    factors.e1rmTrend = 10;
    score += 10;
  } else if (input.e1rm.trend4 === "down") {
    factors.e1rmTrend = -10;
    score -= 10;
  } else {
    factors.e1rmTrend = 0;
  }

  factors.hardStreak = -Math.min(20, input.hardStreak * 8);
  score += factors.hardStreak;
  factors.warnStreak = -Math.min(15, input.warnStreak * 4);
  score += factors.warnStreak;

  const days = input.daysSinceLastSession;
  if (days != null && days >= 14) {
    const layoffPen = Math.min(22, 8 + (days - 14) * 0.8);
    factors.layoff = -layoffPen;
    score -= layoffPen;
  } else if (days != null && days <= 2) {
    factors.layoff = 2;
    score += 2;
  }

  if (input.stagnant) {
    factors.stagnant = -14;
    score -= 14;
  }

  // Session fatigue obniża readiness łagodnie
  const fatPen = Math.min(18, input.fatigue.score * 0.18);
  factors.sessionFatigue = -fatPen;
  score -= fatPen;

  const prBonus = prReadinessBonus(input.prs);
  factors.prs = prBonus;
  score += prBonus;

  const hr = hrReadinessAdjust({
    restingHR: input.restingHR,
    recoveryHR: input.recoveryHR,
    heartRate: input.heartRate,
  });
  factors.hr = hr.readinessDelta;
  score += hr.readinessDelta;

  const final = clamp01(score);
  return {
    score: final,
    band: readinessBand(final),
    factors,
  };
}

export function lastCompletedRir(
  sets: Array<{ rir?: number | null; done?: boolean; skipped?: boolean }>,
  beforeIndex: number,
): number | null {
  for (let i = beforeIndex - 1; i >= 0; i--) {
    const s = sets[i]!;
    if (s.skipped) continue;
    if (s.done === false) continue;
    if (s.rir != null && Number.isFinite(s.rir)) return s.rir;
  }
  return null;
}

export { classifyEffort };
