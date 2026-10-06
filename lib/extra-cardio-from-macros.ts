/**
 * Dodatkowe cardio przy nadwyżce makro / kcal.
 * Czysta logika (bez DB) — testowalna i używana na Pulpicie.
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
};

export type ExtraCardioInput = {
  today: MacroDaySnapshot;
  week: MacroDaySnapshot;
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
  /** Surowa nadwyżka dnia (kcal). */
  surplusKcal: number;
  /** Nadwyżka po uwzględnieniu szansy wyrównania w tygodniu. */
  effectiveSurplusKcal: number;
  /** Dni od dziś do niedzieli włącznie. */
  daysLeftInWeek: number;
  /** 0–100: szansa, że bilans tygodnia złapie się dietą w pozostałe dni. */
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
 * Tempo (min/km) → przybliżony MET → kcal/min.
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

  let met = 5.5; // umiarkowane cardio
  if (recentPaceMinPerKm != null && recentPaceMinPerKm > 0) {
    const kmh = 60 / recentPaceMinPerKm;
    // Grube mapowanie tempa → MET (spacer ~3–4, trucht ~7–9, bieg ~10+).
    met = Math.min(12, Math.max(2.8, 1.15 * kmh));
  }

  return {
    burnKcalPerMin: round1(Math.min(18, Math.max(3, (met * w) / 60))),
    recentPaceMinPerKm,
  };
}

/**
 * Ile z dzisiejszej nadwyżki da się „rozłożyć” na resztę tygodnia dietą,
 * a ile trzeba spalić cardio teraz.
 */
export function computeExtraCardioAdvice(
  input: ExtraCardioInput,
): ExtraCardioAdvice {
  const { surplusKcal, exceeded } = macroSurplusKcal(input.today);
  const daysLeft = daysLeftInWeekIncludingToday(input.todayKey, input.weekKeys);
  const daysAfterToday = Math.max(0, daysLeft - 1);

  const weekCalGoal = input.week.caloriesGoal;
  const weekSurplus =
    weekCalGoal != null && weekCalGoal > 0
      ? Math.round(input.week.caloriesConsumed - weekCalGoal)
      : 0;

  const dailyGoal =
    input.today.caloriesGoal != null && input.today.caloriesGoal > 0
      ? input.today.caloriesGoal
      : weekCalGoal != null && weekCalGoal > 0
        ? weekCalGoal / 7
        : 2000;

  // Zakładamy, że w kolejne dni da się zejść o ~12% poniżej celu.
  const slackPerFutureDay = dailyGoal * 0.12;
  const weekDeficitRoom = Math.max(0, -weekSurplus);
  const absorbCapacity = weekDeficitRoom + daysAfterToday * slackPerFutureDay;

  const rawBalance =
    surplusKcal > 0 ? Math.min(1, absorbCapacity / surplusKcal) : 1;
  // Pod koniec tygodnia szansa spada (niedziela ≈ 0 dni po dziś).
  const timeFactor = daysAfterToday / 6;
  const balanceChance = Math.min(1, Math.max(0, rawBalance * (0.35 + 0.65 * timeFactor)));
  const balanceChancePct = Math.round(balanceChance * 100);

  // Im mniejsza szansa wyrównania, tym więcej trzeba spalić teraz.
  const deferShare = balanceChance * 0.75;
  let effectiveSurplusKcal = Math.round(
    Math.max(0, surplusKcal * (1 - deferShare)),
  );

  // Przy dużym przekroczeniu makro (≥15% celu) nie odkładamy wszystkiego.
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

  const { burnKcalPerMin, recentPaceMinPerKm } = estimateBurnKcalPerMin({
    weightKg: input.weightKg,
    recentCardio: input.recentCardio,
  });

  let extraMinutes =
    effectiveSurplusKcal > 0
      ? Math.ceil(effectiveSurplusKcal / burnKcalPerMin)
      : 0;
  extraMinutes = Math.min(90, Math.max(0, extraMinutes));
  if (extraMinutes > 0 && extraMinutes < 5) extraMinutes = 5;

  let suggestedPaceMinPerKm: number | null = null;
  if (recentPaceMinPerKm != null && recentPaceMinPerKm > 0 && extraMinutes >= 15) {
    // Trochę szybsze tempo, by spalić nadwyżkę w rozsądnym czasie.
    suggestedPaceMinPerKm = round1(Math.max(4.5, recentPaceMinPerKm * 0.92));
  } else if (recentPaceMinPerKm != null) {
    suggestedPaceMinPerKm = recentPaceMinPerKm;
  }

  const show = exceeded.length > 0 && extraMinutes > 0 && surplusKcal > 0;

  const macroLabels: Record<ExceededMacro, string> = {
    protein: "białko",
    carbs: "węglowodany",
    fat: "tłuszcze",
    calories: "kalorii",
  };
  const exceededLabel = exceeded
    .filter((m) => m !== "calories")
    .map((m) => macroLabels[m])
    .join(", ");

  const explanation: string[] = [
    `Nadwyżka dziś: ok. ${surplusKcal} kcal` +
      (exceededLabel ? ` (przekroczone: ${exceededLabel})` : "") +
      ".",
    `Do końca tygodnia zostało ${daysLeft} ${daysLeft === 1 ? "dzień" : daysLeft < 5 ? "dni" : "dni"} (w tym dziś) — szansa wyrównania bilansu dietą: ${balanceChancePct}%.`,
    `Po uwzględnieniu tygodnia do „dopalenia” zostaje ok. ${effectiveSurplusKcal} kcal.`,
    `Przy Twoim tempie cardio (~${burnKcalPerMin} kcal/min` +
      (recentPaceMinPerKm != null
        ? `, średnie tempo ${formatPaceShort(recentPaceMinPerKm)}/km`
        : "") +
      `) to ok. ${extraMinutes} min dodatkowego cardio.`,
  ];
  if (
    suggestedPaceMinPerKm != null &&
    recentPaceMinPerKm != null &&
    suggestedPaceMinPerKm < recentPaceMinPerKm - 0.05
  ) {
    explanation.push(
      `Sugerowane tempo: ${formatPaceShort(suggestedPaceMinPerKm)}/km (nieco szybciej niż zwykle ${formatPaceShort(recentPaceMinPerKm)}/km).`,
    );
  }

  const summary = show
    ? `+${extraMinutes} min cardio, by zbilansować nadwyżkę makro (~${effectiveSurplusKcal} kcal).`
    : "Brak rekomendacji dodatkowego cardio.";

  return {
    show,
    extraMinutes: show ? extraMinutes : 0,
    surplusKcal,
    effectiveSurplusKcal: show ? effectiveSurplusKcal : 0,
    daysLeftInWeek: daysLeft,
    balanceChancePct,
    burnKcalPerMin,
    recentPaceMinPerKm,
    suggestedPaceMinPerKm: show ? suggestedPaceMinPerKm : null,
    exceededMacros: exceeded,
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
