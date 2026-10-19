import { estimateHrMax, heartRateZoneFromHr } from "@/lib/cardio-utils";
import { clamp, inWindow, round0, round1 } from "@/lib/analytics/math";
import type {
  AnalyticsCardioSample,
  CardioLoadBand,
} from "@/lib/analytics/types";

export function cardioLoadBandOf(load: number): CardioLoadBand {
  if (load < 120) return "low";
  if (load < 280) return "medium";
  return "high";
}

export function cardioLoadLabel(band: CardioLoadBand): string {
  switch (band) {
    case "low":
      return "Niskie";
    case "medium":
      return "Średnie";
    case "high":
      return "Wysokie";
  }
}

/**
 * Load = Σ minutes × intensityFactor
 * intensityFactor z %HRmax / strefy / effortScore (1–10).
 */
export function sampleCardioLoad(
  sample: AnalyticsCardioSample,
  ageYears: number | null,
): number {
  if (sample.minutes <= 0) return 0;
  const hrMax = estimateHrMax(ageYears);
  const zone =
    (sample.heartRateZone != null &&
    sample.heartRateZone >= 1 &&
    sample.heartRateZone <= 5
      ? sample.heartRateZone
      : null) ?? heartRateZoneFromHr(sample.avgHr, hrMax ?? sample.maxHr);

  let intensity = 1;
  if (zone != null) {
    intensity = 0.55 + zone * 0.35; // Z1≈0.9 … Z5≈2.3
  } else if (sample.effortScore != null) {
    intensity = 0.5 + sample.effortScore * 0.15;
  } else if (sample.avgHr != null && hrMax != null && hrMax > 0) {
    intensity = clamp(sample.avgHr / hrMax, 0.45, 1.05) * 2;
  }

  return sample.minutes * intensity;
}

export function computeCardioLoad(args: {
  samples: AnalyticsCardioSample[];
  ageYears: number | null;
  today: string;
  lookbackDays?: number;
}): { load: number; band: CardioLoadBand; label: string } {
  const lookback = args.lookbackDays ?? 7;
  let load = 0;
  for (const s of args.samples) {
    if (!inWindow(s.date, args.today, lookback)) continue;
    load += sampleCardioLoad(s, args.ageYears);
  }
  const rounded = round0(load);
  const band = cardioLoadBandOf(rounded);
  return { load: round1(load), band, label: cardioLoadLabel(band) };
}
