import "server-only";

import type { WorkoutPlanWithLastWorkoutDTO } from "@/actions/workout-plan";
import { addCalendarDays, calendarWeekMondayKey } from "@/lib/local-date";
import {
  summarizePlanDayMuscles,
  type PlanDayMuscleSummary,
} from "@/lib/plan-day-muscles";
import {
  getLastSessionLoadsForPlan,
  type ExerciseLastLoad,
} from "@/lib/plan-last-session-loads";
import { NEXT_CARD_EXERCISE_PREVIEW } from "@/lib/treningi-hub-format";
import { pickNextWorkoutPlan } from "@/lib/workout-plan-queue";
import { loadWorkoutPlansWithLastWorkout } from "@/lib/workout-plans-with-last-workout";

export type CalendarWeek = { todayKey: string; startKey: string; endKey: string };

export type TreningiHubDay = {
  row: WorkoutPlanWithLastWorkoutDTO;
  /** `row.lastWorkoutDate` w [startKey, endKey] bieżącego tygodnia. */
  doneThisWeek: boolean;
  muscles: PlanDayMuscleSummary | null;
};

export type TreningiHubData = {
  week: CalendarWeek;
  /** Dni planu po `dayNumber` rosnąco. */
  days: TreningiHubDay[];
  nextPlanId: string | null;
  /** Tylko pierwsze `NEXT_CARD_EXERCISE_PREVIEW` ćwiczeń następnego dnia; klucz = id ćwiczenia. */
  nextLastLoads: Record<string, ExerciseLastLoad>;
};

/** Tydzień pon–niedz. zawierający `todayKey` (kalendarz `getCalendarTimezone()`). */
function calendarWeekOf(todayKey: string): CalendarWeek {
  const startKey = calendarWeekMondayKey(todayKey);
  return { todayKey, startKey, endKey: addCalendarDays(startKey, 6) };
}

export function buildTreningiHubDays(
  plans: readonly WorkoutPlanWithLastWorkoutDTO[],
  week: CalendarWeek,
): TreningiHubDay[] {
  return [...plans]
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((row) => ({
      row,
      doneThisWeek:
        row.lastWorkoutDate != null &&
        row.lastWorkoutDate >= week.startKey &&
        row.lastWorkoutDate <= week.endKey,
      muscles: summarizePlanDayMuscles(row.plan.exercises),
    }));
}

/**
 * Dane ekranu Trening liczone raz na serwerze dla jednego „dziś”.
 * `userId` wyłącznie z sesji; zapytanie o obciążenia tylko gdy następny dzień był już robiony.
 */
export async function getTreningiHubData(
  userId: string,
  todayKey: string,
): Promise<TreningiHubData> {
  const week = calendarWeekOf(todayKey);
  const plans = await loadWorkoutPlansWithLastWorkout(userId);
  const next = pickNextWorkoutPlan(plans);
  const nextLastLoads =
    next?.lastWorkoutDate != null
      ? await getLastSessionLoadsForPlan(
          userId,
          next.id,
          next.plan.exercises.slice(0, NEXT_CARD_EXERCISE_PREVIEW),
        )
      : {};
  return {
    week,
    days: buildTreningiHubDays(plans, week),
    nextPlanId: next?.id ?? null,
    nextLastLoads,
  };
}
