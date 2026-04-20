/**
 * Client-side workout tracking state (sent as JSON in existing API — no backend change).
 */
export type WorkoutSetState = {
  /** `null` = pole puste (użytkownik może wyczyścić wpis); liczba = powtórzenia. */
  reps: number | null;
  weight: number;
  done: boolean;
};

export type WorkoutExerciseState = {
  id: string;
  name: string;
  sets: WorkoutSetState[];
};
