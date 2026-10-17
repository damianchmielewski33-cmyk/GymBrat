import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type CommunityWorkoutMode = "solo" | "group";

type CommunityWorkoutState = {
  mode: CommunityWorkoutMode;
  groupSessionId: string | null;
  teamId: string | null;
  teamName: string | null;
  /** Lokalny rest z ActiveWorkoutView — do presence <1s. */
  restRemaining: number | null;
  setSolo: () => void;
  setGroupSession: (input: {
    sessionId: string;
    teamId: string;
    teamName: string;
  }) => void;
  setRestRemaining: (n: number | null) => void;
  clear: () => void;
};

export const useCommunityWorkoutStore = create<CommunityWorkoutState>()(
  persist(
    (set) => ({
      mode: "solo",
      groupSessionId: null,
      teamId: null,
      teamName: null,
      restRemaining: null,
      setSolo: () =>
        set({
          mode: "solo",
          groupSessionId: null,
          teamId: null,
          teamName: null,
          restRemaining: null,
        }),
      setGroupSession: ({ sessionId, teamId, teamName }) =>
        set({
          mode: "group",
          groupSessionId: sessionId,
          teamId,
          teamName,
        }),
      setRestRemaining: (restRemaining) => set({ restRemaining }),
      clear: () =>
        set({
          mode: "solo",
          groupSessionId: null,
          teamId: null,
          teamName: null,
          restRemaining: null,
        }),
    }),
    {
      name: "community-workout",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        mode: s.mode,
        groupSessionId: s.groupSessionId,
        teamId: s.teamId,
        teamName: s.teamName,
      }),
    },
  ),
);
