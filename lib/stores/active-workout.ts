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
  patchExercise: (
    exerciseId: string,
    patch: Partial<Pick<WorkoutExerciseState, "note">>,
  ) => void;
  addSet: (exerciseId: string) => number | null;
  removeLastSet: (exerciseId: string) => number | null;
  start: () => void;
  stopTimer: () => void;
  applyPlan: (planId: string, plan: WorkoutPlanPayload) => void;
  reset: () => void;
};

export const useActiveWorkoutStore = create<ActiveWorkoutState>()(
  persist(
    (set, get) => ({
      startedAt: null,
      pausedElapsedSeconds: 0,
      workoutStartedAtMs: null,
      title: "Sesja",
      workoutPlanId: null,
      cardioMinutes: 0,
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

          if (patch.done === undefined) {
            // Auto-ukończenie: wpisane powtórzenia + ciężar oznacza serię jako zakończoną.
            nextSet.done =
              nextSet.reps != null &&
              Number.isFinite(nextSet.reps) &&
              nextSet.reps > 0 &&
              Number.isFinite(nextSet.weight) &&
              nextSet.weight > 0;
          }

          return {
            exercises: s.exercises.map((e) =>
              e.id !== exerciseId
                ? e
                : {
                    ...e,
                    sets: e.sets.map((setRow, i) => (i === setIndex ? nextSet : setRow)),
                  },
            ),
          };
        }),
      patchExercise: (exerciseId, patch) =>
        set((s) => ({
          exercises: s.exercises.map((e) =>
            e.id !== exerciseId ? e : { ...e, ...patch },
          ),
        })),
      addSet: (exerciseId) => {
        const ex = get().exercises.find((e) => e.id === exerciseId);
        if (!ex) return null;
        const last = ex.sets[ex.sets.length - 1];
        const newIndex = ex.sets.length;
        set({
          exercises: get().exercises.map((e) =>
            e.id !== exerciseId
              ? e
              : {
                  ...e,
                  sets: [
                    ...e.sets,
                    {
                      reps: last?.reps ?? e.targetReps ?? null,
                      weight: last?.weight ?? 0,
                      done: false,
                      skipped: false,
                      rpe: null,
                      rir: e.targetRir ?? null,
                    },
                  ],
                },
          ),
        });
        return newIndex;
      },
      removeLastSet: (exerciseId) => {
        const ex = get().exercises.find((e) => e.id === exerciseId);
        if (!ex || ex.sets.length <= 1) return null;
        const nextSets = ex.sets.slice(0, -1);
        const nextIndex = Math.max(0, nextSets.length - 1);
        set({
          exercises: get().exercises.map((e) =>
            e.id !== exerciseId ? e : { ...e, sets: nextSets },
          ),
        });
        return nextIndex;
      },
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
          cardioMinutes: 0,
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
          cardioMinutes: 0,
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
