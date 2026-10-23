/**
 * Dodatkowe cardio przy rzeczywistej nadwyżce energetycznej.
 *
 * Zasady:
 * - effectiveSurplus ≤ openDebt, a po wykonaniu zalecanych minut rekomendacja znika
 *   (cel odroczenia liczony od długu przed cardio, offset odejmowany od celu),
 * - nadwyżka dnia to nadwyżka ENERGETYCZNA: przy kcal ≤ celu dzień nie tworzy długu
 *   (ani z białka, ani z węgli/tłuszczu),
 * - płynny soft credit tylko dla ZAMKNIĘTYCH dni — dzisiejszy (niedokończony) dzień
 *   nie zmniejsza długu,
 * - spalanie liczone netto (bez metabolizmu spoczynkowego), z płcią w modelu tętna
 *   i z MET zależnym od prędkości (marsz ≠ bieg),
 * - kcal z wpisu: tylko wiarygodne (≤ 25 kcal/min), inaczej szacunek z minut.
 */

export type MacroDaySnapshot = {
  caloriesConsumed: number;
  caloriesGoal: number | null;
  proteinConsumed: number;
  carbsConsumed: number;
  fatConsumed: number;
  proteinGoal: number | null;
  carbsGoal: number | null;
  fatGoal: number | null;
};

export type CardioSex = "male" | "female";

export type RecentCardioSample = {
  minutes: number;
  calories: number | null;
  paceMinPerKm: number | null;
  /** Średnie tętno wpisane ręcznie po treningu — nie najwyższa wiarygodność. */
  avgHeartRate?: number | null;
  maxHeartRate?: number | null;
  /** Typ aktywności — tempo/MET tylko dla marszu, biegu i bieżni. */
  cardioType?: string | null;
  /** YYYY-MM-DD — do odjęcia spalonych kcal w bieżącym tygodniu */
  dateKey?: string;
};

export type ExtraCardioInput = {
  today: MacroDaySnapshot;
  /** Snapshoty dni pon–dziś (włącznie), w kolejności chronologicznej. */
  elapsedDays: Array<{ dateKey: string; day: MacroDaySnapshot }>;
  /** YYYY-MM-DD */
  todayKey: string;
  /** Pon–niedz. bieżącego tygodnia */
  weekKeys: string[];
  weightKg: number | null;
  /** Wiek — do modelu tętna (opcjonalnie). */
  ageYears?: number | null;
  /** Płeć — do modelu tętna (brak = średnia wzorów męskiego i żeńskiego). */
  sex?: CardioSex | null;
  recentCardio: RecentCardioSample[];
  /** Cel minut cardio / tydzień — tylko nadmiar offsetuje dług. */
  weeklyCardioGoalMinutes?: number;
};

export type ExceededMacro = "protein" | "carbs" | "fat" | "calories";

export type BurnSource =
  | "calories_entered"
  | "personal_model"
  | "heart_rate_model"
  | "met_model"
  | "default";

export type ExtraCardioAdvice = {
  /** Czy pokazać niebieski segment na pasku. */
  show: boolean;
  /** Minuty cardio ponad tygodniowy cel — do „spalenia” nadwyżki. */
  extraMinutes: number;
  /** Niewyrównana nadwyżka kcal (po diecie / cardio w tygodniu). */
  surplusKcal: number;
  /** Nadwyżka do odrobienia cardio — zawsze ≤ surplusKcal. */
  effectiveSurplusKcal: number;
  /** Ile kcal już odrobione cardio (ponad tygodniowy cel). */
  cardioOffsetKcal: number;
  /** Dni od dziś do niedzieli włącznie. */
  daysLeftInWeek: number;
  /** 0–100: szansa, że bilans złapie się dietą w pozostałe dni. */
  balanceChancePct: number;
  burnKcalPerMin: number;
  burnSource: BurnSource;
  recentPaceMinPerKm: number | null;
  /** Tempo, przy którym oszacowano spalanie (to samo, co tempo ostatnich treningów). */
  suggestedPaceMinPerKm: number | null;
  exceededMacros: ExceededMacro[];
  /** Krótki opis do tooltipa. */
  summary: string;
  /** Punkty wyjaśnienia (tooltip). */
  explanation: string[];
};

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;
/** Poniżej progu nie męczymy UI drobnymi wahaniami. */
const MIN_DEBT_KCAL = 60;
/**
 * Dzień bez sensownego spożycia nie jest „deficytem −cel”.
 * Inaczej pusty wtorek (−2000) kasowałby wczorajszą nadwyżkę.
 */
