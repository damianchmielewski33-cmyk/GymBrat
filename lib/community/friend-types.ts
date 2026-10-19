import type { GroupWorkoutPresence } from "@/lib/community/group-workout-types";

export const FRIENDSHIP_STATUSES = [
  "pending",
  "accepted",
  "blocked",
] as const;

export type FriendLiveView = {
  userId: string;
  displayName: string;
  presence: GroupWorkoutPresence;
  startedAt: number | null;
  updatedAt: number;
};

/**
 * Presence starsze niż to uznajemy za nieaktywne (ms).
 * Push jest event-driven (bez ticka co N s) — dłuższy TTL, żeby długa przerwa
 * między seriami nie gasiła „live”.
 */
export const FRIEND_LIVE_STALE_MS = 45 * 60_000;

export type FriendshipStatus = (typeof FRIENDSHIP_STATUSES)[number];

export function isFriendshipStatus(v: string): v is FriendshipStatus {
  return (FRIENDSHIP_STATUSES as readonly string[]).includes(v);
}

export type FriendListItem = {
  friendshipId: string;
  userId: string;
  displayName: string;
  email: string | null;
  status: FriendshipStatus;
  /** Czy ja udostępniam trening tej osobie. */
  iShareWorkout: boolean;
  /** Czy oni udostępniają trening mnie. */
  theyShareWorkout: boolean;
  mutualShare: boolean;
  isLive: boolean;
};

export type FriendPendingItem = {
  friendshipId: string;
  userId: string;
  displayName: string;
  email: string | null;
  /** true = ja wysłałem, czekam; false = oni wysłali, mogę zaakceptować. */
  outgoing: boolean;
  createdAt: number;
};

export function canonicalPair(
  userId1: string,
  userId2: string,
): { userAId: string; userBId: string } {
  return userId1 < userId2
    ? { userAId: userId1, userBId: userId2 }
    : { userAId: userId2, userBId: userId1 };
}

export function isMutualWorkoutShare(input: {
  status: string;
  shareWorkoutA: number | boolean;
  shareWorkoutB: number | boolean;
}): boolean {
  if (input.status !== "accepted") return false;
  const a = Boolean(input.shareWorkoutA);
  const b = Boolean(input.shareWorkoutB);
  return a && b;
}

export function shareFlagsForViewer(
  viewerId: string,
  userAId: string,
  shareA: number,
  shareB: number,
): { iShare: boolean; theyShare: boolean } {
  const viewerIsA = viewerId === userAId;
  return {
    iShare: Boolean(viewerIsA ? shareA : shareB),
    theyShare: Boolean(viewerIsA ? shareB : shareA),
  };
}
