"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type FriendLiveWatchState = {
  /** userId znajomego którego podglądamy (read-only). */
  watchingUserId: string | null;
  watchingDisplayName: string | null;
  setWatching: (userId: string, displayName?: string | null) => void;
  clearWatching: () => void;
};

export const useFriendLiveWatchStore = create<FriendLiveWatchState>()(
  persist(
    (set) => ({
      watchingUserId: null,
      watchingDisplayName: null,
      setWatching: (userId, displayName = null) =>
        set({
          watchingUserId: userId,
          watchingDisplayName: displayName,
        }),
      clearWatching: () =>
        set({ watchingUserId: null, watchingDisplayName: null }),
    }),
    { name: "gymbrat-friend-live-watch" },
  ),
);
