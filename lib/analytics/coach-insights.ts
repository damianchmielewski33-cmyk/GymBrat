import { pctDelta, round0 } from "@/lib/analytics/math";
import type {
  AdherenceSnapshot,
  CardioAnalyticsSnapshot,
  CoachInsight,
  ConsistencySnapshot,
  FatigueSnapshot,
  MuscleBalanceSnapshot,
  RecoverySnapshot,
  StagnationItem,
} from "@/lib/analytics/types";

export function buildCoachInsights(args: {
  fatigue: FatigueSnapshot;
  recovery: RecoverySnapshot;
  muscle: MuscleBalanceSnapshot;
  stagnation: StagnationItem[];
  consistency: ConsistencySnapshot;
  adherence: AdherenceSnapshot;
  cardio: CardioAnalyticsSnapshot;
  weeklyTonnageNow: number;
  weeklyTonnagePrev: number;
  cardioMinutesNow: number;
  cardioMinutesPrev: number;
}): CoachInsight[] {
  const insights: CoachInsight[] = [];

  const tonDelta = pctDelta(args.weeklyTonnagePrev, args.weeklyTonnageNow);
  if (tonDelta != null && Math.abs(tonDelta) >= 8) {
    insights.push({
      id: "tonnage-trend",
      severity: tonDelta > 0 ? "good" : "warn",
      text:
        tonDelta > 0
          ? `Tonaż wzrósł o ${round0(tonDelta)}% względem poprzedniego tygodnia.`
          : `Tonaż spadł o ${round0(Math.abs(tonDelta))}% względem poprzedniego tygodnia.`,
    });
  }

  if (args.fatigue.score >= 78) {
    insights.push({
      id: "fatigue-high",
      severity: "warn",
      text: `Zmęczenie osiągnęło ${args.fatigue.score} — ${args.fatigue.bandLabel.toLowerCase()}.`,
    });
  } else if (args.fatigue.score <= 28) {
    insights.push({
      id: "fatigue-low",
      severity: "good",
      text: `Zmęczenie ${args.fatigue.score}/100 — dobre okno na cięższy trening.`,
    });
  }

  if (args.recovery.band === "excellent" || args.recovery.band === "good") {
    insights.push({
      id: "recovery-ok",
      severity: "info",
      text: `Regeneracja ${args.recovery.score}% — ${args.recovery.readinessLine}.`,
    });
  } else if (args.recovery.band === "poor") {
    insights.push({
      id: "recovery-poor",
      severity: "warn",
      text: `Regeneracja ${args.recovery.score}% — ${args.recovery.readinessLine}.`,
    });
  }

  const cardioDelta = pctDelta(
    args.cardioMinutesPrev,
    args.cardioMinutesNow,
  );
  if (cardioDelta != null && Math.abs(cardioDelta) >= 15) {
    insights.push({
      id: "cardio-trend",
      severity: cardioDelta < 0 ? "warn" : "info",
      text:
        cardioDelta < 0
          ? `Cardio spadło o ${round0(Math.abs(cardioDelta))}% względem poprzedniego tygodnia.`
          : `Cardio wzrosło o ${round0(cardioDelta)}% względem poprzedniego tygodnia.`,
    });
  }

  if (args.cardio.loadBand === "high") {
    insights.push({
      id: "cardio-load",
      severity: "warn",
      text: `Obciążenie cardio ${args.cardio.load} (${args.cardio.loadLabel}) — wliczone w zmęczenie.`,
    });
  }

  if (args.cardio.performance.verdict === "improved") {
    insights.push({
      id: "cardio-perf",
      severity: "good",
      text: args.cardio.performance.verdictLabel +
        (args.cardio.performance.hrThen != null &&
        args.cardio.performance.hrNow != null
          ? ` (HR ${args.cardio.performance.hrThen} → ${args.cardio.performance.hrNow}).`
          : "."),
    });
  }

  for (const alert of args.muscle.alerts.slice(0, 2)) {
    insights.push({
      id: `muscle-${alert.lowerId}`,
      severity: "warn",
      text: alert.message,
    });
  }

  const stagnating = args.stagnation.filter(
    (s) => s.status === "stagnating" || s.status === "regressing",
  );
  for (const s of stagnating.slice(0, 2)) {
    insights.push({
      id: `stagn-${s.exerciseKey}`,
      severity: s.status === "regressing" ? "warn" : "info",
      text: `${s.name}: ${s.statusLabel.toLowerCase()} od ${s.daysWithoutProgress} dni.`,
    });
  }

  if (args.consistency.week.scorePct < 70) {
    insights.push({
      id: "consistency-low",
      severity: "warn",
      text: `Regularność ${args.consistency.week.scorePct}% — wykonano ${args.consistency.week.done} z ${args.consistency.week.planned} zaplanowanych treningów.`,
    });
  } else if (args.consistency.week.scorePct >= 90) {
    insights.push({
      id: "consistency-high",
      severity: "good",
      text: `Regularność ${args.consistency.week.scorePct}% — solidna zgodność z planem.`,
    });
  }

  if (args.adherence.overallPct > 0) {
    const parts = [`trening ${args.adherence.trainingPct}%`];
    if (args.adherence.dietPct != null) {
      parts.push(`dieta ${args.adherence.dietPct}%`);
    }
    if (args.adherence.cardioPct != null) {
      parts.push(`cardio ${args.adherence.cardioPct}%`);
    }
    insights.push({
      id: "adherence",
      severity: args.adherence.overallPct >= 80 ? "good" : "info",
      text: `Realizacja planu ${args.adherence.overallPct}% (${parts.join(" · ")}).`,
    });
  }

  // Dedup by id, max 7
  const seen = new Set<string>();
  const out: CoachInsight[] = [];
  for (const i of insights) {
    if (seen.has(i.id)) continue;
    seen.add(i.id);
    out.push(i);
    if (out.length >= 7) break;
  }
  return out;
}
