import { create } from "zustand";
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
  setTitle: (t: string) => void;
  start: () => void;
  stopTimer: () => void;
  applyPlan: (planId: string, plan: WorkoutPlanPayload) => void;
  reset: () => void;
};

export const useActiveWorkoutStore = create<ActiveWorkoutState>((set) => ({
  startedAt: null,
  pausedElapsedSeconds: 0,
  workoutStartedAtMs: null,
  title: "Sesja",
  workoutPlanId: null,
  setTitle: (title) => set({ title }),
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
    }),
  reset: () =>
    set({
      startedAt: null,
      pausedElapsedSeconds: 0,
      workoutStartedAtMs: null,
      title: "Sesja",
      workoutPlanId: null,
    }),
}));
