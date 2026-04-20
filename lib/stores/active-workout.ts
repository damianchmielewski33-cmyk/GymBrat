import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { WorkoutExerciseState, WorkoutSetState } from "@/components/workout/types";
import type { WorkoutPlanPayload } from "@/lib/workout-plan-types";

type ActiveWorkoutState = {
  /** Kotwica działającego licznika (null = pauza) */
  startedAt: number | null;
  /** Sekundy zatrzymanego czasu (suma po „Koniec”) */
  pausedElapsedSeconds: number;
  /** Pierwsze kliknięcie Start — do zapisu API */
  workoutStartedAtMs: number | null;
  title: string;
  workoutPlanId: string | null;
  cardioMinutes: number;
  exercises: WorkoutExerciseState[];
  selectedExerciseId: string | null;
  setTitle: (t: string) => void;
  setCardioMinutes: (n: number) => void;
  setSelectedExerciseId: (id: string | null) => void;
  setExercises: (exercises: WorkoutExerciseState[]) => void;
  patchSet: (exerciseId: string, setIndex: number, patch: Partial<WorkoutSetState>) => void;
  start: () => void;
  stopTimer: () => void;
  applyPlan: (planId: string, plan: WorkoutPlanPayload) => void;
  reset: () => void;
};

export const useActiveWorkoutStore = create<ActiveWorkoutState>()(
  persist(
    (set) => ({
      startedAt: null,
      pausedElapsedSeconds: 0,
      workoutStartedAtMs: null,
      title: "Sesja",
      workoutPlanId: null,
      cardioMinutes: 20,
      exercises: [],
      selectedExerciseId: null,
      setTitle: (title) => set({ title }),
      setCardioMinutes: (cardioMinutes) => set({ cardioMinutes }),
      setSelectedExerciseId: (selectedExerciseId) => set({ selectedExerciseId }),
      setExercises: (exercises) => set({ exercises }),
      patchSet: (exerciseId, setIndex, patch) =>
        set((s) => {
          const ex = s.exercises.find((e) => e.id === exerciseId);
          const current = ex?.sets[setIndex];
          if (!current) return {};

          const nextSet: WorkoutSetState = {
            ...current,
            ...patch,
          };

          // Auto-ukończenie: wpisane powtórzenia + ciężar oznacza serię jako zakończoną.
          const autoDone =
            nextSet.reps != null &&
            Number.isFinite(nextSet.reps) &&
            nextSet.reps > 0 &&
            Number.isFinite(nextSet.weight) &&
            nextSet.weight > 0;

          nextSet.done = autoDone;

          return {
            exercises: s.exercises.map((e) =>
              e.id !== exerciseId
                ? e
                : {
                    ...e,
                    sets: e.sets.map((set, i) => (i === setIndex ? nextSet : set)),
                  },
            ),
          };
        }),
      start: () =>
        set((s) => ({
          startedAt: Date.now(),
          workoutStartedAtMs: s.workoutStartedAtMs ?? Date.now(),
        })),
      stopTimer: () =>
        set((s) => {
          if (s.startedAt == null) return {};
          const add = Math.max(0, Math.floor((Date.now() - s.startedAt) / 1000));
          return {
            startedAt: null,
            pausedElapsedSeconds: s.pausedElapsedSeconds + add,
          };
        }),
      applyPlan: (planId, plan) =>
        set({
          workoutPlanId: planId,
          title: plan.planName.trim() || "Sesja",
          startedAt: null,
          pausedElapsedSeconds: 0,
          workoutStartedAtMs: null,
          cardioMinutes: 20,
          exercises: [],
          selectedExerciseId: null,
        }),
      reset: () =>
        set({
          startedAt: null,
          pausedElapsedSeconds: 0,
          workoutStartedAtMs: null,
          title: "Sesja",
          workoutPlanId: null,
          cardioMinutes: 20,
          exercises: [],
          selectedExerciseId: null,
        }),
    }),
    {
      name: "active-workout",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        startedAt: s.startedAt,
        pausedElapsedSeconds: s.pausedElapsedSeconds,
        workoutStartedAtMs: s.workoutStartedAtMs,
        title: s.title,
        workoutPlanId: s.workoutPlanId,
        cardioMinutes: s.cardioMinutes,
        exercises: s.exercises,
        selectedExerciseId: s.selectedExerciseId,
      }),
      version: 1,
    },
  ),
);
