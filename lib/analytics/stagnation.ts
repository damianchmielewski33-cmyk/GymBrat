import { daysBetween, inWindow, pctDelta, round0 } from "@/lib/analytics/math";
import type {
  ExerciseSessionPoint,
  StagnationItem,
  StagnationStatus,
} from "@/lib/analytics/types";

export function stagnationStatusLabel(s: StagnationStatus): string {
  switch (s) {
    case "progressing":
      return "Progres";
    case "stable":
      return "Stabilnie";
    case "stagnating":
      return "Stagnacja";
    case "regressing":
      return "Regres";
  }
}

function windowDelta(
  points: ExerciseSessionPoint[],
  today: string,
  days: number,
  pick: (p: ExerciseSessionPoint) => number,
): number | null {
  const inWin = points.filter((p) => inWindow(p.date, today, days));
  if (inWin.length < 2) return null;
  const mid = Math.floor(inWin.length / 2);
  const first = inWin.slice(0, mid);
  const second = inWin.slice(mid);
  const a =
    first.reduce((s, p) => s + pick(p), 0) / Math.max(1, first.length);
  const b =
    second.reduce((s, p) => s + pick(p), 0) / Math.max(1, second.length);
  return pctDelta(a, b);
}

function daysSinceBest(
  points: ExerciseSessionPoint[],
  today: string,
  pick: (p: ExerciseSessionPoint) => number,
): number {
  if (!points.length) return 0;
  let best = -Infinity;
  let bestDate = points[0]!.date;
  for (const p of points) {
    const v = pick(p);
    if (v > best) {
      best = v;
      bestDate = p.date;
    }
  }
  return Math.max(0, daysBetween(bestDate, today));
}

export function classifyExerciseStagnation(args: {
  exerciseKey: string;
  name: string;
  points: ExerciseSessionPoint[];
  today: string;
}): StagnationItem | null {
  const pts = [...args.points].sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 2) return null;

  const e14 = windowDelta(pts, args.today, 14, (p) => p.bestE1rm);
  const e30 = windowDelta(pts, args.today, 30, (p) => p.bestE1rm);
  const v30 = windowDelta(pts, args.today, 30, (p) => p.volumeKg);
  const e60 = windowDelta(pts, args.today, 60, (p) => p.bestE1rm);

  const daysNoProgress = Math.min(
    daysSinceBest(pts, args.today, (p) => p.bestE1rm),
    daysSinceBest(pts, args.today, (p) => p.volumeKg),
  );

  let status: StagnationStatus = "stable";
  if (
    (e30 != null && e30 <= -3) ||
    (v30 != null && v30 <= -5) ||
    (e60 != null && e60 <= -5)
  ) {
    status = "regressing";
  } else if (
    (e30 != null && e30 >= 3) ||
    (v30 != null && v30 >= 5) ||
    (e14 != null && e14 >= 3)
  ) {
    status = "progressing";
  } else if (daysNoProgress >= 21 || (e30 != null && Math.abs(e30) < 3 && daysNoProgress >= 14)) {
    status = "stagnating";
  }

  return {
    exerciseKey: args.exerciseKey,
    name: args.name,
    status,
    statusLabel: stagnationStatusLabel(status),
    daysWithoutProgress: round0(daysNoProgress),
    e1rmDeltaPct30: e30,
    volumeDeltaPct30: v30,
  };
}

export function computeStagnationList(args: {
  exercises: Array<{
    exerciseKey: string;
    name: string;
    points: ExerciseSessionPoint[];
  }>;
  today: string;
  limit?: number;
}): StagnationItem[] {
  const items: StagnationItem[] = [];
  for (const ex of args.exercises) {
    const item = classifyExerciseStagnation({
      exerciseKey: ex.exerciseKey,
      name: ex.name,
      points: ex.points,
      today: args.today,
    });
    if (item) items.push(item);
  }
  const rank = (s: StagnationStatus) =>
    s === "regressing" ? 0 : s === "stagnating" ? 1 : s === "stable" ? 2 : 3;
  items.sort(
    (a, b) =>
      rank(a.status) - rank(b.status) ||
      b.daysWithoutProgress - a.daysWithoutProgress,
  );
  return items.slice(0, args.limit ?? 12);
}
