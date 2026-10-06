/**
 * Dodatkowe cardio przy nadwyżce makro / kcal.
 * Dług jest dynamiczny w skali tygodnia (pon–dziś): wczorajsza nadwyżka
 * widać dziś; po wyrównaniu dietą / cardio pasek znika.
 *
 * Wzór (skrót):
 * 1) Nadwyżka dnia = max(kcal ponad cel, B×4 + W×4 + T×9 ponad cele)
 * 2) Otwarty dług = Σ bilansów dni z danymi (pon–wczoraj)
 *                 + dzisiejsza nadwyżka
 *                 − miękki kredyt dziś (≥55% celu i poniżej celu)
 *                 − spalenie cardio w tygodniu
 * 3) Effective = dług × (1 − defer), defer ≤ 35% × szansa wyrównania dietą
 * 4) Minuty = ceil(effective / kcal_na_min), clamp 5–90
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
  recentCardio: RecentCardioSample[];
};

export type ExceededMacro = "protein" | "carbs" | "fat" | "calories";

export type ExtraCardioAdvice = {
  /** Czy pokazać niebieski segment na pasku. */
  show: boolean;
  /** Minuty cardio ponad tygodniowy cel — do „spalenia” nadwyżki. */
  extraMinutes: number;
  /** Otwarty dług kcal (po diecie / cardio w tygodniu). */
  surplusKcal: number;
  /** Nadwyżka po uwzględnieniu szansy wyrównania w pozostałe dni. */
  effectiveSurplusKcal: number;
  /** Dni od dziś do niedzieli włącznie. */
  daysLeftInWeek: number;
  /** 0–100: szansa, że bilans złapie się dietą w pozostałe dni. */
  balanceChancePct: number;
  burnKcalPerMin: number;
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
/** Miękki kredyt / kredyt z przeszłości dopiero przy realnym dniu posiłków. */
const SOFT_CREDIT_INTAKE_PCT = 0.55;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function overage(consumed: number, goal: number | null): number {
  if (goal == null || !Number.isFinite(goal) || goal <= 0) return 0;
  return Math.max(0, consumed - goal);
}

export function macroSurplusKcal(day: MacroDaySnapshot): {
  surplusKcal: number;
  exceeded: ExceededMacro[];
} {
  const proteinOver = overage(day.proteinConsumed, day.proteinGoal);
  const carbsOver = overage(day.carbsConsumed, day.carbsGoal);
  const fatOver = overage(day.fatConsumed, day.fatGoal);
  const calOver = overage(day.caloriesConsumed, day.caloriesGoal);

  const fromMacros =
    proteinOver * KCAL_PER_G.protein +
    carbsOver * KCAL_PER_G.carbs +
    fatOver * KCAL_PER_G.fat;

  // Max — unikamy podwójnego liczenia, gdy kcal już wynikają z makro.
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
 * Bilans dnia do sumy tygodnia:
 * - nadwyżka → +kcal,
 * - realny deficyt (≥55% celu i poniżej) → −kcal,
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

  // Kredyt deficytu tylko gdy dzień jest „w toku” (≥55% celu).
  if (day.caloriesConsumed >= day.caloriesGoal * SOFT_CREDIT_INTAKE_PCT) {
    return calNet;
  }
  return null;
}

export function daysLeftInWeekIncludingToday(
  todayKey: string,
  weekKeys: string[],
): number {
  const idx = weekKeys.indexOf(todayKey);
  if (idx < 0) return 1;
  return weekKeys.length - idx;
}

/**
 * Szacunek spalania kcal/min z historii albo z tempa + masy.
 * kcal/min ≈ MET × masa_kg / 60; MET ≈ 1.15 × km/h z tempa.
 */
