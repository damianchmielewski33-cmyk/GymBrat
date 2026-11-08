import { isDateKeyInRange, type CardioWeekRange } from "@/lib/cardio-week-range";
import { clamp, inWindow, round0 } from "@/lib/analytics/math";
import { metFromSpeedKmh } from "@/lib/extra-cardio-from-macros";
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
  return estimateCardioCaloriesMet(sample, profile.weightKg);
}

/** MET (brutto) wg typu aktywności, gdy brak tempa. */
const MET_BY_TYPE: Record<string, number> = {
  walk: 3.8,
  treadmill: 5,
  run: 9,
  bike: 6.8,
  elliptical: 5,
  stairs: 8,
  swim: 6,
  other: 5,
};
const DEFAULT_WEIGHT_KG = 75;
const FOOT_TYPES = new Set(["walk", "run", "treadmill"]);

/**
 * Szacunek bez tętna: MET × waga. Marsz/bieg/bieżnia z dystansem → MET z prędkości
 * (ta sama tabela co dodatkowe cardio), inaczej MET z typu. Brutto, jak kcal z urządzenia.
 * Wynik tylko do wyświetlania/analityki — NIE jest zapisywany w `calories`,
 * bo dodatkowe cardio traktuje zapisane kcal jako dane użytkownika.
 */
export function estimateCardioCaloriesMet(
  sample: Pick<
    AnalyticsCardioSample,
    "minutes" | "distanceKm" | "cardioType"
  >,
  weightKg: number | null,
): number {
  if (!(sample.minutes > 0)) return 0;
  const w =
    weightKg != null && weightKg >= 30 && weightKg <= 250
      ? weightKg
      : DEFAULT_WEIGHT_KG;
  const type = sample.cardioType ?? "other";
  let met: number | null = null;
  if (
    FOOT_TYPES.has(type) &&
    sample.distanceKm != null &&
    sample.distanceKm > 0
  ) {
    const pace = sample.minutes / sample.distanceKm;
    if (pace >= 2.5 && pace <= 20) met = metFromSpeedKmh(60 / pace);
  }
  met ??= MET_BY_TYPE[type] ?? MET_BY_TYPE.other!;
  return round0((met * w * sample.minutes) / 60);
}

export function sumCardioCaloriesWeek(args: {
  samples: AnalyticsCardioSample[];
  today: string;
  weightKg: number | null;
  ageYears: number | null;
  sex: SexKind | null;
  /** Ten sam zakres tygodnia co minuty cardio (US12); bez niego — ostatnie 7 dni. */
  range?: CardioWeekRange;
}): number {
  let sum = 0;
  for (const s of args.samples) {
    if (args.range) {
      if (!isDateKeyInRange(s.date, args.range)) continue;
    } else if (!inWindow(s.date, args.today, 7)) continue;
    sum += resolveSampleCalories(s, {
      weightKg: args.weightKg,
      ageYears: args.ageYears,
      sex: args.sex,
    });
  }
  return round0(sum);
}
