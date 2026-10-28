import type { PlanDayMuscleSummary } from "@/lib/plan-day-muscles";
import { MUSCLE_CATEGORIES } from "@/lib/workout-exercise-catalog";

export function glyphForCategory(categoryId: string): PlanDayMuscleSummary | null {
  const map: Record<string, PlanDayMuscleSummary["groups"][number]> = {
    chest: "klatka",
    back_upper: "plecy",
    back_mid: "plecy",
    back_lower: "plecy",
    shoulders: "barki",
    biceps: "ramiona",
    triceps: "ramiona",
    core: "brzuch",
    quads: "nogi",
    glutes: "posladki",
    hamstrings: "nogi",
    calves: "lydki",
  };
  const g = map[categoryId];
  if (!g) return null;
  const label =
    MUSCLE_CATEGORIES.find((c) => c.id === categoryId)?.label ?? categoryId;
  const view =
    categoryId.startsWith("back") ||
    categoryId === "glutes" ||
    categoryId === "hamstrings" ||
    categoryId === "calves"
      ? "back"
      : "front";
  return { groups: [g], labels: [label], view };
}
