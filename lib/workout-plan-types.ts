export type WorkoutPlanExercise = {
  id: string;
  name: string;
  categoryId: string;
  reps: number;
  /** Tempo np. "3-1-2-0" — opcjonalne. */
  tempo?: string | null;
  /** Film instruktażowy — opcjonalnie nadpisuje link z katalogu. */
  videoUrl?: string | null;
  catalogId?: string | null;
  /** Ćwiczenia z tym samym id tworzą superserię. */
  supersetGroupId?: string | null;
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
