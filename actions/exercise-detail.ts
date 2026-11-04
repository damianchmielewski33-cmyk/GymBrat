"use server";

import { auth } from "@/auth";
import { getExercisesAsCatalog } from "@/lib/exercises/exercises-repository";
import { CATALOG_EXERCISES } from "@/lib/workout-exercise-catalog";

export type ExerciseDetailDTO = {
  description?: string;
  cues?: string[];
  techniqueYoutubeUrl?: string;
};

/** Z70: szczegóły karty ćwiczenia pobierane na żądanie, nie w payloadzie całego Atlasu. */
export async function getExerciseDetail(
  exerciseId: string,
): Promise<ExerciseDetailDTO | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const id = String(exerciseId ?? "").trim();
  if (!id || id.length > 100) return null;
  let found = CATALOG_EXERCISES.find((e) => e.id === id);
  try {
    const fromDb = (await getExercisesAsCatalog()).find((e) => e.id === id);
    if (fromDb) found = fromDb;
  } catch {
    /* fallback do katalogu w kodzie */
  }
  if (!found) return null;
  return {
    description: found.description,
    cues: found.cues,
    techniqueYoutubeUrl: found.techniqueYoutubeUrl,
  };
}
