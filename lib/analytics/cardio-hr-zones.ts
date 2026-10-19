import {
  estimateHrMax,
  heartRateZoneFromHr,
  type HeartRateZone,
} from "@/lib/cardio-utils";
import { clamp, inWindow, round0, round1 } from "@/lib/analytics/math";
import type {
  AnalyticsCardioSample,
  CardioZoneMinutes,
} from "@/lib/analytics/types";

export { estimateHrMax, heartRateZoneFromHr };

export function computeZoneMinutes(args: {
  samples: AnalyticsCardioSample[];
  ageYears: number | null;
  today: string;
  lookbackDays?: number;
}): { hrMax: number | null; zones: CardioZoneMinutes[] } {
  const lookback = args.lookbackDays ?? 7;
  const hrMax = estimateHrMax(args.ageYears);
  const buckets: Record<HeartRateZone, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  for (const s of args.samples) {
    if (!inWindow(s.date, args.today, lookback)) continue;
    if (s.minutes <= 0) continue;
    const zone =
      (s.heartRateZone != null &&
      s.heartRateZone >= 1 &&
      s.heartRateZone <= 5
        ? (s.heartRateZone as HeartRateZone)
        : null) ??
      heartRateZoneFromHr(s.avgHr, hrMax ?? s.maxHr);
    if (!zone) {
      // Bez HR — zalicz do Z2 jako umiarkowane (nie zniekształca mocno).
      buckets[2] += s.minutes * 0.5;
      continue;
    }
    buckets[zone] += s.minutes;
  }

  const total = Object.values(buckets).reduce((a, b) => a + b, 0);
  const zones: CardioZoneMinutes[] = ([1, 2, 3, 4, 5] as const).map((z) => ({
    zone: z,
    minutes: round1(buckets[z]),
    sharePct:
      total > 0 ? round0(clamp((buckets[z] / total) * 100, 0, 100)) : 0,
  }));

  return { hrMax, zones };
}
