import { inWindow } from "@/lib/analytics/math";
import { daysBetweenDateKeys } from "@/lib/local-date";
import type {
  AnalyticsCardioSample,
  CardioPerformanceVerdict,
} from "@/lib/analytics/types";

function similarDuration(a: number, b: number): boolean {
  if (a <= 0 || b <= 0) return false;
  const ratio = Math.min(a, b) / Math.max(a, b);
  return ratio >= 0.85;
}

/**
 * Porównuje HR przy podobnym czasie tej samej aktywności
 * (próbka sprzed ~30 dni vs najnowsza).
 */
export function computeCardioPerformance(args: {
  samples: AnalyticsCardioSample[];
  today: string;
}): {
  verdict: CardioPerformanceVerdict;
  verdictLabel: string;
  activityLabel: string | null;
  hrThen: number | null;
  hrNow: number | null;
  minutesCompared: number | null;
} {
  const withHr = args.samples
    .filter(
      (s) =>
        s.avgHr != null &&
        s.avgHr > 0 &&
        s.minutes >= 10 &&
        inWindow(s.date, args.today, 90),
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  if (withHr.length < 2) {
    return {
      verdict: "insufficient_data",
      verdictLabel: "Za mało danych HR do porównania wydolności",
      activityLabel: null,
      hrThen: null,
      hrNow: null,
      minutesCompared: null,
    };
  }

  const newest = withHr[withHr.length - 1]!;
  const typeKey = newest.cardioType ?? newest.title ?? "other";

  const candidates = withHr.filter((s) => {
    if (s.id === newest.id) return false;
    const sameType =
      (s.cardioType ?? s.title ?? "other") === typeKey ||
      (newest.title && s.title === newest.title);
    if (!sameType) return false;
    if (!similarDuration(s.minutes, newest.minutes)) return false;
    const gap = daysBetweenDateKeys(s.date, newest.date);
    return gap >= 14 && gap <= 60;
  });

  const then = candidates[candidates.length - 1];
  if (!then || then.avgHr == null || newest.avgHr == null) {
    return {
      verdict: "insufficient_data",
      verdictLabel: "Brak porównywalnej sesji sprzed 2–8 tygodni",
      activityLabel: newest.title,
      hrThen: null,
      hrNow: newest.avgHr,
      minutesCompared: newest.minutes,
    };
  }

  const delta = newest.avgHr - then.avgHr;
  let verdict: CardioPerformanceVerdict;
  let verdictLabel: string;
  if (delta <= -4) {
    verdict = "improved";
    verdictLabel = "Kondycja poprawiła się";
  } else if (delta >= 4) {
    verdict = "declined";
    verdictLabel = "Kondycja pogorszyła się";
  } else {
    verdict = "stable";
    verdictLabel = "Kondycja bez wyraźnej zmiany";
  }

  return {
    verdict,
    verdictLabel,
    activityLabel: newest.title ?? newest.cardioType,
    hrThen: then.avgHr,
    hrNow: newest.avgHr,
    minutesCompared: Math.round((then.minutes + newest.minutes) / 2),
  };
}
