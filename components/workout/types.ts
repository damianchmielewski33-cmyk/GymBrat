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
  /** RIR 0–5 (ile powtórzeń zostało w rezerwie), opcjonalnie */
  rir?: number | null;
  /** Tempo ruchu np. "3-1-2-0" (ekscentryczna-pauza-koncentryczna-pauza), opcjonalnie */
  tempo?: string | null;
};

export type WorkoutExerciseState = {
  id: string;
  name: string;
  sets: WorkoutSetState[];
  note?: string;
  /** Docelowe powtórzenia z planu (schemat na liście ćwiczeń). */
  targetReps?: number;
  /** Domyślne tempo z planu / katalogu. */
  tempo?: string | null;
  /** Link do filmu instruktażowego (YouTube / zewnętrzny). */
  videoUrl?: string | null;
  /** Id pozycji z katalogu (jeśli znane). */
  catalogId?: string | null;
  /** Wspólne id grupy superserii (null = samotne ćwiczenie). */
  supersetGroupId?: string | null;
  /** Sugerowany ciężar na podstawie historii (kg). */
  suggestedWeightKg?: number | null;
};
