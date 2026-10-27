/** Canonical tonnage for completed sets, in kg × reps. */
export function computeSessionTonnageKg(rawExercises: unknown): number {
  let exercises = rawExercises;
  if (typeof exercises === "string") {
    try { exercises = JSON.parse(exercises) as unknown; } catch { return 0; }
  }
  if (exercises && typeof exercises === "object" && !Array.isArray(exercises)) {
    exercises = (exercises as { exercises?: unknown }).exercises;
  }
  if (!Array.isArray(exercises)) return 0;
  let total = 0;
  for (const rawExercise of exercises) {
    if (!rawExercise || typeof rawExercise !== "object") continue;
    const sets = (rawExercise as { sets?: unknown }).sets;
    if (!Array.isArray(sets)) continue;
    for (const rawSet of sets) {
      if (!rawSet || typeof rawSet !== "object") continue;
      const set = rawSet as { reps?: unknown; weight?: unknown; done?: unknown; skipped?: unknown };
      if (set.skipped === true || set.done === false) continue;
      if (set.done !== true && set.done !== undefined) continue;
      const reps = Number(set.reps);
      const weight = Number(set.weight);
      if (Number.isFinite(reps) && reps > 0 && Number.isFinite(weight) && weight > 0) total += reps * weight;
    }
  }
  return Math.round(total * 10) / 10;
}
