import { clamp, inWindow, round0 } from "@/lib/analytics/math";
import type { AnalyticsCardioSample } from "@/lib/analytics/types";

export type SexKind = "male" | "female";

/**
 * Keytel / HR-based kcal estimate.
 * Male:  (−55.0969 + 0.6309×HR + 0.1988×kg + 0.2017×age) / 4.184 × min
 * Female:(−20.4022 + 0.4472×HR − 0.1263×kg + 0.074×age) / 4.184 × min
 * Bez płci — wzór męski (jak dotychczas w GymBrat).
 */
export function estimateCardioCaloriesKeytel(args: {
  minutes: number;
  avgHr: number;
  weightKg: number;
  ageYears: number;
  sex?: SexKind | null;
}): number {
  const { minutes, avgHr, weightKg, ageYears, sex } = args;
  if (
    minutes <= 0 ||
    avgHr < 70 ||
    avgHr > 210 ||
    weightKg < 30 ||
    weightKg > 250 ||
    ageYears < 12 ||
    ageYears > 100
  ) {
    return 0;
  }
  const perMin =
    sex === "female"
      ? (-20.4022 + 0.4472 * avgHr - 0.1263 * weightKg + 0.074 * ageYears) /
        4.184
      : (-55.0969 + 0.6309 * avgHr + 0.1988 * weightKg + 0.2017 * ageYears) /
        4.184;
  const kcal = clamp(perMin, 3, 18) * minutes;
  return round0(kcal);
}

/** Preferuje zapisane calories; inaczej Keytel gdy HR+waga+wiek. */
export function resolveSampleCalories(
  sample: AnalyticsCardioSample,
  profile: {
    weightKg: number | null;
    ageYears: number | null;
    sex: SexKind | null;
  },
): number {
  if (sample.calories != null && sample.calories > 0) {
    return round0(sample.calories);
  }
  if (
    sample.avgHr != null &&
    profile.weightKg != null &&
    profile.ageYears != null
  ) {
    return estimateCardioCaloriesKeytel({
      minutes: sample.minutes,
      avgHr: sample.avgHr,
      weightKg: profile.weightKg,
      ageYears: profile.ageYears,
      sex: profile.sex,
    });
  }
  // Fallback MET ~7 kcal/min
  return round0(sample.minutes * 7);
}

export function sumCardioCaloriesWeek(args: {
  samples: AnalyticsCardioSample[];
  today: string;
  weightKg: number | null;
  ageYears: number | null;
  sex: SexKind | null;
}): number {
  let sum = 0;
  for (const s of args.samples) {
    if (!inWindow(s.date, args.today, 7)) continue;
    sum += resolveSampleCalories(s, {
      weightKg: args.weightKg,
      ageYears: args.ageYears,
      sex: args.sex,
    });
  }
  return round0(sum);
}
