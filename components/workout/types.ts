/**
 * Client-side workout tracking state (sent as JSON in existing API — no backend change).
 */
export type WorkoutSetState = {
  /** `null` = pole puste (użytkownik może wyczyścić wpis); liczba = powtórzenia. */
  reps: number | null;
  weight: number;
  done: boolean;
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
};