const MEANINGFUL_INTAKE_PCT = 0.1;
/** Start płynnego soft creditu (0% kredytu). */
export const SOFT_CREDIT_START_PCT = 0.55;
const PERSONAL_MIN_WORKOUTS = 10;
const PERSONAL_MIN_MINUTES = 200;
const HR_MIN = 70;
const HR_MAX = 210;
/** Zakres kcal/min (netto). */
const BURN_MIN = 2;
const BURN_MAX = 18;
/** Wpis z kcal/min powyżej progu uznajemy za literówkę. */
export const MAX_PLAUSIBLE_KCAL_PER_MIN = 25;
/** Netto nie spada poniżej tego udziału brutto (marsz o niskiej intensywności). */
const NET_FLOOR_SHARE = 0.6;
const DEFAULT_WEIGHT_KG = 75;
/** Gdy brak tempa — umiarkowane cardio. */
const DEFAULT_MET = 5;
/** Tempo (min/km) poza zakresem to błąd GPS / wpisu. */
const PACE_MIN = 2.5;
const PACE_MAX = 20;
/** Typy, dla których tempo min/km ma sens energetyczny. */
const FOOT_CARDIO_TYPES = new Set(["walk", "run", "treadmill"]);

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clampBurn(n: number): number {
  return round1(Math.min(BURN_MAX, Math.max(BURN_MIN, n)));
}

function restKcalPerMin(weightKg: number | null | undefined): number {
  const w =
    weightKg != null && Number.isFinite(weightKg) && weightKg > 0
      ? weightKg
      : DEFAULT_WEIGHT_KG;
  // 1 MET ≈ 1 kcal/kg/h
  return w / 60;
}

/** Brutto (urządzenie / Keytel) → netto: odejmujemy metabolizm spoczynkowy. */
export function grossToNetKcal(
  kcal: number,
  minutes: number,
  weightKg: number | null | undefined,
): number {
  if (!(kcal > 0) || !(minutes > 0)) return 0;
  return Math.max(
    kcal * NET_FLOOR_SHARE,
    kcal - minutes * restKcalPerMin(weightKg),
  );
}

export function grossToNetKcalPerMin(
  grossPerMin: number,
  weightKg: number | null | undefined,
): number {
  return clampBurn(grossToNetKcal(grossPerMin, 1, weightKg));
}

/** Wpis kcal jest wiarygodny: > 0 i ≤ 25 kcal/min. */
export function isPlausibleEnteredCalories(
  minutes: number,
  calories: number | null | undefined,
): boolean {
  return (
    calories != null &&
    Number.isFinite(calories) &&
    calories > 0 &&
    minutes > 0 &&
    calories / minutes <= MAX_PLAUSIBLE_KCAL_PER_MIN
  );
}

function overage(consumed: number, goal: number | null): number {
  if (goal == null || !Number.isFinite(goal) || goal <= 0) return 0;
  return Math.max(0, consumed - goal);
}

function caloriesAtOrUnderGoal(day: MacroDaySnapshot): boolean {
  return (
    day.caloriesGoal != null &&
    Number.isFinite(day.caloriesGoal) &&
    day.caloriesGoal > 0 &&
    day.caloriesConsumed <= day.caloriesGoal
  );
}

/**
 * Nadwyżka energetyczna dnia.
 * Przy kcal ≤ celu dzień nie ma nadwyżki energetycznej — przekroczenie pojedynczego
 * makro (białko, węgle, tłuszcz) jest wtedy skompensowane resztą diety.
 * Gdy brak celu kcal, liczą się przekroczenia makro.
 */