export function estimateBurnKcalPerMin(input: {
  weightKg: number | null;
  recentCardio: RecentCardioSample[];
}): { burnKcalPerMin: number; recentPaceMinPerKm: number | null } {
  const samples = input.recentCardio.filter(
    (s) => s.minutes > 0 && Number.isFinite(s.minutes),
  );

  let kcalSum = 0;
  let minSum = 0;
  let paceWeighted = 0;
  let paceMinutes = 0;

  for (const s of samples) {
    if (s.calories != null && s.calories > 0) {
      kcalSum += s.calories;
      minSum += s.minutes;
    }
    if (s.paceMinPerKm != null && s.paceMinPerKm > 0) {
      paceWeighted += s.paceMinPerKm * s.minutes;
      paceMinutes += s.minutes;
    }
  }

  const recentPaceMinPerKm =
    paceMinutes > 0 ? round1(paceWeighted / paceMinutes) : null;

  if (minSum >= 10 && kcalSum > 0) {
    return {
      burnKcalPerMin: round1(Math.min(18, Math.max(3, kcalSum / minSum))),
      recentPaceMinPerKm,
    };
  }

  const w =
    input.weightKg != null && Number.isFinite(input.weightKg) && input.weightKg > 0
      ? input.weightKg
      : 75;

  let met = 5.5;
  if (recentPaceMinPerKm != null && recentPaceMinPerKm > 0) {
    const kmh = 60 / recentPaceMinPerKm;
    met = Math.min(12, Math.max(2.8, 1.15 * kmh));
  }

  return {
    burnKcalPerMin: round1(Math.min(18, Math.max(3, (met * w) / 60))),
    recentPaceMinPerKm,
  };
}

/**
 * Spalone kcal cardio w bieżącym tygodniu.
 * Gdy brak kcal w wpisie — szacunek z minut × burnKcalPerMin.
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

/**
 * Otwarty dług makro/kcal w tygodniu:
 * - wczorajsza (i wcześniejsza) nadwyżka przenosi się na dziś,
 * - puste dni nie kasują długu (nie liczą się jako −cel),
 * - dzisiejszy niewykorzystany cel NIE kasuje długu rano,
 * - wieczorem / po zjedzeniu ≥55% celu pod celem — miękki kredyt z dziś,
 * - spalenie z cardio w tygodniu obniża dług.
 */
export function computeOpenMacroDebt(input: {
  todayKey: string;
  elapsedDays: Array<{ dateKey: string; day: MacroDaySnapshot }>;
  recentCardio: RecentCardioSample[];
  weekKeys: string[];
  burnKcalPerMin: number;
}): {
  openDebtKcal: number;
  pastDebtKcal: number;
  todaySurplusKcal: number;
  todaySoftCreditKcal: number;
  cardioOffsetKcal: number;
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

    // Miękki kredyt dopiero gdy dzień jest „w toku posiłków” (≥55% celu)
    // i jesteśmy poniżej celu — wtedy widać realne odrabianie wczorajszej nadwyżki.
    if (
      today.caloriesGoal != null &&
      today.caloriesGoal > 0 &&
      today.caloriesConsumed >= today.caloriesGoal * SOFT_CREDIT_INTAKE_PCT &&
      today.caloriesConsumed < today.caloriesGoal
    ) {
      todaySoftCreditKcal = Math.round(
        today.caloriesGoal - today.caloriesConsumed,
      );
    }
  }

  const cardioOffsetKcal = cardioKcalInWeek(
    input.recentCardio,
    input.weekKeys,
    input.burnKcalPerMin,
  );

  const openDebtKcal = Math.max(
    0,
    Math.round(
      pastDebtKcal + todaySurplusKcal - todaySoftCreditKcal - cardioOffsetKcal,
    ),
  );

  return {
    openDebtKcal,
    pastDebtKcal,
    todaySurplusKcal,
    todaySoftCreditKcal,
    cardioOffsetKcal,
    exceeded: [...exceededAcc],
  };
}

