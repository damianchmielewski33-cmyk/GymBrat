import { type ExerciseSessionPoint, type ProgressIntelligence } from "@/lib/analytics";
import { type AchievementDef } from "@/lib/achievements";
import { type ProgressDietTrainingBlock } from "@/lib/diet-training-weeks";
import { type FitnessGoals } from "@/lib/fitness-goals";
import { type GoalType } from "@/lib/goal-projection";
import { type ProgressIntensitySummary } from "@/lib/intensity-analysis";
import { type ProgressWeekPick, type WeekTrainingCompare } from "@/lib/week-training-compare";

export type VolumeTrendKind = "up" | "flat" | "down";

export type ProgressMetricKind = "kg" | "reps";

export type ProgressMaxItem = {
  name: string;
  /** e1RM dla obciążenia; 0 dla masy ciała. */
  bestE1rm: number;
  bestWeight: number;
  bestReps: number;
  date: string;
  isNew: boolean;
  kind: "weighted" | "bodyweight";
};

export type ProgressVolumeSession = {
  id: string;
  date: string;
  title: string;
  volumeKg: number;
  trend: VolumeTrendKind;
};

export type ProgressExerciseStatus = "pending" | "first" | "compare";

export type ProgressExerciseRow = {
  name: string;
  /** Ostatnia wartość metryki: kg objętości albo suma powtórzeń (masa ciała). */
  lastVolumeKg: number;
  lastBestWeight: number;
  /** Najlepsza seria powtórzeń (przydatne przy 0 kg). */
  lastBestReps: number;
  /** e1RM z ostatniej sesji oraz kierunek zmian między dwiema ostatnimi sesjami. */
  lastBestE1rm: number | null;
  e1rmTrend: VolumeTrendKind;
  e1rmDeltaPercent: number | null;
  bestSetLabel: string | null;
  history: ExerciseSessionPoint[];
  spark: number[];
  trend: VolumeTrendKind;
  status: ProgressExerciseStatus;
  /** Pierwszy trening z tym ćwiczeniem (YYYY-MM-DD). */
  firstDate: string | null;
  volumeDeltaKg: number | null;
  volumeDeltaPercent: number | null;
  metric: ProgressMetricKind;
};

export type ProgressPlanGroup = {
  planId: string;
  planName: string;
  exercises: ProgressExerciseRow[];
};

export type ProgressWeightPoint = { date: string; kg: number };

export type ProgressTempo = {
  currentKg: number | null;
  startKg: number | null;
  kgPerWeekLast6: number | null;
  kgPerWeekFromStart: number | null;
  deltaVsPrevKg: number | null;
  weeksFromStart: number | null;
  /** current − start */
  deltaFromStartKg: number | null;
  lastReportDate: string | null;
  startDate: string | null;
  reportCount: number;
  /** Średnia krocząca na ostatnim punkcie. */
  lastAvgKg: number | null;
};

export type ProgressMeasureKey =
  | "waist"
  | "thigh"
  | "chest"
  | "arm";

export type ProgressMeasureRow = {
  key: ProgressMeasureKey;
  label: string;
  currentCm: number | null;
  deltaFromStartCm: number | null;
  spark: number[];
  lowerIsBetter: boolean;
};

export type ProgressPhotoItem = {
  id: string;
  reportId: string;
  /** Autoryzowany URL — bez data URL w payloadzie RSC. */
  src: string;
  date: string;
  weightKg: number | null;
  waistCm: number | null;
};

export type ProgressWeekDay = {
  date: string;
  label: string;
  strength: boolean;
  cardio: boolean;
};

export type ProgressWeekSummary = {
  done: number;
  target: number;
  days: ProgressWeekDay[];
  tonnageKg: number;
  /** Tonaż poprzedniego tygodnia kalendarzowego (pełny Pn–Nd). */
  prevWeekTonnageKg: number;
  cardioMinutes: number;
  cardioEntries: number;
  cardioGoalMinutes: number;
  streakWeeks: number;
  monday: string;
  sunday: string;
  today: string;
  /** Dni kalendarzowe do niedzieli włącznie (0 gdy po tygodniu). */
  daysLeft: number;
  /** Domyślne porównanie: bieżący vs poprzedni (Pn→dziś). */
  weekCompare: WeekTrainingCompare;
  /** Ostatnie ~12 tygodni do wyboru dowolnej pary w UI. */
  compareWeeks: ProgressWeekPick[];
};

export type ProgressGoalBar = {
  id: string;
  label: string;
  /** Tekst po prawej, np. „jeszcze 3 cm”. */
  remainingLabel: string;
  /** 0–100 */
  progressPct: number;
};

export type ProgressWeekBar = {
  monday: string;
  label: string;
  workouts: number;
  tonnageKg: number;
  cardioMinutes: number;
  complete: boolean;
};

export type ProgressHubData = {
  strength: {
    maxes: ProgressMaxItem[];
    volumeSessions: ProgressVolumeSession[];
    volumeCounts: { up: number; flat: number; down: number };
    /** Ćwiczenia z porównywalną objętością (ostatnie 2 wpisy). */
    volumeComparedCount: number;
    /** RPE / RIR / tempo z ostatnich sesji siłowych. */
    intensity: ProgressIntensitySummary;
    planGroups: ProgressPlanGroup[];
    sinceDate: string | null;
    workoutCount: number;
  };
  body: {
    weights: ProgressWeightPoint[];
    tempo: ProgressTempo;
    measures: ProgressMeasureRow[];
    targetWeightKg: number | null;
    goalType: GoalType | null;
    goalDeadline: string | null;
  };
  photos: {
    items: ProgressPhotoItem[];
    start: ProgressPhotoItem | null;
    now: ProgressPhotoItem | null;
    /** Użytkownik wgrał własne zdjęcie startowe z galerii. */
    hasCustomStart: boolean;
    weightDeltaKg: number | null;
    waistDeltaCm: number | null;
  };
  week: {
    summary: ProgressWeekSummary;
    last8: ProgressWeekBar[];
    /** Kcal/makro z dziennika vs tonaż/RPE w tych samych tygodniach. */
    dietTraining: ProgressDietTrainingBlock;
    goals: ProgressGoalBar[];
    /** Cele ćwiczeń (edytowalne) i nazwy ćwiczeń z historii do wyboru. */
    exerciseTargets: NonNullable<FitnessGoals["exerciseTargets"]>;
    exerciseNameOptions: string[];
    achievements: AchievementDef[];
  };
  /** Silniki Analityki 11/10 — fatigue, recovery, muscle, stagnation, … */
  intelligence: ProgressIntelligence;
};
