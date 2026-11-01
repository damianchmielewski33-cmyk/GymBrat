import { linearRegression } from "@/lib/analytics/math";
import { daysBetweenDateKeys } from "@/lib/local-date";

export type GoalType = "cut" | "bulk" | "recomp" | "strength";

export const GOAL_TYPE_LABEL: Record<GoalType, string> = {
  cut: "Redukcja",
  bulk: "Masa",
  recomp: "Rekompozycja",
  strength: "Siła",
};

export type GoalStatus =
  | "reached"
  | "on_track"
  | "behind"
  | "wrong_direction"
  | "unknown";

export type GoalProjection = {
  status: GoalStatus;
  /** Zmiana na tydzień z regresji (jednostka celu: kg). */
  ratePerWeek: number | null;
  /** Zmiana na tydzień potrzebna do terminu (null bez terminu). */
  requiredPerWeek: number | null;
  /** Przewidywana data osiągnięcia (YYYY-MM-DD) albo null. */
  etaDate: string | null;
};

const MIN_POINTS = 3;
const MAX_ETA_DAYS = 365 * 3;

function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + Math.round(days));
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Prognoza dojścia do wartości docelowej z trendu liniowego (ostatnie punkty).
 * `points`: rosnąco po dacie; wartość w kg (waga ciała albo e1RM ćwiczenia).
 */
export function projectToTarget(args: {
  points: Array<{ date: string; value: number }>;
  target: number;
  deadline?: string | null;
  today: string;
}): GoalProjection {
  const pts = [...args.points]
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date));
  const empty: GoalProjection = {
    status: "unknown",
    ratePerWeek: null,
    requiredPerWeek: null,
    etaDate: null,
  };
  if (pts.length === 0) return empty;

  const current = pts[pts.length - 1]!.value;
  const first = pts[0]!.value;
  const needed = args.target - current;
  // Cel osiągnięty: w kierunku zmiany od punktu startowego.
  const direction = Math.sign(args.target - first) || Math.sign(needed);
  if (direction !== 0 && Math.sign(needed) !== direction) {
    return { ...empty, status: "reached" };
  }
  if (needed === 0) return { ...empty, status: "reached" };
  if (pts.length < MIN_POINTS) return empty;

  const t0 = pts[0]!.date;
  const reg = linearRegression(
    pts.map((p) => ({ x: daysBetweenDateKeys(t0, p.date), y: p.value })),
  );
  if (!reg) return empty;
  const ratePerDay = reg.b;
  const ratePerWeek = Math.round(ratePerDay * 7 * 100) / 100;

  let requiredPerWeek: number | null = null;
  if (args.deadline) {
    const daysLeft = daysBetweenDateKeys(args.today, args.deadline);
    if (daysLeft > 0) {
      requiredPerWeek = Math.round((needed / daysLeft) * 7 * 100) / 100;
    }
  }

  if (Math.sign(ratePerDay) !== Math.sign(needed) || ratePerDay === 0) {
    return {
      status: "wrong_direction",
      ratePerWeek,
      requiredPerWeek,
      etaDate: null,
    };
  }

  const daysToGo = needed / ratePerDay;
  const etaDate =
    daysToGo <= MAX_ETA_DAYS ? addDays(args.today, daysToGo) : null;
  let status: GoalStatus = "on_track";
  if (args.deadline && etaDate && etaDate > args.deadline) status = "behind";
  if (args.deadline && !etaDate) status = "behind";
  return { status, ratePerWeek, requiredPerWeek, etaDate };
}

/** Docelowy e1RM z celu „ciężar × powtórzenia” (powtórzenia do 12, jak w estimated1RM). */
export function targetE1rm(targetKg: number, targetReps?: number | null): number {
  const r = Math.min(Math.max(1, Math.round(targetReps ?? 1)), 12);
  return targetKg * (1 + r / 30);
}

export function goalStatusLabel(p: GoalProjection): string {
  switch (p.status) {
    case "reached":
      return "cel osiągnięty";
    case "wrong_direction":
      return "trend w złą stronę";
    case "unknown":
      return "za mało danych do prognozy";
    case "behind":
      return p.etaDate ? `po terminie · ETA ${p.etaDate}` : "po terminie";
    case "on_track":
      return p.etaDate ? `ETA ${p.etaDate}` : "na dobrej drodze";
  }
}
