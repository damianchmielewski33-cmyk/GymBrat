import {
  clamp,
  daysBetween,
  inLastDays,
  mean,
  pctDelta,
  round0,
  round1,
} from "@/lib/analytics/math";
import type {
  AnalyticsStrengthSession,
  FatigueBand,
  FatigueComponent,
  FatigueSnapshot,
} from "@/lib/analytics/types";

export function fatigueBandOf(score: number): FatigueBand {
  if (score <= 30) return "fresh";
  if (score <= 60) return "normal";
  if (score <= 80) return "fatigued";
  return "overreached";
}

export function fatigueBandLabel(band: FatigueBand): string {
  switch (band) {
    case "fresh":
      return "Świeżość";
    case "normal":
      return "Normalne obciążenie";
    case "fatigued":
      return "Wysokie zmęczenie";
    case "overreached":
      return "Przeciążenie";
  }
}

function recommendationFor(band: FatigueBand, score: number): string {
  switch (band) {
    case "fresh":
      return "Możesz iść w ciężki trening lub PR — regeneracja wygląda dobrze.";
    case "normal":
      return "Trzymaj plan; unikaj dokładania objętości bez powodu.";
    case "fatigued":
      return score >= 70
        ? "Obniż objętość o ~20% albo dodaj dzień odciążenia w tym tygodniu."
        : "Skróć sesję lub obniż RPE o 1 — zmęczenie rośnie.";
    case "overreached":
      return "Priorytet: sen, mniej ciężkich serii, cardio tylko Z1–Z2. Rozważ 3–5 dni lżejszego treningu.";
  }
}

/**
 * Ile tygodni historii (0–3) tworzy bazę „normy” przed bieżącym tygodniem.
 * Dzielenie tonażu bazy zawsze przez 3 zawyżało stosunek u osób z krótszą historią.
 */
function baselineWeeksOf(
  baseline: AnalyticsStrengthSession[],
  endDate: string,
): number {
  if (baseline.length === 0) return 0;
  const earliest = baseline.reduce(
    (min, s) => (s.date < min ? s.date : min),
    baseline[0].date,
  );
  // Koniec bazy = dzień przed bieżącym tygodniem (end − 7).
  const spanDays = daysBetween(earliest, addDaysIso(endDate, -7)) + 1;
  return clamp(Math.ceil(spanDays / 7), 1, 3);
}

