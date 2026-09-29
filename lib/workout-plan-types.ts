export type WorkoutPlanExercise = {
  id: string;
  name: string;
  categoryId: string;
  reps: number;
  /** Liczba serii w planie (domyślnie 3 przy starcie sesji). */
  sets: number;
  /** RIR docelowy (0–5), opcjonalnie. */
  rir?: number | null;
  /** Tempo np. "3010", opcjonalnie. */
  tempo?: string | null;
  /** Notatka techniczna / cue. */
  note?: string | null;
  /** Link YouTube do techniki — ustawiany przy układaniu planu. */
  techniqueYoutubeUrl?: string | null;
  /** Ćwiczenia z tym samym id = superseria (kolejno w sesji). */
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