export function computeExtraCardioAdvice(
  input: ExtraCardioInput,
): ExtraCardioAdvice {
  const daysLeft = daysLeftInWeekIncludingToday(input.todayKey, input.weekKeys);
  const daysAfterToday = Math.max(0, daysLeft - 1);

  const { burnKcalPerMin, recentPaceMinPerKm } = estimateBurnKcalPerMin({
    weightKg: input.weightKg,
    recentCardio: input.recentCardio,
  });

  const debt = computeOpenMacroDebt({
    todayKey: input.todayKey,
    elapsedDays: input.elapsedDays,
    recentCardio: input.recentCardio,
    weekKeys: input.weekKeys,
    burnKcalPerMin,
  });

  const surplusKcal = debt.openDebtKcal;

  const dailyGoal =
    input.today.caloriesGoal != null && input.today.caloriesGoal > 0
      ? input.today.caloriesGoal
      : 2000;

  // Reszta tygodnia (jutro–nd) może częściowo odrobić dług dietą — nie kasuje
  // jednak sygnału z wczoraj od razu rano.
  const slackPerFutureDay = dailyGoal * 0.12;
  const absorbCapacity = daysAfterToday * slackPerFutureDay;
  const rawBalance =
    surplusKcal > 0 ? Math.min(1, absorbCapacity / surplusKcal) : 1;
  const timeFactor = daysAfterToday / 6;
  const balanceChance = Math.min(
    1,
    Math.max(0, rawBalance * (0.25 + 0.75 * timeFactor)),
  );
  const balanceChancePct = Math.round(balanceChance * 100);

  // Wczorajszy dług: max ~35% da się odłożyć; reszta → cardio „na teraz”.
  const deferShare = balanceChance * 0.35;
  let effectiveSurplusKcal = Math.round(
    Math.max(0, surplusKcal * (1 - deferShare)),
  );

  // Duża bieżąca nadwyżka makro (≥15%) — minimum 40% do dopalenia.
  const hardMacro = (["protein", "carbs", "fat"] as const).some((k) => {
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
  if (hardMacro && surplusKcal > 0) {
    effectiveSurplusKcal = Math.max(
      effectiveSurplusKcal,
      Math.round(surplusKcal * 0.4),
    );
  }

  // Sam wczorajszy dług (bez odkładania wszystkiego na „jutro”).
  if (debt.pastDebtKcal > 0) {
    effectiveSurplusKcal = Math.max(
      effectiveSurplusKcal,
      Math.round(debt.pastDebtKcal * 0.65),
    );
  }

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
    surplusKcal >= MIN_DEBT_KCAL &&
    effectiveSurplusKcal >= MIN_DEBT_KCAL &&
    extraMinutes > 0;

  const macroLabels: Record<ExceededMacro, string> = {
    protein: "białko",
    carbs: "węglowodany",
    fat: "tłuszcze",
    calories: "kalorii",
  };
  const exceededLabel = debt.exceeded
    .filter((m) => m !== "calories")
    .map((m) => macroLabels[m])
    .join(", ");

  const explanation: string[] = [
    debt.pastDebtKcal > 0
      ? `Dług z wcześniejszych dni tygodnia: ok. ${debt.pastDebtKcal} kcal` +
        (exceededLabel ? ` (m.in. ${exceededLabel})` : "") +
        "."
      : `Otwarta nadwyżka: ok. ${surplusKcal} kcal` +
        (exceededLabel ? ` (przekroczone: ${exceededLabel})` : "") +
        ".",
  ];
  if (debt.todaySurplusKcal > 0) {
    explanation.push(`Dziś doliczono jeszcze ~${debt.todaySurplusKcal} kcal nadwyżki.`);
  }
  if (debt.todaySoftCreditKcal > 0) {
    explanation.push(
      `Dziś jesteś poniżej celu o ~${debt.todaySoftCreditKcal} kcal — to obniża dług.`,
    );
  }
  if (debt.cardioOffsetKcal > 0) {
    explanation.push(
      `Cardio w tym tygodniu spaliło już ok. ${debt.cardioOffsetKcal} kcal.`,
    );
  }
  explanation.push(
    `Do końca tygodnia: ${daysLeft} ${daysLeft === 1 ? "dzień" : "dni"} (w tym dziś) — szansa dociągnięcia dietą: ${balanceChancePct}%.`,
    `Do dopalenia zostaje ok. ${effectiveSurplusKcal} kcal → ~${extraMinutes} min cardio (~${burnKcalPerMin} kcal/min` +
      (recentPaceMinPerKm != null
        ? `, tempo ${formatPaceShort(recentPaceMinPerKm)}/km`
        : "") +
      `).`,
  );
  if (
    suggestedPaceMinPerKm != null &&
    recentPaceMinPerKm != null &&
    suggestedPaceMinPerKm < recentPaceMinPerKm - 0.05
  ) {
    explanation.push(
      `Sugerowane tempo: ${formatPaceShort(suggestedPaceMinPerKm)}/km (nieco szybciej niż zwykle).`,
    );
  }

  const summary = show
    ? `+${extraMinutes} min cardio na otwartą nadwyżkę makro (~${effectiveSurplusKcal} kcal).`
    : "Brak rekomendacji dodatkowego cardio.";

  return {
    show,
    extraMinutes: show ? extraMinutes : 0,
    surplusKcal: show ? surplusKcal : 0,
    effectiveSurplusKcal: show ? effectiveSurplusKcal : 0,
    daysLeftInWeek: daysLeft,
    balanceChancePct,
    burnKcalPerMin,
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
