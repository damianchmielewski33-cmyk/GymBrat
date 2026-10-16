/**
 * Personal record engine — PR zwiększa readiness, nie auto +kg.
 */

import { bestE1rmFromSets, setE1rm } from "@/lib/live-coach/e1rm-trend";
import type { PersonalRecordsReport } from "@/lib/live-coach/types";

export type PrBaseline = {
  weightKg: number;
  reps: number;
  volumeKg: number;
  e1rm: number;
};

export function volumeFromSets(
  sets: Array<{ weight: number; reps: number | null | undefined }>,
): number {
  let v = 0;
  for (const s of sets) {
    if (s.reps != null && s.reps > 0 && s.weight > 0) {
      v += s.weight * s.reps;
    }
  }
  return v;
}

export function detectPersonalRecords(args: {
  currentSets: Array<{ weight: number; reps: number | null | undefined }>;
  baseline: PrBaseline | null | undefined;
}): PersonalRecordsReport {
  const empty: PersonalRecordsReport = {
    isWeightPr: false,
    isRepPr: false,
    isVolumePr: false,
    isE1rmPr: false,
    anyPr: false,
  };
  const base = args.baseline;
  if (!base) return empty;

  let topW = 0;
  let bestRepsAtTop = 0;
  for (const s of args.currentSets) {
    if (s.weight > topW && s.reps != null && s.reps > 0) {
      topW = s.weight;
      bestRepsAtTop = s.reps;
    } else if (
      Math.abs(s.weight - topW) < 0.26 &&
      s.reps != null &&
      s.reps > bestRepsAtTop
    ) {
      bestRepsAtTop = s.reps;
    }
  }
  const vol = volumeFromSets(args.currentSets);
  const e1 = bestE1rmFromSets(args.currentSets);

  const isWeightPr = topW > 0 && topW > base.weightKg + 0.25;
  const isRepPr =
    topW > 0 &&
    Math.abs(topW - base.weightKg) <= 0.25 &&
    bestRepsAtTop > base.reps;
  const isVolumePr = vol > 0 && vol > base.volumeKg * 1.02;
  const isE1rmPr = e1 > 0 && e1 > base.e1rm + 1.5;

  return {
    isWeightPr,
    isRepPr,
    isVolumePr,
    isE1rmPr,
    anyPr: isWeightPr || isRepPr || isVolumePr || isE1rmPr,
  };
}

export function prReadinessBonus(prs: PersonalRecordsReport): number {
  if (!prs.anyPr) return 0;
  let b = 0;
  if (prs.isE1rmPr) b += 6;
  if (prs.isWeightPr) b += 4;
  if (prs.isRepPr) b += 3;
  if (prs.isVolumePr) b += 2;
  return Math.min(12, b);
}

export { setE1rm };
