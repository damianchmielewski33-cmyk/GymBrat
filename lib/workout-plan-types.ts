export type WorkoutPlanExercise = {
  id: string;
  name: string;
  categoryId: string;
  reps: number;
};

/** Aktualny format planu (v2). */
export type WorkoutPlanPayload = {
  version: 2;
  path: "custom";
  planName: string;
  exercises: WorkoutPlanExercise[];
  /** Ćwiczenia dodane przez użytkownika — dostępne przy wyborze z listy. */
  userCustomExerciseNames: string[];
};
