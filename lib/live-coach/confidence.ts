/**
 * Confidence engine 0–100 — nigdy nie ukrywa rekomendacji.
 */

import type {
  ConfidenceReport,
  E1rmTrendReport,
  FatigueReport,
  SuspiciousReport,
} from "@/lib/live-coach/types";
import { hrReadinessAdjust } from "@/lib/live-coach/hr-signals";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 40;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export type ConfidenceInput = {
  recentSessionCount: number;
  hasConflict: boolean;
  missingEffortData: boolean;
  missingWeightOrReps: boolean;
  suspicious: SuspiciousReport;
  daysSinceLastSession?: number | null;
  e1rm: E1rmTrendReport;
  volumeConsistency?: number; // 0–1, 1 = bardzo spójna
  fatigue: FatigueReport;
  restingHR?: number | null;
  recoveryHR?: number | null;
};

function e1rmStability(e1rm: E1rmTrendReport): number {
  if (e1rm.sessionCount < 2 || e1rm.avg == null || e1rm.avg <= 0) return 0.5;
  const spread =
    e1rm.best != null && e1rm.last != null
      ? Math.abs(e1rm.best - e1rm.last) / e1rm.avg
      : 0.2;
  if (spread < 0.04) return 1;
  if (spread < 0.08) return 0.8;
  if (spread < 0.15) return 0.55;
  return 0.3;
}

export function computeConfidence(input: ConfidenceInput): ConfidenceReport {
  const factors: Record<string, number> = {};
  let score = 55;

  // Historia
  const hist = Math.min(25, input.recentSessionCount * 7);
  factors.history = hist;
  score += hist;

  if (input.hasConflict) {
    factors.conflict = -28;
    score -= 28;
  }

  if (input.missingEffortData) {
    factors.missingEffort = -12;
    score -= 12;
  }
  if (input.missingWeightOrReps) {
    factors.missingLoad = -15;
    score -= 15;
  }

  if (input.suspicious.suspicious) {
    factors.suspicious = -input.suspicious.confidencePenalty;
    score -= input.suspicious.confidencePenalty;
  }

  const days = input.daysSinceLastSession;
  if (days != null && days >= 14) {
    const p = Math.min(18, 6 + (days - 14) * 0.5);
    factors.layoff = -p;
    score -= p;
  }

  const stab = e1rmStability(input.e1rm);
  const stabPts = Math.round((stab - 0.5) * 20);
  factors.e1rmStability = stabPts;
  score += stabPts;

  const volC = input.volumeConsistency ?? 0.6;
  const volPts = Math.round((volC - 0.5) * 16);
  factors.volumeConsistency = volPts;
  score += volPts;

  // Wysokie fatigue obniża confidence (nie wymusza deload)
  if (input.fatigue.score >= 70) {
    factors.fatigue = -10;
    score -= 10;
  } else if (input.fatigue.score >= 50) {
    factors.fatigue = -5;
    score -= 5;
  }

  const hr = hrReadinessAdjust({
    restingHR: input.restingHR,
    recoveryHR: input.recoveryHR,
  });
  factors.hr = hr.confidenceDelta;
  score += hr.confidenceDelta;

  return {
    score: clamp01(score),
    factors,
  };
}

export function volumeConsistencyFromSessions(
  volumes: number[],
): number {
  const vals = volumes.filter((v) => v > 0);
  if (vals.length < 2) return 0.55;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (mean <= 0) return 0.5;
  const variance =
    vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
  const cv = Math.sqrt(variance) / mean;
  if (cv < 0.1) return 1;
  if (cv < 0.2) return 0.8;
  if (cv < 0.35) return 0.55;
  return 0.3;
}
