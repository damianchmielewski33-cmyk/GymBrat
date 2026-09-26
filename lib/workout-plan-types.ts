export type WorkoutPlanExercise = {
  id: string;
  name: string;
  categoryId: string;
  reps: number;
  /** Liczba serii w planie (domyślnie 3 przy starcie sesji). */
  sets: number;
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
