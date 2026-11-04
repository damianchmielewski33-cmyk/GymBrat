import { findBestCatalogMatch } from "@/lib/workout-exercise-catalog";
import type { WorkoutPlanPayload } from "@/lib/workout-plan-types";
import {
  EXERCISE_NAME_MAX,
  EXERCISE_NAME_MIN,
  MAX_EXERCISES_PER_PLAN,
  PLAN_NAME_MAX,
  REPS_MAX,
  SETS_MAX,
} from "@/lib/workout-plan/plan-validation";

/** Z58: plan startowy z historii — okno, limit dni i kategoria zapasowa. */
export const PLAN_FROM_HISTORY_DAYS = 30;
export const PLAN_FROM_HISTORY_MAX_PLANS = 6;
const FALLBACK_CATEGORY = "core";
const DAY_MS = 86_400_000;

export type HistoryWorkoutRow = { date: Date | number | string; exercises: string };

type ParsedSet = { reps?: unknown; done?: unknown; skipped?: unknown; warmup?: unknown };
type ParsedSession = {
  kind?: unknown;
  title?: unknown;
  exercises?: Array<{ name?: unknown; sets?: ParsedSet[] }>;
};

function ts(v: HistoryWorkoutRow["date"]): number {
  return v instanceof Date ? v.getTime() : new Date(v).getTime();
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Jeden dzień planu na każdą różną nazwę treningu z ostatnich 30 dni; ćwiczenia i serie
 * pochodzą z ostatniego wystąpienia danego treningu. Pomija kardio i puste sesje.
 */
export function buildPlanDaysFromWorkouts(
  rows: HistoryWorkoutRow[],
  opts: { now?: number; days?: number; maxPlans?: number } = {},
): WorkoutPlanPayload[] {
  const now = opts.now ?? Date.now();
  const since = now - (opts.days ?? PLAN_FROM_HISTORY_DAYS) * DAY_MS;
  const maxPlans = opts.maxPlans ?? PLAN_FROM_HISTORY_MAX_PLANS;

  const sorted = rows
    .map((r) => ({ at: ts(r.date), json: r.exercises }))
    .filter((r) => Number.isFinite(r.at) && r.at >= since && r.at <= now)
    .sort((a, b) => b.at - a.at); // od najnowszego

  const plans = new Map<string, WorkoutPlanPayload>();
  for (const row of sorted) {
    if (plans.size >= maxPlans) break;
    let parsed: ParsedSession;
    try {
      parsed = JSON.parse(row.json) as ParsedSession;
    } catch {
      continue;
    }
    if (parsed.kind === "cardio_log") continue;
    const title =
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim().slice(0, PLAN_NAME_MAX)
        : "Trening";
    const key = title.toLowerCase();
    if (plans.has(key)) continue; // starsze wystąpienie tej samej nazwy

    const exercises: WorkoutPlanPayload["exercises"] = [];
    const used = new Set<string>();
    for (const ex of Array.isArray(parsed.exercises) ? parsed.exercises : []) {
      const name = typeof ex?.name === "string" ? ex.name.trim() : "";
      if (name.length < EXERCISE_NAME_MIN || name.length > EXERCISE_NAME_MAX) continue;
      if (used.has(name.toLowerCase())) continue;
      const work = (Array.isArray(ex.sets) ? ex.sets : []).filter(
        (s) => s && s.done === true && s.skipped !== true && s.warmup !== true,
      );
      if (work.length === 0) continue;
      used.add(name.toLowerCase());
      const lastReps = Number(work[work.length - 1]!.reps);
      exercises.push({
        id: `hist-${exercises.length + 1}`,
        name,
        categoryId: findBestCatalogMatch(name)?.categoryId ?? FALLBACK_CATEGORY,
        sets: clamp(work.length, 1, SETS_MAX),
        reps: clamp(Number.isFinite(lastReps) && lastReps > 0 ? Math.round(lastReps) : 10, 1, REPS_MAX),
      });
      if (exercises.length >= MAX_EXERCISES_PER_PLAN) break;
    }
    if (exercises.length === 0) continue;
    plans.set(key, {
      version: 2,
      path: "custom",
      planName: title,
      exercises,
      userCustomExerciseNames: exercises
        .filter((e) => !findBestCatalogMatch(e.name))
        .map((e) => e.name),
    });
  }
  return [...plans.values()];
}

/** Czy pokazać licznik raportów w nagłówku Pulpitu (Z58): są raporty albo konto < 14 dni. */
export function shouldShowReportCount(args: {
  reportCount: number;
  accountCreatedAt: Date | number | null | undefined;
  now?: number;
}): boolean {
  if (args.reportCount > 0) return true;
  if (args.accountCreatedAt == null) return false;
  const created = ts(args.accountCreatedAt as HistoryWorkoutRow["date"]);
  return Number.isFinite(created) && (args.now ?? Date.now()) - created < 14 * DAY_MS;
}

/** Baner „Skonfiguruj pierwszy tydzień” znika, gdy użytkownik ma już jakiekolwiek treningi. */
export function shouldShowOnboarding(args: {
  onboardingCompleted: boolean;
  workoutCount: number;
}): boolean {
  return !args.onboardingCompleted && args.workoutCount === 0;
}
