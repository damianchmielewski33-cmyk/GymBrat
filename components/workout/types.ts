/**
 * Client-side workout tracking state (sent as JSON in existing API — no backend change).
 */
export type WorkoutSetState = {
  /** `null` = pole puste (użytkownik może wyczyścić wpis); liczba = powtórzenia. */
  reps: number | null;
  weight: number;
  done: boolean;
  /** Seria pominięta („Pomiń serię”) — done, ale bez realnego wykonania. */
  skipped?: boolean;
  /** RPE 1–10, opcjonalnie */
  rpe?: number | null;
  /** RIR 0–3+ (w zapasie), opcjonalnie */
  rir?: number | null;
};

export type WorkoutExerciseState = {
  id: string;
  name: string;
  sets: WorkoutSetState[];
  note?: string;
  /** Cele z planu — tylko do wyświetlenia w sesji prowadzonej. */
  targetSets?: number;
  targetReps?: number;
  targetRir?: number | null;
  tempo?: string | null;
  /** Wspólne id = superseria (kolejno w sesji). */
  supersetGroupId?: string | null;
  /** Sugestia ciężaru per seria (z ostatniej sesji). */
  suggestedWeights?: Array<number | null>;
  /** Ostatnia sesja tego ćwiczenia — do „Ostatnio …” i progresji. */
  lastSessionSets?: Array<WorkoutSetState | null>;
  /** Kontekst 2–4 ostatnich treningów (przerwa, stagnacja, średni top). */
  coachContext?: ExerciseCoachContext | null;
  /** Kategoria katalogu (izolacja vs compound). */
  categoryId?: string | null;
  /** Link YouTube techniki (z panelu admina, po dopasowaniu katalogu). */
  techniqueYoutubeUrl?: string | null;
};

/** Agregat historii ćwiczenia dla live coach / chipów. */
export type ExerciseCoachContext = {
  daysSinceLastSession: number | null;
  recentSessionCount: number;
  avgTopSetWeightKg: number | null;
  /** Brak progresji ciężaru/powtórzeń przez kilka treningów. */
  stagnant: boolean;
};
