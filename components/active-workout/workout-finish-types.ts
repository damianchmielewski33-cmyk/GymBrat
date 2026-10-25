/**
 * Kontrakt danych ekranu „Trening zakończony” (ADR 0004 p.7). Osobny plik bez `"use client"`
 * żeby store (`lib/stores/active-workout.ts`) i hook/ekran mogły go importować bez cyklu.
 */
import type { WorkoutExerciseState } from "@/components/workout/types";
import type { ActiveCardioExtras } from "@/lib/cardio-utils";
import type { NewMaxHit, SessionWeightRecord } from "@/lib/session-new-max";
import type { WorkoutPlanComparePayload } from "@/lib/workout-plan-compare";

export type WorkoutFinishedScreenData = {
  title: string;
  planLabel: string;
  endedAtMs: number;
  durationSeconds: number;
  setsDone: number;
  setsTotal: number;
  volumeKg: number;
  /** Pełna lista — do drugiej linii „wszystkie serie” (AC-4.6). */
  exercises: WorkoutExerciseState[];
  weightRecords: SessionWeightRecord[];
  newMaxHits: NewMaxHit[];
  cardioMinutes: number;
  cardioExtras: ActiveCardioExtras;
  saveStatus: "saved" | "queued";
  /** `null` tylko gdy `saveStatus === "queued"` (zapis offline bez odpowiedzi serwera). */
  workoutId: string | null;
  /** Z odpowiedzi `POST /api/workouts/complete` — bez nowego zapytania (AC-4.2). */
  planCompare: WorkoutPlanComparePayload | null;
};