export function macroSurplusKcal(day: MacroDaySnapshot): {
  surplusKcal: number;
  exceeded: ExceededMacro[];
} {
  if (caloriesAtOrUnderGoal(day)) {
    return { surplusKcal: 0, exceeded: [] };
  }

  const proteinOver = overage(day.proteinConsumed, day.proteinGoal);
  const carbsOver = overage(day.carbsConsumed, day.carbsGoal);
  const fatOver = overage(day.fatConsumed, day.fatGoal);
  const calOver = overage(day.caloriesConsumed, day.caloriesGoal);

  const fromMacros =
    proteinOver * KCAL_PER_G.protein +
    carbsOver * KCAL_PER_G.carbs +
    fatOver * KCAL_PER_G.fat;

  const surplusKcal = Math.round(Math.max(fromMacros, calOver));

  const exceeded: ExceededMacro[] = [];
  if (proteinOver > 0) exceeded.push("protein");
  if (carbsOver > 0) exceeded.push("carbs");
  if (fatOver > 0) exceeded.push("fat");
  if (calOver > 0) exceeded.push("calories");

  return { surplusKcal, exceeded };
}

function hasMeaningfulIntake(day: MacroDaySnapshot): boolean {
  const { surplusKcal } = macroSurplusKcal(day);
  if (surplusKcal > 0) return true;
  if (day.caloriesConsumed > 0) {
    if (day.caloriesGoal == null || !(day.caloriesGoal > 0)) return true;
    return day.caloriesConsumed >= day.caloriesGoal * MEANINGFUL_INTAKE_PCT;
  }
  return (
    day.proteinConsumed > 0 || day.carbsConsumed > 0 || day.fatConsumed > 0
  );
}

/**
 * Płynny soft credit: 55% celu → 0, bli celu → pełne wyrównanie (goal − intake) × progress.
 * Stosowany wyłącznie do zamkniętych (minionych) dni.
 */
export function softCreditKcal(day: MacroDaySnapshot): number {
  const goal = day.caloriesGoal;
  const intake = day.caloriesConsumed;
  if (goal == null || !(goal > 0) || !(intake > 0)) return 0;
  if (intake >= goal) return 0;

  const creditStart = goal * SOFT_CREDIT_START_PCT;
  if (intake <= creditStart) return 0;

  const denom = goal - creditStart;
  if (!(denom > 0)) return 0;
  const progress = Math.min(1, Math.max(0, (intake - creditStart) / denom));
  return Math.round((goal - intake) * progress);
}

/**
 * Bilans dnia do sumy tygodnia:
 * - nadwyżka → +kcal,
 * - płynny kredyt deficytu → −softCredit,
 * - pusty / ledwo zaczęty dzień → null (nie kasuje długu).
 */
export function dayCalorieBalance(day: MacroDaySnapshot): number | null {
  const { surplusKcal } = macroSurplusKcal(day);
  if (surplusKcal > 0) {
    if (day.caloriesGoal != null && day.caloriesGoal > 0) {
      const calNet = Math.round(day.caloriesConsumed - day.caloriesGoal);
      return Math.max(calNet, surplusKcal);
    }
    return surplusKcal;
  }

  if (!hasMeaningfulIntake(day)) return null;

  if (day.caloriesGoal == null || !(day.caloriesGoal > 0)) return null;

  const calNet = Math.round(day.caloriesConsumed - day.caloriesGoal);
  if (calNet >= 0) return calNet;

  const credit = softCreditKcal(day);
  if (credit <= 0) return null;
  return -credit;
}

export function daysLeftInWeekIncludingToday(
  todayKey: string,
  weekKeys: string[],
): number {
  const idx = weekKeys.indexOf(todayKey);
  if (idx < 0) return 1;
  return weekKeys.length - idx;
}

export function isReliableHeartRate(hr: number | null | undefined): boolean {
  return (
    hr != null &&
    Number.isFinite(hr) &&
    hr >= HR_MIN &&
    hr <= HR_MAX
  );
}

/**
 * Model Keytela — kcal/min BRUTTO z tętna.
 * Męski: (−55.0969 + 0.6309·HR + 0.1988·kg + 0.2017·wiek) / 4.184
 * Żeński: (−20.4022 + 0.4472·HR − 0.1263·kg + 0.074·wiek) / 4.184
 * Brak płci → średnia obu wzorów.
 * Zwraca null przy niewiarygodnym tętnie / braku wagi lub wieku.
 */
