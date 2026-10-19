import { create } from "zustand";
import type { GhostDelta, GhostTimeline } from "@/lib/ghost-training/types";

type GhostTrainingState = {
  enabled: boolean;
  timeline: GhostTimeline | null;
  delta: GhostDelta | null;
  setTimeline: (t: GhostTimeline | null) => void;
  setDelta: (d: GhostDelta | null) => void;
  clear: () => void;
};

export const useGhostTrainingStore = create<GhostTrainingState>((set) => ({
  enabled: false,
  timeline: null,
  delta: null,
  setTimeline: (timeline) =>
    set({ timeline, enabled: Boolean(timeline), delta: null }),
  setDelta: (delta) => set({ delta }),
  clear: () => set({ enabled: false, timeline: null, delta: null }),
}));