function scoreAtEnd(
  sessions: AnalyticsStrengthSession[],
  cardioLoadWeek: number,
  endDate: string,
  consecutiveTrainingDays: number,
): {
  score: number;
  inputs: FatigueSnapshot["inputs"];
  components: FatigueComponent[];
  missingInputs: FatigueSnapshot["missingInputs"];
  baselineWeeks: number;
} {
  // „7 dni” = dokładnie 7 dat (wcześniej okno obejmowało 8 dat i zliczało ten sam dzień tygodnia dwa razy).
  const weekSessions = sessions.filter((s) => inLastDays(s.date, endDate, 7));
  const last28 = sessions.filter((s) => inLastDays(s.date, endDate, 28));
  const weeklyTonnage = weekSessions.reduce((a, s) => a + s.tonnageKg, 0);
  // Baza przewlekła = tygodnie PRZED bieżącym (dni 8–28), bieżący nie zaniża stosunku.
  const weekSet = new Set(weekSessions);
  const baseline = last28.filter((s) => !weekSet.has(s));
  const baselineWeeks = baselineWeeksOf(baseline, endDate);
  const avgWeeklyBaseline =
    baselineWeeks > 0
      ? baseline.reduce((a, s) => a + s.tonnageKg, 0) / baselineWeeks
      : weeklyTonnage;

  const tonnageRatio =
    avgWeeklyBaseline > 0
      ? weeklyTonnage / avgWeeklyBaseline
      : weekSessions.length > 0
        ? 1
        : 0;
  const tonnageComponent = clamp((tonnageRatio - 0.5) * 50, 0, 35);

  const weekDates = [...new Set(weekSessions.map((s) => s.date))].sort();
  const firstHalf = weekDates.slice(0, Math.ceil(weekDates.length / 2));
  const secondHalf = weekDates.slice(Math.ceil(weekDates.length / 2));
  const tonFirst = weekSessions
    .filter((s) => firstHalf.includes(s.date))
    .reduce((a, s) => a + s.tonnageKg, 0);
  const tonSecond = weekSessions
    .filter((s) => secondHalf.includes(s.date))
    .reduce((a, s) => a + s.tonnageKg, 0);
  const tonnageTrendPct = pctDelta(tonFirst, tonSecond);
  const trendComponent =
    tonnageTrendPct == null || weekDates.length < 3
      ? 0
      : clamp(tonnageTrendPct * 0.4, -8, 15);

  const hardSetPct = mean(
    weekSessions
      .map((s) => s.hardSetPct)
      .filter((x): x is number => x != null),
  );
  const hardComponent =
    hardSetPct != null ? clamp((hardSetPct - 20) * 0.35, 0, 20) : 0;

  const avgRpe = mean(
    weekSessions.map((s) => s.avgRpe).filter((x): x is number => x != null),
  );
  const rpeComponent = avgRpe != null ? clamp((avgRpe - 6) * 6, 0, 18) : 0;

  const sessionsThisWeek = weekSessions.length;
  const sessionComponent = clamp((sessionsThisWeek - 4) * 4, 0, 12);

  const cardioComponent = clamp(cardioLoadWeek / 40, 0, 15);

  const restComponent =
    consecutiveTrainingDays >= 5
      ? 18
      : consecutiveTrainingDays >= 4
        ? 12
        : consecutiveTrainingDays >= 3
          ? 6
          : 0;

  const components: FatigueComponent[] = [
    { key: "tonnage", points: round1(tonnageComponent), max: 35 },
    { key: "trend", points: round1(trendComponent), max: 15 },
    { key: "hardSets", points: round1(hardComponent), max: 20 },
    { key: "rpe", points: round1(rpeComponent), max: 18 },
    { key: "sessions", points: round1(sessionComponent), max: 12 },
    { key: "cardio", points: round1(cardioComponent), max: 15 },
    { key: "streak", points: restComponent, max: 18 },
  ];

  const raw =
    tonnageComponent +
    trendComponent +
    hardComponent +
    rpeComponent +
    sessionComponent +
    cardioComponent +
    restComponent;

  const missingInputs: FatigueSnapshot["missingInputs"] = [];
  if (weekSessions.length > 0) {
    if (avgRpe == null) missingInputs.push("rpe");
    if (hardSetPct == null) missingInputs.push("hardSets");
  }

  return {
    score: clamp(round0(raw), 0, 100),
    inputs: {
      weeklyTonnageKg: round1(weeklyTonnage),
      tonnageTrendPct,
      hardSetPct: hardSetPct != null ? round1(hardSetPct) : null,
      avgRpe: avgRpe != null ? round1(avgRpe) : null,
      sessionsThisWeek,
      cardioLoad: round1(cardioLoadWeek),
      consecutiveTrainingDays,
    },
    components,
    missingInputs,
    baselineWeeks,
  };
}

export function computeFatigueScore(args: {
  sessions: AnalyticsStrengthSession[];
  /** Cardio load bieżącego tygodnia (i dla delty — poprzednie). */
  cardioLoadByEndDate: (endDate: string) => number;
  consecutiveTrainingDays: number;
  today: string;
}): FatigueSnapshot {
  const { sessions, today } = args;
  const now = scoreAtEnd(
    sessions,
    args.cardioLoadByEndDate(today),
    today,
    args.consecutiveTrainingDays,
  );
  const d7 = addDaysIso(today, -7);
  const d30 = addDaysIso(today, -30);
  const prev7 = scoreAtEnd(
    sessions,
    args.cardioLoadByEndDate(d7),
    d7,
    consecutiveDaysEndingAt(sessions, d7),
  );
  const prev30 = scoreAtEnd(
    sessions,
    args.cardioLoadByEndDate(d30),
    d30,
    consecutiveDaysEndingAt(sessions, d30),
  );
  const band = fatigueBandOf(now.score);
  return {
    score: now.score,
    band,
    bandLabel: fatigueBandLabel(band),
    delta7d: now.score - prev7.score,
    delta30d: now.score - prev30.score,
    recommendation: recommendationFor(band, now.score),
    components: now.components,
    missingInputs: now.missingInputs,
    baselineWeeks: now.baselineWeeks,
    inputs: now.inputs,
  };
}

/** Liczba kolejnych dni z treningiem kończących się w `endDate` (włącznie). */
function consecutiveDaysEndingAt(
  sessions: AnalyticsStrengthSession[],
  endDate: string,
): number {
  const dates = new Set(sessions.map((s) => s.date));
  let n = 0;
  for (let d = endDate; dates.has(d); d = addDaysIso(d, -1)) n += 1;
  return n;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
