import "server-only";

import {
  ANALYTICS_MUSCLE_GROUPS,
  regionToAnalyticsGroup,
} from "@/lib/analytics/muscle-groups";
import type { AnalyticsMuscleGroupId } from "@/lib/analytics/types";
import { resolveExerciseMuscles } from "@/lib/resolve-exercise-muscles";
import type { WorkoutPlanExercise } from "@/lib/workout-plan-types";

export type PlanDayMuscleGroupId =
  | "klatka"
  | "plecy"
  | "barki"
  | "ramiona"
  | "nogi"
  | "posladki"
  | "lydki"
  | "brzuch";

export type PlanDayMuscleSummary = {
  /** 1..PLAN_DAY_MUSCLE_LIMIT grup, najczęstsze pierwsze. */
  groups: PlanDayMuscleGroupId[];
  /** Etykiety w kolejności `groups`, np. ["Klatka", "Barki", "Ramiona"]. */
  labels: string[];
  view: "front" | "back";
};

export const PLAN_DAY_MUSCLE_LIMIT = 3;

const ARMS_LABEL = "Ramiona";

/** Biceps i triceps (przedramiona mapują się na biceps) = jedna grupa „Ramiona” (P-3). */
function toPlanDayGroup(id: AnalyticsMuscleGroupId): PlanDayMuscleGroupId {
  return id === "biceps" || id === "triceps" ? "ramiona" : id;
}

function groupLabel(id: PlanDayMuscleGroupId): string {
  if (id === "ramiona") return ARMS_LABEL;
  return ANALYTICS_MUSCLE_GROUPS.find((g) => g.id === id)?.label ?? id;
}

/**
 * Do 3 głównych partii dnia planu (tylko partia główna ćwiczenia; cardio i nierozpoznane pomijane).
 * Kolejność: liczba ćwiczeń malejąco, potem pierwsze wystąpienie w planie.
 * `null` gdy żadne ćwiczenie nie ma rozpoznanej partii (UI: ikona sztangi).
 */
export function summarizePlanDayMuscles(
  exercises: ReadonlyArray<Pick<WorkoutPlanExercise, "name" | "categoryId">>,
): PlanDayMuscleSummary | null {
  const stats = new Map<PlanDayMuscleGroupId, { count: number; firstIndex: number }>();
  exercises.forEach((ex, index) => {
    const analytics = regionToAnalyticsGroup(
      resolveExerciseMuscles({ name: ex.name, categoryId: ex.categoryId }).primary,
    );
    if (!analytics) return;
    const group = toPlanDayGroup(analytics);
    const current = stats.get(group);
    if (current) current.count += 1;
    else stats.set(group, { count: 1, firstIndex: index });
  });
  if (stats.size === 0) return null;

  const groups = [...stats.entries()]
    // Pierwsze wystąpienie jest unikalne dla grupy, więc rozstrzyga każdy remis liczności.
    .sort(([, a], [, b]) => b.count - a.count || a.firstIndex - b.firstIndex)
    .slice(0, PLAN_DAY_MUSCLE_LIMIT)
    .map(([group]) => group);

  const isBack =
    (groups.includes("plecy") || groups.includes("posladki")) &&
    !groups.includes("klatka") &&
    !groups.includes("brzuch");

  return { groups, labels: groups.map(groupLabel), view: isBack ? "back" : "front" };
}
