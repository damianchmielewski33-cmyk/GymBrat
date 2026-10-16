/**
 * Wspólne typy silników Live Set Coach v3.
 */

export type Score01 = number; // 0–100

export type E1rmTrendDirection = "down" | "flat" | "up";

export type E1rmTrendReport = {
  last: number | null;
  avg: number | null;
  best: number | null;
  trend4: E1rmTrendDirection;
  /** Δ last vs najstarsza w oknie (kg e1RM). */
  delta: number | null;
  sessionCount: number;
};

export type FatigueReport = {
  score: Score01;
  factors: {
    sessionVolume: number;
    hardSets: number;
    warnSets: number;
    exerciseIndex: number;
    shortRests: number;
    durationMinutes: number | null;
  };
};

export type ReadinessBand =
  | "progress_ready" // 90+
  | "normal" // 70–89
  | "conservative" // 50–69
  | "hold" // 30–49
  | "deload_consider"; // 0–29

export type ReadinessReport = {
  score: Score01;
  band: ReadinessBand;
  factors: Record<string, number>;
};

export type ConfidenceReport = {
  score: Score01;
  factors: Record<string, number>;
};

export type SuspiciousReport = {
  suspicious: boolean;
  reasons: string[];
  confidencePenalty: number;
};

export type PersonalRecordsReport = {
  isWeightPr: boolean;
  isRepPr: boolean;
  isVolumePr: boolean;
  isE1rmPr: boolean;
  anyPr: boolean;
};

export type ProgressionBumpKind =
  | "minimum"
  | "normal"
  | "aggressive"
  | "hold"
  | "deload";

export type ProgressionBump = {
  kind: ProgressionBumpKind;
  stepKg: number;
};

export type MovementProfile = {
  id: string;
  targetRir: number;
  targetRirMin: number;
  targetRirMax: number;
  label: string;
};

export type SessionSnapForTrends = {
  topKg: number;
  bestReps: number;
  bestE1rm: number;
  avgRir: number | null;
  volumeKg: number;
};

/** Zbiorczy sygnał przed decyzją tipu. */
export type CoachSignals = {
  readiness: ReadinessReport;
  confidence: ConfidenceReport;
  fatigue: FatigueReport;
  e1rm: E1rmTrendReport;
  suspicious: SuspiciousReport;
  prs: PersonalRecordsReport;
  profile: MovementProfile;
  bump: ProgressionBump;
  /** Skala 0–1: jak mocno liczyć fatigue drop (rest-aware). */
  fatigueDropSensitivity: number;
  effectiveTargetRir: number;
};
