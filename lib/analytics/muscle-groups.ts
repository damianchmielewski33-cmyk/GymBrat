import type { MuscleRegionId } from "@/lib/resolve-exercise-muscles";
import type { AnalyticsMuscleGroupId } from "@/lib/analytics/types";

export const ANALYTICS_MUSCLE_GROUPS: Array<{
  id: AnalyticsMuscleGroupId;
  label: string;
}> = [
  { id: "klatka", label: "Klatka" },
  { id: "plecy", label: "Plecy" },
  { id: "barki", label: "Barki" },
  { id: "biceps", label: "Biceps" },
  { id: "triceps", label: "Triceps" },
  { id: "nogi", label: "Nogi" },
  { id: "posladki", label: "Pośladki" },
  { id: "lydki", label: "Łydki" },
  { id: "brzuch", label: "Brzuch" },
];

const REGION_TO_GROUP: Partial<Record<MuscleRegionId, AnalyticsMuscleGroupId>> = {
  chest: "klatka",
  back_upper: "plecy",
  back_mid: "plecy",
  back_lower: "plecy",
  shoulders: "barki",
  biceps: "biceps",
  triceps: "triceps",
  quads: "nogi",
  hamstrings: "nogi",
  glutes: "posladki",
  calves: "lydki",
  core: "brzuch",
  forearms: "biceps",
  cardio: undefined,
};

export function regionToAnalyticsGroup(
  region: MuscleRegionId | null | undefined,
): AnalyticsMuscleGroupId | null {
  if (!region) return null;
  return REGION_TO_GROUP[region] ?? null;
}

export function muscleGroupLabel(id: AnalyticsMuscleGroupId): string {
  return ANALYTICS_MUSCLE_GROUPS.find((g) => g.id === id)?.label ?? id;
}
