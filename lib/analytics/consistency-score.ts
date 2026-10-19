import { clamp, round0 } from "@/lib/analytics/math";
import type { ConsistencySnapshot, ConsistencyWindow } from "@/lib/analytics/types";

function windowScore(planned: number, done: number): ConsistencyWindow {
  const p = Math.max(0, planned);
  const d = Math.max(0, done);
  const scorePct =
    p <= 0 ? (d > 0 ? 100 : 0) : clamp(round0((d / p) * 100), 0, 150);
  return { planned: p, done: d, scorePct: Math.min(100, scorePct) };
}

/**
 * Consistency = wykonane sesje siłowe / (weeklyTarget × tygodnie w oknie).
 */
export function computeConsistencyScore(args: {
  weeklySessionsTarget: number;
  strengthDates: string[];
  today: string;
}): ConsistencySnapshot {
  const target = Math.max(1, Math.round(args.weeklySessionsTarget || 5));
  const unique = [...new Set(args.strengthDates)].sort();

  const countIn = (days: number) => {
    const end = new Date(`${args.today}T12:00:00`).getTime();
    const start = end - days * 24 * 60 * 60 * 1000;
    return unique.filter((d) => {
      const t = new Date(`${d}T12:00:00`).getTime();
      return Number.isFinite(t) && t >= start && t <= end;
    }).length;
  };

  const weekDone = countIn(7);
  const monthDone = countIn(30);
  const d90Done = countIn(90);

  return {
    week: windowScore(target, weekDone),
    month: windowScore(Math.round(target * (30 / 7)), monthDone),
    days90: windowScore(Math.round(target * (90 / 7)), d90Done),
  };
}
