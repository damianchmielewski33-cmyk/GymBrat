import type { WorkoutExerciseState } from "@/components/workout/types";
import { findBestCatalogMatch } from "@/lib/workout-exercise-catalog";

/** Dopasuj nazwę ćwiczenia z planu do URL techniki (mapa catalogId → URL). */
export function resolveTechniqueUrlForName(
  exerciseName: string,
  map: Record<string, string>,
): string | null {
  const hit = findBestCatalogMatch(exerciseName);
  if (!hit) return null;
  return map[hit.id] ?? null;
}

/** Dokleja URL techniki z mapy catalogId→URL tylko gdy plan nie ma własnego linku. */
export function attachTechniqueUrls(
  exercises: WorkoutExerciseState[],
  catalogUrlMap: Record<string, string>,
): WorkoutExerciseState[] {
  if (!exercises.length) return exercises;
  return exercises.map((ex) => {
    const fromPlan = ex.techniqueYoutubeUrl?.trim() || null;
    if (fromPlan) {
      return { ...ex, techniqueYoutubeUrl: fromPlan };
    }
    const url = resolveTechniqueUrlForName(ex.name, catalogUrlMap);
    return {
      ...ex,
      techniqueYoutubeUrl: url ?? null,
    };
  });
}
