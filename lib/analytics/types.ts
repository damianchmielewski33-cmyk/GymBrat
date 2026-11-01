/** Wspólne typy silników Analityki GymBrat (derive-on-read). */

export const ANALYTICS_ALGORITHM_VERSION = "analytics_v1" as const;

export type FatigueBand = "fresh" | "normal" | "fatigued" | "overreached";

export type FatigueSnapshot = {
  score: number;
  band: FatigueBand;
  bandLabel: string;
  delta7d: number | null;
  delta30d: number | null;
  recommendation: string;
  inputs: {
    weeklyTonnageKg: number;
    tonnageTrendPct: number | null;
    hardSetPct: number | null;
    avgRpe: number | null;
    sessionsThisWeek: number;
    cardioLoad: number;
    consecutiveTrainingDays: number;
  };
};

export type RecoveryBand = "poor" | "average" | "good" | "excellent";

export type RecoverySnapshot = {
  score: number;
  band: RecoveryBand;
  bandLabel: string;
  readinessLine: string;
  source: "subjective" | "inverse_fatigue";
};

export type AnalyticsMuscleGroupId =
  | "klatka"
  | "plecy"
  | "barki"
  | "biceps"
  | "triceps"
  | "nogi"
  | "posladki"
  | "lydki"
  | "brzuch";

export type MuscleGroupWindowStats = {
  sets: number;
  effectiveSets: number;
  reps: number;
  tonnageKg: number;
  sharePct: number;
};

export type MuscleAcuteChronic = {
  acute: number;
  chronicWeekly: number;
  /** acute / chronicWeekly; null bez bazy przewlekłej. */
  ratio: number | null;
  band: "unknown" | "detraining" | "optimal" | "high" | "spike";
};

export type MuscleGroupRow = {
  id: AnalyticsMuscleGroupId;
  label: string;
  /** YYYY-MM-DD ostatniego treningu grupy (null = brak w historii). */
  lastTrainedDate: string | null;
  /** Obciążenie ostre (7 dni) vs przewlekłe (średnia tygodniowa z dni 8–28), serie efektywne. */
  acuteChronic: MuscleAcuteChronic;
  week: MuscleGroupWindowStats;
  days30: MuscleGroupWindowStats;
  days90: MuscleGroupWindowStats;
};

export type MuscleImbalanceAlert = {
  higherId: AnalyticsMuscleGroupId;
  lowerId: AnalyticsMuscleGroupId;
  higherSets: number;
  lowerSets: number;
  deficitPct: number;
  message: string;
};

export type MuscleBalanceSnapshot = {
  groups: MuscleGroupRow[];
  alerts: MuscleImbalanceAlert[];
};

export type StagnationStatus =
  | "progressing"
  | "stable"
  | "stagnating"
  | "regressing";

export type StagnationItem = {
  exerciseKey: string;
  name: string;
  status: StagnationStatus;
  statusLabel: string;
  daysWithoutProgress: number;
  e1rmDeltaPct30: number | null;
  volumeDeltaPct30: number | null;
};

export type ConsistencyWindow = {
  planned: number;
  done: number;
  scorePct: number;
};

export type ConsistencySnapshot = {
  week: ConsistencyWindow;
  month: ConsistencyWindow;
  days90: ConsistencyWindow;
};

export type AdherenceSnapshot = {
  trainingPct: number;
  dietPct: number | null;
  cardioPct: number | null;
  overallPct: number;
};

export type PredictionConfidence = "low" | "medium" | "high";

export type PredictionItem = {
  exerciseKey: string;
  name: string;
  sampleCount: number;
  confidence: PredictionConfidence;
  e1rmNow: number;
  e1rm30d: number;
  e1rm90d: number;
  tonnageNow: number;
  tonnage30d: number;
  tonnage90d: number;
};

export type VelocityWindow = {
  days7: number | null;
  days30: number | null;
  days90: number | null;
};

export type StrengthVelocityExercise = {
  exerciseKey: string;
  name: string;
  e1rmPct: VelocityWindow;
  volumePct: VelocityWindow;
};

export type StrengthVelocitySnapshot = {
  /** Średnia zmiana e1RM po ćwiczeniach + łączna objętość (wszystkie punkty). */
  overall: {
    e1rmPct: VelocityWindow;
    volumePct: VelocityWindow;
  };
  exercises: StrengthVelocityExercise[];
  byMuscle: Array<{
    id: AnalyticsMuscleGroupId;
    label: string;
    volumePct: VelocityWindow;
  }>;
};

export type CardioZoneMinutes = {
  zone: 1 | 2 | 3 | 4 | 5;
  minutes: number;
  sharePct: number;
};

export type CardioLoadBand = "low" | "medium" | "high";

export type CardioPerformanceVerdict =
  | "improved"
  | "stable"
  | "declined"
  | "insufficient_data";

export type CardioAnalyticsSnapshot = {
  hrMax: number | null;
  zones: CardioZoneMinutes[];
  load: number;
  loadBand: CardioLoadBand;
  loadLabel: string;
  caloriesEstimatedWeek: number;
  performance: {
    verdict: CardioPerformanceVerdict;
    verdictLabel: string;
    activityLabel: string | null;
    hrThen: number | null;
    hrNow: number | null;
    minutesCompared: number | null;
  };
};

export type CoachInsight = {
  id: string;
  severity: "info" | "warn" | "good";
  text: string;
};

export type ProgressIntelligence = {
  algorithmVersion: typeof ANALYTICS_ALGORITHM_VERSION;
  fatigue: FatigueSnapshot;
  recovery: RecoverySnapshot;
  muscle: MuscleBalanceSnapshot;
  stagnation: StagnationItem[];
  consistency: ConsistencySnapshot;
  adherence: AdherenceSnapshot;
  predictions: PredictionItem[];
  velocity: StrengthVelocitySnapshot;
  cardio: CardioAnalyticsSnapshot;
  insights: CoachInsight[];
};

/** Punkt sesji ćwiczenia — wejście silników. */
export type ExerciseSessionPoint = {
  date: string;
  volumeKg: number;
  totalReps: number;
  bestE1rm: number;
  bestWeight: number;
  bestReps: number;
  hardSets: number;
  scoredSets: number;
  avgRpe: number | null;
  avgRir: number | null;
  setsCount: number;
};

export type AnalyticsStrengthSession = {
  id: string;
  date: string;
  tonnageKg: number;
  hardSetPct: number | null;
  avgRpe: number | null;
  avgRir: number | null;
  setCount: number;
};

export type AnalyticsCardioSample = {
  id: string;
  date: string;
  minutes: number;
  avgHr: number | null;
  maxHr: number | null;
  calories: number | null;
  distanceKm: number | null;
  cardioType: string | null;
  effortScore: number | null;
  heartRateZone: number | null;
  title: string | null;
};

export type SubjectiveRecoveryInput = {
  sleepQuality: number | null;
  dayEnergy: number | null;
  stress: number | null;
  weightDeltaKg7d: number | null;
};
