export * from "@/lib/analytics/types";
export * from "@/lib/analytics/muscle-groups";
export * from "@/lib/analytics/math";
export { computeFatigueScore, fatigueBandOf, fatigueBandLabel } from "@/lib/analytics/fatigue-score";
export { computeRecoveryScore, recoveryBandOf } from "@/lib/analytics/recovery-score";
export {
  computeMuscleBalance,
  contributionFromExercise,
  type MuscleSetContribution,
} from "@/lib/analytics/muscle-volume";
export {
  classifyExerciseStagnation,
  computeStagnationList,
  stagnationStatusLabel,
} from "@/lib/analytics/stagnation";
export { computeConsistencyScore } from "@/lib/analytics/consistency-score";
export { computeAdherenceScore } from "@/lib/analytics/adherence-score";
export { computePredictions, predictExercise } from "@/lib/analytics/prediction";
export {
  computeStrengthVelocity,
  formatVelocityPct,
  pickVelocity,
  velocityTone,
  type VelocityPeriodKey,
} from "@/lib/analytics/strength-velocity";
export {
  buildPredictionAggregate,
  buildStrengthMovers,
  confidenceLabelPl,
} from "@/lib/analytics/strength-movers";
export {
  computeZoneMinutes,
  estimateHrMax,
  heartRateZoneFromHr,
} from "@/lib/analytics/cardio-hr-zones";
export {
  computeCardioLoad,
  sampleCardioLoad,
  cardioLoadBandOf,
} from "@/lib/analytics/cardio-load";
export {
  estimateCardioCaloriesKeytel,
  resolveSampleCalories,
  sumCardioCaloriesWeek,
  type SexKind,
} from "@/lib/analytics/cardio-calories";
export { computeCardioPerformance } from "@/lib/analytics/cardio-performance";
export { buildCoachInsights } from "@/lib/analytics/coach-insights";
export {
  buildProgressIntelligence,
  emptyProgressIntelligence,
  type BuildIntelligenceInput,
} from "@/lib/analytics/build-intelligence";
