import { exerciseVolume, type VolumeSetInput } from "@/lib/workout-session-calculations";

/** Tonaż sesji (kg × powt.) — deleguje do kanonu `exerciseVolume` (wspólna reguła z Historią i Pulpitem). */
export function computeSessionTonnageKg(rawExercises: unknown): number {
  let exercises = rawExercises;
  if (typeof exercises === "string") {
    try { exercises = JSON.parse(exercises) as unknown; } catch { return 0; }
  }
  if (exercises && typeof exercises === "object" && !Array.isArray(exercises)) {
    exercises = (exercises as { exercises?: unknown }).exercises;
  }
  if (!Array.isArray(exercises)) return 0;
  const sets: VolumeSetInput[] = [];
  for (const rawExercise of exercises) {
    if (!rawExercise || typeof rawExercise !== "object") continue;
    const rawSets = (rawExercise as { sets?: unknown }).sets;
    if (!Array.isArray(rawSets)) continue;
    for (const rawSet of rawSets) {
      if (!rawSet || typeof rawSet !== "object") continue;
      const set = rawSet as {
        reps?: unknown;
        weight?: unknown;
        done?: unknown;
        skipped?: unknown;
        warmup?: unknown;
      };
      const reps = Number(set.reps);
      const weight = Number(set.weight);
      sets.push({
        reps: Number.isFinite(reps) ? reps : null,
        weight: Number.isFinite(weight) ? weight : 0,
        // Dziwne wartości `done` (np. 1, "yes") traktujemy jak niewykonane.
        done:
          set.done === undefined ? undefined : set.done === true,
        skipped: set.skipped === true ? true : undefined,
        warmup: set.warmup === true ? true : undefined,
      });
    }
  }
  return Math.round(exerciseVolume(sets) * 10) / 10;
}
