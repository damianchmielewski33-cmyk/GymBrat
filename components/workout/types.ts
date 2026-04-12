/**
 * Client-side workout tracking state (sent as JSON in existing API — no backend change).
 */
export type WorkoutSetState = {
  reps: number;
  weight: number;
  done: boolean;
};

export type WorkoutExerciseState = {
  id: string;
  name: string;
  sets: WorkoutSetState[];
};
