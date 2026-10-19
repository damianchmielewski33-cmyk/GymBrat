import { clamp, inWindow, mean, pctDelta, round0, round1 } from "@/lib/analytics/math";
import type {
  AnalyticsStrengthSession,
  FatigueBand,
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
        ? "Obniż objętość o ~20% albo dodaj dzień deloadu w tym tygodniu."
        : "Skróć sesję lub obniż RPE o 1 — zmęczenie rośnie.";
    case "overreached":
      return "Priorytet: sen, mniej hard sets, cardio tylko Z1–Z2. Rozważ deload 3–5 dni.";
  }
}

function scoreAtEnd(
  sessions: AnalyticsStrengthSession[],
  cardioLoadWeek: number,
  endDate: string,
  consecutiveTrainingDays: number,
): { score: number; inputs: FatigueSnapshot["inputs"] } {
  const weekSessions = sessions.filter((s) => inWindow(s.date, endDate, 7));
  const prev4w = sessions.filter((s) => inWindow(s.date, endDate, 28));
  const weeklyTonnage = weekSessions.reduce((a, s) => a + s.tonnageKg, 0);
  const weeksInPrev = 4;
  const avgWeekly4 =
    prev4w.reduce((a, s) => a + s.tonnageKg, 0) / Math.max(1, weeksInPrev);

  const tonnageRatio =
    avgWeekly4 > 0 ? weeklyTonnage / avgWeekly4 : weekSessions.length > 0 ? 1 : 0;
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
    tonnageTrendPct == null
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
  const rpeComponent =
    avgRpe != null ? clamp((avgRpe - 6) * 6, 0, 18) : 0;

  const sessionsThisWeek = weekSessions.length;
  const sessionComponent = clamp((sessionsThisWeek - 3) * 4, 0, 12);

  const cardioComponent = clamp(cardioLoadWeek / 40, 0, 15);

  const restComponent =
    consecutiveTrainingDays >= 5
      ? 18
      : consecutiveTrainingDays >= 4
        ? 12
        : consecutiveTrainingDays >= 3
          ? 6
          : 0;

  const raw =
    tonnageComponent +
    trendComponent +
    hardComponent +
    rpeComponent +
    sessionComponent +
    cardioComponent +
    restComponent;

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
    Math.max(0, args.consecutiveTrainingDays - 1),
  );
  const prev30 = scoreAtEnd(
    sessions,
    args.cardioLoadByEndDate(d30),
    d30,
    0,
  );
  const band = fatigueBandOf(now.score);
  return {
    score: now.score,
    band,
    bandLabel: fatigueBandLabel(band),
    delta7d: now.score - prev7.score,
    delta30d: now.score - prev30.score,
    recommendation: recommendationFor(band, now.score),
    inputs: now.inputs,
  };
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
