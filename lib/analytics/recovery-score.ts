import { clamp, round0 } from "@/lib/analytics/math";
import type {
  RecoveryBand,
  RecoverySnapshot,
  SubjectiveRecoveryInput,
} from "@/lib/analytics/types";

export function recoveryBandOf(score: number): RecoveryBand {
  if (score < 40) return "poor";
  if (score < 60) return "average";
  if (score < 80) return "good";
  return "excellent";
}

export function recoveryBandLabel(band: RecoveryBand): string {
  switch (band) {
    case "poor":
      return "Słaba regeneracja";
    case "average":
      return "Przeciętna regeneracja";
    case "good":
      return "Dobra regeneracja";
    case "excellent":
      return "Świetna regeneracja";
  }
}

function readinessLine(band: RecoveryBand, score: number): string {
  switch (band) {
    case "excellent":
      return "Gotowy na ciężki trening";
    case "good":
      return score >= 75
        ? "Gotowy na ciężki trening"
        : "Możesz trenować zgodnie z planem";
    case "average":
      return "Trenuj technicznie — bez forsowania PR";
    case "poor":
      return "Priorytet: regeneracja, nie ciężkie serie";
  }
}

/**
 * Recovery 0–100.
 * Gdy są dane subiektywne (sen/energia/stres) — ważona średnia.
 * Inaczej: 100 − fatigue.
 */
export function computeRecoveryScore(args: {
  fatigueScore: number;
  subjective: SubjectiveRecoveryInput | null;
  cardioLoadWeek: number;
}): RecoverySnapshot {
  const sub = args.subjective;
  const hasSubjective =
    sub != null &&
    (sub.sleepQuality != null ||
      sub.dayEnergy != null ||
      sub.stress != null);

  if (!hasSubjective || !sub) {
    const score = clamp(round0(100 - args.fatigueScore), 0, 100);
    const band = recoveryBandOf(score);
    return {
      score,
      band,
      bandLabel: recoveryBandLabel(band),
      readinessLine: readinessLine(band, score),
      source: "inverse_fatigue",
    };
  }

  const sleep = sub.sleepQuality != null ? (sub.sleepQuality / 10) * 100 : null;
  const energy = sub.dayEnergy != null ? (sub.dayEnergy / 10) * 100 : null;
  const stressInv =
    sub.stress != null ? 100 - (sub.stress / 10) * 100 : null;

  const parts: Array<{ w: number; v: number }> = [];
  if (sleep != null) parts.push({ w: 0.4, v: sleep });
  if (energy != null) parts.push({ w: 0.35, v: energy });
  if (stressInv != null) parts.push({ w: 0.25, v: stressInv });

  const wSum = parts.reduce((a, p) => a + p.w, 0);
  let subjectiveScore =
    wSum > 0
      ? parts.reduce((a, p) => a + p.v * p.w, 0) / wSum
      : 100 - args.fatigueScore;

  // Lekka kara za wysoki cardio load i szybki spadek wagi (możliwy deficyt).
  if (args.cardioLoadWeek > 400) subjectiveScore -= 8;
  else if (args.cardioLoadWeek > 250) subjectiveScore -= 4;
  if (sub.weightDeltaKg7d != null && sub.weightDeltaKg7d <= -1.2) {
    subjectiveScore -= 6;
  }

  // Blend z odwrotnością fatigue (30%), żeby nie ignorować obciążenia.
  const blended =
    subjectiveScore * 0.7 + (100 - args.fatigueScore) * 0.3;
  const score = clamp(round0(blended), 0, 100);
  const band = recoveryBandOf(score);
  return {
    score,
    band,
    bandLabel: recoveryBandLabel(band),
    readinessLine: readinessLine(band, score),
    source: "subjective",
  };
}
