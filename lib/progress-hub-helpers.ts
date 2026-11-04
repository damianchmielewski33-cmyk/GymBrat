import { safeNormalizeExercises } from "@/lib/workout-history";
import { addCalendarDays, calendarWeekdaySun0 } from "@/lib/local-date";
import { hasExternalWeight, hasPerformedReps } from "@/lib/workout-skipped-sets";
import type { VolumeTrendKind } from "@/lib/progress-hub-types";

export function clampNonNegative(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

export function safeRound1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function mondayOfWeek(dateKey: string): string {
  const dow = calendarWeekdaySun0(dateKey);
  const offset = dow === 0 ? -6 : 1 - dow;
  return addCalendarDays(dateKey, offset);
}

export function volumeFromExercises(exercises: ReturnType<typeof safeNormalizeExercises>): number {
  let volume = 0;
  for (const e of exercises) {
    for (const s of e.sets ?? []) {
      const reps =
        typeof s.reps === "number" && Number.isFinite(s.reps) ? Math.round(s.reps) : null;
      const weight =
        typeof s.weight === "number" && Number.isFinite(s.weight)
          ? s.weight
          : Number(s.weight ?? 0);
      const w = clampNonNegative(weight);
      if (!Boolean(s.done) || Boolean(s.skipped) || Boolean((s as { warmup?: boolean }).warmup) || !hasPerformedReps(reps) || !hasExternalWeight(w))
        continue;
      volume += reps! * w;
    }
  }
  return safeRound1(volume);
}

export function totalRepsFromExercises(
  exercises: ReturnType<typeof safeNormalizeExercises>,
): number {
  let total = 0;
  for (const e of exercises) {
    for (const s of e.sets ?? []) {
      const reps =
        typeof s.reps === "number" && Number.isFinite(s.reps) ? Math.round(s.reps) : null;
      if (!Boolean(s.done) || Boolean(s.skipped) || Boolean((s as { warmup?: boolean }).warmup) || !hasPerformedReps(reps)) continue;
      total += reps!;
    }
  }
  return total;
}

export function trendOf(prev: number, next: number): VolumeTrendKind {
  if (prev <= 0) return "flat";
  const pct = ((next - prev) / prev) * 100;
  if (pct >= 3) return "up";
  if (pct <= -3) return "down";
  return "flat";
}

export function weekShortLabel(monday: string): string {
  const sun = addCalendarDays(monday, 6);
  const a = new Date(`${monday}T12:00:00`);
  const b = new Date(`${sun}T12:00:00`);
  const fmt = (d: Date) =>
    d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  return `${fmt(a)}–${fmt(b)}`;
}

export const DAY_LABELS = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"] as const;