export function estimateHeartRateBurnKcalPerMin(input: {
  avgHeartRate: number | null | undefined;
  weightKg: number | null | undefined;
  ageYears: number | null | undefined;
  sex?: CardioSex | null;
}): number | null {
  if (!isReliableHeartRate(input.avgHeartRate)) return null;
  const w = input.weightKg;
  const age = input.ageYears;
  if (w == null || !(w > 0) || age == null || !(age > 0) || age > 120) {
    return null;
  }
  const hr = input.avgHeartRate as number;
  const male = (-55.0969 + 0.6309 * hr + 0.1988 * w + 0.2017 * age) / 4.184;
  const female = (-20.4022 + 0.4472 * hr - 0.1263 * w + 0.074 * age) / 4.184;
  const perMin =
    input.sex === "male"
      ? male
      : input.sex === "female"
        ? female
        : (male + female) / 2;
  if (!Number.isFinite(perMin) || perMin <= 0) return null;
  return clampBurn(perMin);
}

/**
 * MET (ACSM, uproszczone) dla marszu / biegu w zależności od prędkości.
 * Interpolacja liniowa — marsz 5 km/h ≈ 3,8 MET, bieg 10 km/h ≈ 10 MET.
 */
const MET_BY_SPEED_KMH: ReadonlyArray<readonly [number, number]> = [
  [3.2, 2.8],
  [4.0, 3.0],
  [4.8, 3.5],
  [5.6, 4.3],
  [6.4, 5.0],
  [8.0, 8.3],
  [9.7, 9.8],
  [10.8, 10.5],
  [12.0, 11.8],
  [16.0, 14.5],
];

