/**
 * Dodatkowe cardio przy rzeczywistej nadwyżce energetycznej.
 *
 * Zasady:
 * - effectiveSurplus ≤ openDebt
 * - płynny soft credit (bez skoku przy 55%)
 * - samo białko przy kcal ≤ celu nie tworzy długu
 * - spalanie: kcal z wpisu → model osobisty → tętno (korekta) → MET → default
 * - offset cardio max 80% długu
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

export type RecentCardioSample = {
  minutes: number;
  calories: number | null;
  paceMinPerKm: number | null;
  /** Średnie tętno wpisane ręcznie po treningu — nie najwyższa wiarygodność. */
  avgHeartRate?: number | null;
  maxHeartRate?: number | null;
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
  recentCardio: RecentCardioSample[];
  /** Cel minut cardio / tydzień — do pro-rata (tylko nadmiar offsetuje dług). */
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
  /** Otwarty dług kcal (po diecie / cardio w tygodniu). */
  surplusKcal: number;
  /** Nadwyżka po defer / floors — zawsze ≤ surplusKcal. */
  effectiveSurplusKcal: number;
  /** Ile kcal zneutralizował offset cardio (po limicie 80%). */
  cardioOffsetKcal: number;
  /** Dni od dziś do niedzieli włącznie. */
  daysLeftInWeek: number;
  /** 0–100: szansa, że bilans złapie się dietą w pozostałe dni. */
  balanceChancePct: number;
  burnKcalPerMin: number;
  burnSource: BurnSource;
  recentPaceMinPerKm: number | null;
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
/** Max udział długu, który może zneutralizować offset cardio. */
const MAX_CARDIO_OFFSET_SHARE = 0.8;
const PERSONAL_MIN_WORKOUTS = 10;
const PERSONAL_MIN_MINUTES = 200;
const HR_MIN = 70;
const HR_MAX = 210;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clampBurn(n: number): number {
  return round1(Math.min(18, Math.max(3, n)));
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
 * Przy kcal ≤ celu samo białko nie zwiększa długu — liczą się kcal / tłuszcz / węgle.
 */
export function macroSurplusKcal(day: MacroDaySnapshot): {
  surplusKcal: number;
  exceeded: ExceededMacro[];
} {
  const proteinOver = overage(day.proteinConsumed, day.proteinGoal);
  const carbsOver = overage(day.carbsConsumed, day.carbsGoal);
  const fatOver = overage(day.fatConsumed, day.fatGoal);
  const calOver = overage(day.caloriesConsumed, day.caloriesGoal);

  const ignoreProtein = caloriesAtOrUnderGoal(day);
  const fromMacros =
    (ignoreProtein ? 0 : proteinOver * KCAL_PER_G.protein) +
    carbsOver * KCAL_PER_G.carbs +
    fatOver * KCAL_PER_G.fat;

  const surplusKcal = Math.round(Math.max(fromMacros, calOver));

  const exceeded: ExceededMacro[] = [];
  if (!ignoreProtein && proteinOver > 0) exceeded.push("protein");
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
 * Model Keytela (męski jako uniseks przy braku płci) — kcal/min z tętna.
 * Zwraca null przy niewiarygodnym tętnie / braku wagi lub wieku.
 */
export function estimateHeartRateBurnKcalPerMin(input: {
  avgHeartRate: number | null | undefined;
  weightKg: number | null | undefined;
  ageYears: number | null | undefined;
}): number | null {
  if (!isReliableHeartRate(input.avgHeartRate)) return null;
  const w = input.weightKg;
  const age = input.ageYears;
  if (w == null || !(w > 0) || age == null || !(age > 0) || age > 120) {
    return null;
  }
  const hr = input.avgHeartRate as number;
  const perMin =
    (-55.0969 + 0.6309 * hr + 0.1988 * w + 0.2017 * age) / 4.184;
  if (!Number.isFinite(perMin) || perMin <= 0) return null;
  return clampBurn(perMin);
}

function samplesWithEnteredCalories(samples: RecentCardioSample[]): Array<{
  minutes: number;
  calories: number;
}> {
  const out: Array<{ minutes: number; calories: number }> = [];
  for (const s of samples) {
    if (!(s.minutes > 0)) continue;
    if (s.calories == null || !(s.calories > 0)) continue;
    out.push({ minutes: s.minutes, calories: s.calories });
  }
  return out;
}

/** Personal burn: ≥10 treningów z kcal i ≥200 min. */
export function computePersonalBurnRate(
  samples: RecentCardioSample[],
): number | null {
  const withKcal = samplesWithEnteredCalories(samples);
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
 * Hierarchia spalania kcal/min (do estymacji minut / wpisów bez kcal):
 * personal (≥10/200) → [korekta HR] → calories_entered (słabsza historia)
 * → HR → MET → default.
 */
export function estimateBurnKcalPerMin(input: {
  weightKg: number | null;
  ageYears?: number | null;
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

  let paceWeighted = 0;
  let paceMinutes = 0;
  for (const s of samples) {
    if (s.paceMinPerKm != null && s.paceMinPerKm > 0) {
      paceWeighted += s.paceMinPerKm * s.minutes;
      paceMinutes += s.minutes;
    }
  }
  const recentPaceMinPerKm =
    paceMinutes > 0 ? round1(paceWeighted / paceMinutes) : null;

  const personalBurnRate = computePersonalBurnRate(samples);
  const avgHr = averageReliableHeartRate(samples);
  const heartRateBurnRate = estimateHeartRateBurnKcalPerMin({
    avgHeartRate: avgHr,
    weightKg: input.weightKg,
    ageYears: input.ageYears ?? null,
  });

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

  const withKcal = samplesWithEnteredCalories(samples);
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
      : 75;

  let met = 5.5;
  let source: BurnSource = "default";
  if (recentPaceMinPerKm != null && recentPaceMinPerKm > 0) {
    const kmh = 60 / recentPaceMinPerKm;
    met = Math.min(12, Math.max(2.8, 1.15 * kmh));
    source = "met_model";
  }

  return {
    burnKcalPerMin: clampBurn((met * w) / 60),
    burnSource: source,
    recentPaceMinPerKm,
    personalBurnRate,
    heartRateBurnRate,
  };
}

/**
 * Spalone kcal cardio w bieżącym tygodniu (wszystkie minuty w pn–nd).
 * Gdy brak kcal w wpisie — szacunek z minut × burnKcalPerMin.
 * Gdy są calories — używamy ich bez przeliczania.
 */
export function cardioKcalInWeek(
  samples: RecentCardioSample[],
  weekKeys: string[],
  burnKcalPerMin: number,
): number {
  const set = new Set(weekKeys);
  let sum = 0;
  for (const s of samples) {
    if (!s.dateKey || !set.has(s.dateKey)) continue;
    if (s.calories != null && s.calories > 0) {
      sum += s.calories;
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
 * Tylko cardio powyżej pro-rata celu tygodnia (pn→dziś) obniża dług makro.
 * Wpisy z calories używają podanych kcal (bez przeliczenia).
 */
export function cardioKcalAboveProRataGoal(input: {
  samples: RecentCardioSample[];
  weekKeys: string[];
  todayKey: string;
  weeklyCardioGoalMinutes: number;
  burnKcalPerMin: number;
}): { offsetKcal: number; totalMinutes: number; proRataGoalMinutes: number } {
  const set = new Set(input.weekKeys);
  let totalMinutes = 0;
  let totalKcal = 0;
  for (const s of input.samples) {
    if (!s.dateKey || !set.has(s.dateKey)) continue;
    if (!(s.minutes > 0)) continue;
    totalMinutes += s.minutes;
    if (s.calories != null && s.calories > 0) {
      totalKcal += s.calories;
    } else if (input.burnKcalPerMin > 0) {
      totalKcal += s.minutes * input.burnKcalPerMin;
    }
  }

  const elapsed = elapsedWeekDayCount(input.todayKey, input.weekKeys);
  const goal = Math.max(0, input.weeklyCardioGoalMinutes);
  const proRataGoalMinutes =
    goal > 0 ? Math.round((goal * elapsed) / 7) : 0;
  const excessMinutes = Math.max(0, totalMinutes - proRataGoalMinutes);
  if (excessMinutes <= 0 || totalMinutes <= 0) {
    return { offsetKcal: 0, totalMinutes, proRataGoalMinutes };
  }
  const offsetKcal = Math.round(totalKcal * (excessMinutes / totalMinutes));
  return { offsetKcal, totalMinutes, proRataGoalMinutes };
}

/**
 * Otwarty dług makro/kcal w tygodniu.
 * Cardio offset ≤ 80% długu przed offsetem.
 */
export function computeOpenMacroDebt(input: {
  todayKey: string;
  elapsedDays: Array<{ dateKey: string; day: MacroDaySnapshot }>;
  recentCardio: RecentCardioSample[];
  weekKeys: string[];
  burnKcalPerMin: number;
  weeklyCardioGoalMinutes?: number;
}): {
  openDebtKcal: number;
  pastDebtKcal: number;
  todaySurplusKcal: number;
  todaySoftCreditKcal: number;
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
  let todaySoftCreditKcal = 0;
  if (today) {
    const { surplusKcal, exceeded } = macroSurplusKcal(today);
    todaySurplusKcal = surplusKcal;
    for (const m of exceeded) exceededAcc.add(m);
    todaySoftCreditKcal = softCreditKcal(today);
  }

  const debtBeforeCardioKcal = Math.max(
    0,
    Math.round(pastDebtKcal + todaySurplusKcal - todaySoftCreditKcal),
  );

  const { offsetKcal: computedOffset } = cardioKcalAboveProRataGoal({
    samples: input.recentCardio,
    weekKeys: input.weekKeys,
    todayKey: input.todayKey,
    weeklyCardioGoalMinutes: input.weeklyCardioGoalMinutes ?? 0,
    burnKcalPerMin: input.burnKcalPerMin,
  });

  const cardioOffsetKcal = Math.min(
    computedOffset,
    Math.round(debtBeforeCardioKcal * MAX_CARDIO_OFFSET_SHARE),
  );

  const openDebtKcal = Math.max(
    0,
    Math.round(debtBeforeCardioKcal - cardioOffsetKcal),
  );

  return {
    openDebtKcal,
    pastDebtKcal,
    todaySurplusKcal,
    todaySoftCreditKcal,
    cardioOffsetKcal,
    debtBeforeCardioKcal,
    exceeded: [...exceededAcc],
  };
}

const BURN_SOURCE_LABEL: Record<BurnSource, string> = {
  calories_entered: "Calories entered",
  personal_model: "Personal model",
  heart_rate_model: "Heart rate model",
  met_model: "MET model",
  default: "MET model",
};

export function computeExtraCardioAdvice(
  input: ExtraCardioInput,
): ExtraCardioAdvice {
  const daysLeft = daysLeftInWeekIncludingToday(input.todayKey, input.weekKeys);
  const daysAfterToday = Math.max(0, daysLeft - 1);

  const burn = estimateBurnKcalPerMin({
    weightKg: input.weightKg,
    ageYears: input.ageYears ?? null,
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
  });

  const openDebt = debt.openDebtKcal;

  const dailyGoal =
    input.today.caloriesGoal != null && input.today.caloriesGoal > 0
      ? input.today.caloriesGoal
      : 2000;

  const slackPerFutureDay = dailyGoal * 0.12;
  const absorbCapacity = daysAfterToday * slackPerFutureDay;
  const rawBalance =
    openDebt > 0 ? Math.min(1, absorbCapacity / openDebt) : 1;
  const timeFactor = daysAfterToday / 6;
  const balanceChance = Math.min(
    1,
    Math.max(0, rawBalance * (0.25 + 0.75 * timeFactor)),
  );
  const balanceChancePct = Math.round(balanceChance * 100);

  const deferShare = balanceChance * 0.35;
  const baseEffective = Math.round(Math.max(0, openDebt * (1 - deferShare)));

  const hardMacro = (["protein", "carbs", "fat"] as const).some((k) => {
    if (k === "protein" && caloriesAtOrUnderGoal(input.today)) return false;
    const goal =
      k === "protein"
        ? input.today.proteinGoal
        : k === "carbs"
          ? input.today.carbsGoal
          : input.today.fatGoal;
    const consumed =
      k === "protein"
        ? input.today.proteinConsumed
        : k === "carbs"
          ? input.today.carbsConsumed
          : input.today.fatConsumed;
    return goal != null && goal > 0 && consumed >= goal * 1.15;
  });
  const hardMacroFloor =
    hardMacro && openDebt > 0 ? Math.round(openDebt * 0.4) : 0;
  const pastDebtFloor =
    debt.pastDebtKcal > 0
      ? Math.round(Math.min(debt.pastDebtKcal, openDebt) * 0.65)
      : 0;
  const effectiveFloor = Math.max(hardMacroFloor, pastDebtFloor);

  // effectiveSurplus nigdy nie przekracza openDebt.
  const effectiveSurplusKcal = Math.min(
    openDebt,
    Math.max(baseEffective, effectiveFloor),
  );

  let extraMinutes =
    effectiveSurplusKcal >= MIN_DEBT_KCAL && burnKcalPerMin > 0
      ? Math.ceil(effectiveSurplusKcal / burnKcalPerMin)
      : 0;
  extraMinutes = Math.min(90, Math.max(0, extraMinutes));
  if (extraMinutes > 0 && extraMinutes < 5) extraMinutes = 5;

  let suggestedPaceMinPerKm: number | null = null;
  if (recentPaceMinPerKm != null && recentPaceMinPerKm > 0 && extraMinutes >= 15) {
    suggestedPaceMinPerKm = round1(Math.max(4.5, recentPaceMinPerKm * 0.92));
  } else if (recentPaceMinPerKm != null) {
    suggestedPaceMinPerKm = recentPaceMinPerKm;
  }

  const show =
    openDebt >= MIN_DEBT_KCAL &&
    effectiveSurplusKcal >= MIN_DEBT_KCAL &&
    extraMinutes > 0;

  const explanation: string[] = [
    `Open debt: ${show ? openDebt : 0} kcal`,
    `Effective debt: ${show ? effectiveSurplusKcal : 0} kcal`,
    `Cardio offset: ${debt.cardioOffsetKcal} kcal`,
    `Spalanie: ${burnKcalPerMin} kcal/min`,
    `Źródło spalania: ${BURN_SOURCE_LABEL[burnSource]}`,
  ];
  if (daysLeft > 0) {
    explanation.push(
      `Do końca tygodnia: ${daysLeft} ${daysLeft === 1 ? "dzień" : "dni"} — szansa dociągnięcia dietą: ${balanceChancePct}%.`,
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
    ? `+${extraMinutes} min cardio na otwartą nadwyżkę (~${effectiveSurplusKcal} kcal).`
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
