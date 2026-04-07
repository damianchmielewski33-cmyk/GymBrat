import { create } from "zustand";

type ActiveWorkoutState = {
  startedAt: number | null;
  title: string;
  setTitle: (t: string) => void;
  start: () => void;
  reset: () => void;
};

export const useActiveWorkoutStore = create<ActiveWorkoutState>((set) => ({
  startedAt: null,
  title: "Session",
  setTitle: (title) => set({ title }),
  start: () => set({ startedAt: Date.now() }),
  reset: () => set({ startedAt: null, title: "Session" }),
}));