export function metFromSpeedKmh(kmh: number): number | null {
  if (!Number.isFinite(kmh) || !(kmh > 0)) return null;
  const first = MET_BY_SPEED_KMH[0]!;
  const last = MET_BY_SPEED_KMH[MET_BY_SPEED_KMH.length - 1]!;
  if (kmh <= first[0]) return first[1];
  if (kmh >= last[0]) return last[1];
  for (let i = 1; i < MET_BY_SPEED_KMH.length; i++) {
    const [x1, y1] = MET_BY_SPEED_KMH[i]!;
    const [x0, y0] = MET_BY_SPEED_KMH[i - 1]!;
    if (kmh <= x1) {
      return y0 + ((kmh - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return last[1];
}

function isFootSample(s: RecentCardioSample): boolean {
  const t = s.cardioType;
  return t == null || FOOT_CARDIO_TYPES.has(t);
}

/**
 * Próbki z wiarygodnymi kcal. `netWeightKg !== undefined` → kcal przeliczane na netto
 * (null = domyślna waga do metabolizmu spoczynkowego).
 */
function samplesWithEnteredCalories(
  samples: RecentCardioSample[],
  netWeightKg?: number | null,
): Array<{
  minutes: number;
  calories: number;
}> {
  const out: Array<{ minutes: number; calories: number }> = [];
  for (const s of samples) {
    if (!(s.minutes > 0)) continue;
    if (!isPlausibleEnteredCalories(s.minutes, s.calories)) continue;
    const calories =
      netWeightKg === undefined
        ? (s.calories as number)
        : grossToNetKcal(s.calories as number, s.minutes, netWeightKg);
    out.push({ minutes: s.minutes, calories });
  }
  return out;
}

/** Personal burn: ≥10 treningów z kcal i ≥200 min. */
export function computePersonalBurnRate(
  samples: RecentCardioSample[],
  netWeightKg?: number | null,
): number | null {
  const withKcal = samplesWithEnteredCalories(samples, netWeightKg);
  const minutes = withKcal.reduce((a, s) => a + s.minutes, 0);
  const calories = withKcal.reduce((a, s) => a + s.calories, 0);
  if (withKcal.length < PERSONAL_MIN_WORKOUTS || minutes < PERSONAL_MIN_MINUTES) {
    return null;
  }
  if (!(calories > 0) || !(minutes > 0)) return null;
  return clampBurn(calories / minutes);
}

function averageReliableHeartRate(
  samples: RecentCardioSample[],
): number | null {
  let weighted = 0;
  let minutes = 0;
  for (const s of samples) {
    if (!(s.minutes > 0)) continue;
    if (!isReliableHeartRate(s.avgHeartRate)) continue;
    weighted += (s.avgHeartRate as number) * s.minutes;
    minutes += s.minutes;
  }
  if (minutes <= 0) return null;
  return Math.round(weighted / minutes);
}

/**
 * Hierarchia spalania NETTO kcal/min (do estymacji minut / wpisów bez kcal):
 * personal (≥10/200) → [korekta HR] → calories_entered (słabsza historia)
 * → HR → MET (z prędkości, marsz/bieg/bieżnia) → default.
 */
export function estimateBurnKcalPerMin(input: {
  weightKg: number | null;
  ageYears?: number | null;
  sex?: CardioSex | null;
  recentCardio: RecentCardioSample[];
}): {
  burnKcalPerMin: number;
  burnSource: BurnSource;
  recentPaceMinPerKm: number | null;
  personalBurnRate: number | null;
  heartRateBurnRate: number | null;
} {
  const samples = input.recentCardio.filter(
    (s) => s.minutes > 0 && Number.isFinite(s.minutes),
  );

  // Tempo i MET tylko z aktywności „piechotą”; MET liczony per próbka, nie z uśrednionego tempa.
  let paceWeighted = 0;
  let metWeighted = 0;
  let paceMinutes = 0;
  for (const s of samples) {
    if (!isFootSample(s)) continue;
    const pace = s.paceMinPerKm;
    if (pace == null || !(pace >= PACE_MIN && pace <= PACE_MAX)) continue;
    const met = metFromSpeedKmh(60 / pace);
    if (met == null) continue;
    paceWeighted += pace * s.minutes;
    metWeighted += met * s.minutes;
    paceMinutes += s.minutes;
  }
  const recentPaceMinPerKm =
    paceMinutes > 0 ? round1(paceWeighted / paceMinutes) : null;

  const netWeight = input.weightKg ?? null;
  const personalBurnRate = computePersonalBurnRate(samples, netWeight);
  const avgHr = averageReliableHeartRate(samples);
  const heartRateGross = estimateHeartRateBurnKcalPerMin({
    avgHeartRate: avgHr,
    weightKg: input.weightKg,
    ageYears: input.ageYears ?? null,
    sex: input.sex ?? null,
  });
  const heartRateBurnRate =
    heartRateGross != null
      ? grossToNetKcalPerMin(heartRateGross, input.weightKg)
      : null;

  if (personalBurnRate != null && heartRateBurnRate != null) {
    return {
      burnKcalPerMin: clampBurn(
        0.7 * personalBurnRate + 0.3 * heartRateBurnRate,
      ),
      burnSource: "personal_model",
      recentPaceMinPerKm,
      personalBurnRate,
      heartRateBurnRate,
    };
  }
  if (personalBurnRate != null) {
    return {
      burnKcalPerMin: personalBurnRate,
      burnSource: "personal_model",
      recentPaceMinPerKm,
      personalBurnRate,
      heartRateBurnRate,
    };
  }

  const withKcal = samplesWithEnteredCalories(samples, netWeight);
  const kcalSum = withKcal.reduce((a, s) => a + s.calories, 0);
  const minSum = withKcal.reduce((a, s) => a + s.minutes, 0);
  if (minSum >= 10 && kcalSum > 0) {
    return {
      burnKcalPerMin: clampBurn(kcalSum / minSum),
      burnSource: "calories_entered",
      recentPaceMinPerKm,
      personalBurnRate,
      heartRateBurnRate,
    };
  }

  if (heartRateBurnRate != null) {
    return {
      burnKcalPerMin: heartRateBurnRate,
      burnSource: "heart_rate_model",
      recentPaceMinPerKm,
      personalBurnRate,
      heartRateBurnRate,
    };
  }

  const w =
    input.weightKg != null && Number.isFinite(input.weightKg) && input.weightKg > 0
      ? input.weightKg
      : DEFAULT_WEIGHT_KG;

  const hasPace = paceMinutes > 0;
  const met = hasPace ? metWeighted / paceMinutes : DEFAULT_MET;
  // MET to wydatek brutto (1 MET = spoczynek) → netto = (MET − 1) × kg / 60.
  const netPerMin = Math.max(0, met - 1) * (w / 60);

  return {
    burnKcalPerMin: clampBurn(netPerMin),
    burnSource: hasPace ? "met_model" : "default",
    recentPaceMinPerKm,
    personalBurnRate,
    heartRateBurnRate,
  };
}

/**
 * Spalone kcal cardio w bieżącym tygodniu (wszystkie minuty w pn–nd).
 * Gdy brak (wiarygodnych) kcal w wpisie — szacunek z minut × burnKcalPerMin.
 * Gdy są calories — używamy ich; przy `netWeightKg !== undefined` przeliczone na netto.
 */
export function cardioKcalInWeek(
  samples: RecentCardioSample[],
  weekKeys: string[],
  burnKcalPerMin: number,
  netWeightKg?: number | null,
): number {
  const set = new Set(weekKeys);
  let sum = 0;
  for (const s of samples) {
    if (!s.dateKey || !set.has(s.dateKey)) continue;
    if (isPlausibleEnteredCalories(s.minutes, s.calories)) {
      sum +=
        netWeightKg === undefined
          ? (s.calories as number)
          : grossToNetKcal(s.calories as number, s.minutes, netWeightKg);
      continue;
    }
    if (s.minutes > 0 && burnKcalPerMin > 0) {
      sum += s.minutes * burnKcalPerMin;
    }
  }
  return Math.round(sum);
}

/** Liczba dni pon→dziś włącznie. */
export function elapsedWeekDayCount(
  todayKey: string,
  weekKeys: string[],
): number {
  const idx = weekKeys.indexOf(todayKey);
  if (idx < 0) return 1;
  return idx + 1;
}

/**
 * Tylko cardio powyżej pełnego celu tygodnia obniża dług makro.
 *
 * Nie używamy pro-rata (cel × dni/7): wczesne domknięcie planu w sobotę
 * tworzyło „sztuczny nadmiar”, który znikał w niedzielę i zawyżał dodatkowe minuty.
 * Zwykłe cardio w ramach tygodniowego celu nadal nie kasuje propozycji.
 * Wpisy z (wiarygodnymi) calories używają podanych kcal.
 */
export function cardioKcalAboveWeeklyGoal(input: {
  samples: RecentCardioSample[];
  weekKeys: string[];
  /** Zachowane dla kompatybilności wywołań — próg to pełny cel tygodnia. */
  todayKey?: string;
  weeklyCardioGoalMinutes: number;
  burnKcalPerMin: number;
  /** undefined → kcal z wpisów bez przeliczenia na netto. */
  netWeightKg?: number | null;
}): { offsetKcal: number; totalMinutes: number; goalMinutes: number } {
  const set = new Set(input.weekKeys);
  let totalMinutes = 0;
  let totalKcal = 0;
  for (const s of input.samples) {
    if (!s.dateKey || !set.has(s.dateKey)) continue;
    if (!(s.minutes > 0)) continue;
    totalMinutes += s.minutes;
    if (isPlausibleEnteredCalories(s.minutes, s.calories)) {
      totalKcal +=
        input.netWeightKg === undefined
          ? (s.calories as number)
          : grossToNetKcal(s.calories as number, s.minutes, input.netWeightKg);
    } else if (input.burnKcalPerMin > 0) {
      totalKcal += s.minutes * input.burnKcalPerMin;
    }
  }

  const goalMinutes = Math.max(0, input.weeklyCardioGoalMinutes);
  const excessMinutes = Math.max(0, totalMinutes - goalMinutes);
  if (excessMinutes <= 0 || totalMinutes <= 0) {
    return { offsetKcal: 0, totalMinutes, goalMinutes };
  }
  const offsetKcal = Math.round(totalKcal * (excessMinutes / totalMinutes));
  return { offsetKcal, totalMinutes, goalMinutes };
}

/**
 * Niewyrównana nadwyżka makro/kcal w tygodniu.
 * - dni minione: bilans z soft creditem za deficyt,
 * - dziś: tylko nadwyżka (dzień niedokończony nie daje kredytu),
 * - offset cardio ≤ dług przed cardio (może go domknąć do 0).
 */
export function computeOpenMacroDebt(input: {
  todayKey: string;
  elapsedDays: Array<{ dateKey: string; day: MacroDaySnapshot }>;
  recentCardio: RecentCardioSample[];
  weekKeys: string[];
  burnKcalPerMin: number;
  weeklyCardioGoalMinutes?: number;
  netWeightKg?: number | null;
}): {
  openDebtKcal: number;
  pastDebtKcal: number;
  todaySurplusKcal: number;
  cardioOffsetKcal: number;
  debtBeforeCardioKcal: number;
  exceeded: ExceededMacro[];
} {
  const past = input.elapsedDays.filter((d) => d.dateKey < input.todayKey);
  const todayEntry = input.elapsedDays.find((d) => d.dateKey === input.todayKey);
  const today = todayEntry?.day;

  let pastNet = 0;
  const exceededAcc = new Set<ExceededMacro>();
  for (const { day } of past) {
    const bal = dayCalorieBalance(day);
    if (bal != null) pastNet += bal;
    for (const m of macroSurplusKcal(day).exceeded) exceededAcc.add(m);
  }
  const pastDebtKcal = Math.max(0, Math.round(pastNet));

  let todaySurplusKcal = 0;
  if (today) {
    const { surplusKcal, exceeded } = macroSurplusKcal(today);
    todaySurplusKcal = surplusKcal;
    for (const m of exceeded) exceededAcc.add(m);
  }

  const debtBeforeCardioKcal = Math.max(
    0,
    Math.round(pastDebtKcal + todaySurplusKcal),
  );

  const { offsetKcal: computedOffset } = cardioKcalAboveWeeklyGoal({
    samples: input.recentCardio,
    weekKeys: input.weekKeys,
    todayKey: input.todayKey,
    weeklyCardioGoalMinutes: input.weeklyCardioGoalMinutes ?? 0,
    burnKcalPerMin: input.burnKcalPerMin,
    netWeightKg: input.netWeightKg,
  });

  const cardioOffsetKcal = Math.min(computedOffset, debtBeforeCardioKcal);

  const openDebtKcal = Math.max(
    0,
    Math.round(debtBeforeCardioKcal - cardioOffsetKcal),
  );

  return {
    openDebtKcal,
    pastDebtKcal,
    todaySurplusKcal,
    cardioOffsetKcal,
    debtBeforeCardioKcal,
    exceeded: [...exceededAcc],
  };
}

/** Etykiety PL do tooltipa Pulpitu. */
export const BURN_SOURCE_LABEL_PL: Record<BurnSource, string> = {
  calories_entered: "Z kcal wpisanych przy cardio",
  personal_model: "Z Twojej historii cardio",
  heart_rate_model: "Z tętna",
  met_model: "Z tempa (MET)",
  default: "Szacunek (MET)",
};

/** Prefiksy linii explanation — muszą zgadzać się z UI (filtr duplikatów). */
export const EXTRA_CARDIO_LABEL_PL = {
  openDebt: "Niewyrównana nadwyżka",
  effectiveDebt: "Do odrobienia cardio",
  cardioOffset: "Już odrobione cardio",
  burnRate: "Tempo spalania",
  burnSource: "Skąd tempo spalania",
} as const;

export function computeExtraCardioAdvice(
  input: ExtraCardioInput,
): ExtraCardioAdvice {
  const daysLeft = daysLeftInWeekIncludingToday(input.todayKey, input.weekKeys);
  const daysAfterToday = Math.max(0, daysLeft - 1);

  const burn = estimateBurnKcalPerMin({
    weightKg: input.weightKg,
    ageYears: input.ageYears ?? null,
    sex: input.sex ?? null,
    recentCardio: input.recentCardio,
  });
  const { burnKcalPerMin, burnSource, recentPaceMinPerKm } = burn;

  const debt = computeOpenMacroDebt({
    todayKey: input.todayKey,
    elapsedDays: input.elapsedDays,
    recentCardio: input.recentCardio,
    weekKeys: input.weekKeys,
    burnKcalPerMin,
    weeklyCardioGoalMinutes: input.weeklyCardioGoalMinutes ?? 0,
    netWeightKg: input.weightKg ?? null,
  });

  const debtBefore = debt.debtBeforeCardioKcal;
  const openDebt = debt.openDebtKcal;

  const dailyGoal =
    input.today.caloriesGoal != null && input.today.caloriesGoal > 0
      ? input.today.caloriesGoal
      : 2000;

  // Szansa dietetycznego wyrównania liczona od długu PRZED cardio — stabilna
  // niezależnie od tego, ile cardio już zrobiono.
  const slackPerFutureDay = dailyGoal * 0.12;
  const absorbCapacity = daysAfterToday * slackPerFutureDay;
  const rawBalance =
    debtBefore > 0 ? Math.min(1, absorbCapacity / debtBefore) : 1;
  const timeFactor = daysAfterToday / 6;
  const balanceChance = Math.min(
    1,
    Math.max(0, rawBalance * (0.25 + 0.75 * timeFactor)),
  );
  const balanceChancePct = Math.round(balanceChance * 100);

  // Cel cardio = dług przed cardio pomniejszony o część do odroczenia dietą.
  // Offset odejmujemy od celu (nie od długu po cardio), więc wykonanie zalecanych
  // minut sprowadza rekomendację do zera zamiast zostawiać geometryczną resztę.
  const deferShare = balanceChance * 0.35;
  const targetKcal = Math.round(debtBefore * (1 - deferShare));

  // effectiveSurplus nigdy nie przekracza openDebt.
  const effectiveSurplusKcal = Math.min(
    openDebt,
    Math.max(0, targetKcal - debt.cardioOffsetKcal),
  );

  let extraMinutes =
    effectiveSurplusKcal >= MIN_DEBT_KCAL && burnKcalPerMin > 0
      ? Math.ceil(effectiveSurplusKcal / burnKcalPerMin)
      : 0;
  extraMinutes = Math.min(90, Math.max(0, extraMinutes));
  if (extraMinutes > 0 && extraMinutes < 5) extraMinutes = 5;

  // Spalanie oszacowano przy ostatnim tempie — to samo tempo zalecamy
  // (szybsze tempo zmieniłoby kcal/min, a minuty liczone są po starym).
  const suggestedPaceMinPerKm = recentPaceMinPerKm;

  const show =
    openDebt >= MIN_DEBT_KCAL &&
    effectiveSurplusKcal >= MIN_DEBT_KCAL &&
    extraMinutes > 0;

  const explanation: string[] = [
    `${EXTRA_CARDIO_LABEL_PL.openDebt}: ${show ? openDebt : 0} kcal`,
    `${EXTRA_CARDIO_LABEL_PL.effectiveDebt}: ${show ? effectiveSurplusKcal : 0} kcal`,
    `${EXTRA_CARDIO_LABEL_PL.cardioOffset}: ${debt.cardioOffsetKcal} kcal`,
    `${EXTRA_CARDIO_LABEL_PL.burnRate}: ${burnKcalPerMin} kcal/min`,
    `${EXTRA_CARDIO_LABEL_PL.burnSource}: ${BURN_SOURCE_LABEL_PL[burnSource]}`,
  ];
  if (daysLeft > 0) {
    explanation.push(
      `Do końca tygodnia: ${daysLeft} ${daysLeft === 1 ? "dzień" : "dni"} — szansa wyrównania dietą: ${balanceChancePct}%.`,
    );
  }
  if (show) {
    explanation.push(
      `→ ok. ${extraMinutes} min dodatkowego cardio` +
        (recentPaceMinPerKm != null
          ? ` (tempo ~${formatPaceShort(recentPaceMinPerKm)}/km)`
          : "") +
        ".",
    );
  }

  const summary = show
    ? `+${extraMinutes} min dodatkowego cardio (~${effectiveSurplusKcal} kcal do odrobienia).`
    : "Brak rekomendacji dodatkowego cardio.";

  return {
    show,
    extraMinutes: show ? extraMinutes : 0,
    surplusKcal: show ? openDebt : 0,
    effectiveSurplusKcal: show ? effectiveSurplusKcal : 0,
    cardioOffsetKcal: debt.cardioOffsetKcal,
    daysLeftInWeek: daysLeft,
    balanceChancePct,
    burnKcalPerMin,
    burnSource,
    recentPaceMinPerKm,
    suggestedPaceMinPerKm: show ? suggestedPaceMinPerKm : null,
    exceededMacros: debt.exceeded,
    summary,
    explanation,
  };
}

function formatPaceShort(paceMinPerKm: number): string {
  const whole = Math.floor(paceMinPerKm);
  const secs = Math.round((paceMinPerKm - whole) * 60);
  const s = secs === 60 ? 0 : secs;
  const m = secs === 60 ? whole + 1 : whole;
  return `${m}:${String(s).padStart(2, "0")}`;
}
