import { computeAdherenceScore } from "@/lib/analytics/adherence-score";
import { sumCardioCaloriesWeek, type SexKind } from "@/lib/analytics/cardio-calories";
import { computeCardioLoad } from "@/lib/analytics/cardio-load";
import { computeZoneMinutes } from "@/lib/analytics/cardio-hr-zones";
import { computeCardioPerformance } from "@/lib/analytics/cardio-performance";
import { buildCoachInsights } from "@/lib/analytics/coach-insights";
import { computeConsistencyScore } from "@/lib/analytics/consistency-score";
import { computeFatigueScore } from "@/lib/analytics/fatigue-score";
import { computeMuscleBalance } from "@/lib/analytics/muscle-volume";
import type { MuscleSetContribution } from "@/lib/analytics/muscle-volume";
import { computePredictions } from "@/lib/analytics/prediction";
import { computeRecoveryScore } from "@/lib/analytics/recovery-score";
import { computeStrengthVelocity } from "@/lib/analytics/strength-velocity";
import { computeStagnationList } from "@/lib/analytics/stagnation";
import { inWindow, round1 } from "@/lib/analytics/math";
import {
  ANALYTICS_ALGORITHM_VERSION,
  type AnalyticsCardioSample,
  type AnalyticsStrengthSession,
  type ExerciseSessionPoint,
  type ProgressIntelligence,
  type SubjectiveRecoveryInput,
} from "@/lib/analytics/types";
import type { MuscleRegionId } from "@/lib/resolve-exercise-muscles";

export type BuildIntelligenceInput = {
  today: string;
  weeklySessionsTarget: number;
  weeklyCardioGoalMinutes: number;
  ageYears: number | null;
  weightKg: number | null;
  sex: SexKind | null;
  strengthSessions: AnalyticsStrengthSession[];
  strengthDates: string[];
  consecutiveTrainingDays: number;
  exercises: Array<{
    exerciseKey: string;
    name: string;
    points: ExerciseSessionPoint[];
    primaryRegion?: MuscleRegionId | null;
  }>;
  muscleContributions: MuscleSetContribution[];
  cardioSamples: AnalyticsCardioSample[];
  subjective: SubjectiveRecoveryInput | null;
  dietAdherencePct: number | null;
};

function tonnageInWindow(
  sessions: AnalyticsStrengthSession[],
  endDate: string,
  days: number,
): number {
  return round1(
    sessions
      .filter((s) => inWindow(s.date, endDate, days))
      .reduce((a, s) => a + s.tonnageKg, 0),
  );
}

function cardioMinutesInWindow(
  samples: AnalyticsCardioSample[],
  endDate: string,
  days: number,
): number {
  return round1(
    samples
      .filter((s) => inWindow(s.date, endDate, days))
      .reduce((a, s) => a + s.minutes, 0),
  );
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function buildProgressIntelligence(
  input: BuildIntelligenceInput,
): ProgressIntelligence {
  const cardioLoadByEndDate = (endDate: string) =>
    computeCardioLoad({
      samples: input.cardioSamples,
      ageYears: input.ageYears,
      today: endDate,
      lookbackDays: 7,
    }).load;

  const fatigue = computeFatigueScore({
    sessions: input.strengthSessions,
    cardioLoadByEndDate,
    consecutiveTrainingDays: input.consecutiveTrainingDays,
    today: input.today,
  });

  const cardioLoadNow = cardioLoadByEndDate(input.today);

  const recovery = computeRecoveryScore({
    fatigueScore: fatigue.score,
    subjective: input.subjective,
    cardioLoadWeek: cardioLoadNow,
  });

  const muscle = computeMuscleBalance({
    contributions: input.muscleContributions,
    today: input.today,
  });

  const stagnation = computeStagnationList({
    exercises: input.exercises,
    today: input.today,
    limit: 12,
  });

  const consistency = computeConsistencyScore({
    weeklySessionsTarget: input.weeklySessionsTarget,
    strengthDates: input.strengthDates,
    today: input.today,
  });

  const cardioMinWeek = cardioMinutesInWindow(
    input.cardioSamples,
    input.today,
    7,
  );
  const cardioAdherencePct =
    input.weeklyCardioGoalMinutes > 0
      ? (cardioMinWeek / input.weeklyCardioGoalMinutes) * 100
      : null;

  const adherence = computeAdherenceScore({
    consistency,
    dietAdherencePct: input.dietAdherencePct,
    cardioAdherencePct,
  });

  const predictions = computePredictions({
    exercises: input.exercises,
    limit: 8,
  });

  const velocity = computeStrengthVelocity({
    exercises: input.exercises,
    today: input.today,
  });

  const { hrMax, zones } = computeZoneMinutes({
    samples: input.cardioSamples,
    ageYears: input.ageYears,
    today: input.today,
    lookbackDays: 7,
  });

  const loadSnap = computeCardioLoad({
    samples: input.cardioSamples,
    ageYears: input.ageYears,
    today: input.today,
    lookbackDays: 7,
  });

  const performance = computeCardioPerformance({
    samples: input.cardioSamples,
    today: input.today,
  });

  const caloriesEstimatedWeek = sumCardioCaloriesWeek({
    samples: input.cardioSamples,
    today: input.today,
    weightKg: input.weightKg,
    ageYears: input.ageYears,
    sex: input.sex,
  });

  const cardio = {
    hrMax,
    zones,
    load: loadSnap.load,
    loadBand: loadSnap.band,
    loadLabel: loadSnap.label,
    caloriesEstimatedWeek,
    performance,
  };

  const prevWeekEnd = addDaysIso(input.today, -7);
  const insights = buildCoachInsights({
    fatigue,
    recovery,
    muscle,
    stagnation,
    consistency,
    adherence,
    cardio,
    weeklyTonnageNow: tonnageInWindow(input.strengthSessions, input.today, 7),
    weeklyTonnagePrev: tonnageInWindow(
      input.strengthSessions,
      prevWeekEnd,
      7,
    ),
    cardioMinutesNow: cardioMinWeek,
    cardioMinutesPrev: cardioMinutesInWindow(
      input.cardioSamples,
      prevWeekEnd,
      7,
    ),
  });

  return {
    algorithmVersion: ANALYTICS_ALGORITHM_VERSION,
    fatigue,
    recovery,
    muscle,
    stagnation,
    consistency,
    adherence,
    predictions,
    velocity,
    cardio,
    insights,
  };
}

export function emptyProgressIntelligence(): ProgressIntelligence {
  return buildProgressIntelligence({
    today: "2000-01-01",
    weeklySessionsTarget: 5,
    weeklyCardioGoalMinutes: 150,
    ageYears: null,
    weightKg: null,
    sex: null,
    strengthSessions: [],
    strengthDates: [],
    consecutiveTrainingDays: 0,
    exercises: [],
    muscleContributions: [],
    cardioSamples: [],
    subjective: null,
    dietAdherencePct: null,
  });
}
