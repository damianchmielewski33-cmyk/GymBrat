import { and, eq, gte, inArray, or } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import {
  friendLivePresence,
  friendships,
  teamMembers,
  users,
} from "@/db/schema";
import {
  FRIEND_LIVE_STALE_MS,
  canonicalPair,
  isFriendshipStatus,
  isMutualWorkoutShare,
  shareFlagsForViewer,
  type FriendListItem,
  type FriendPendingItem,
} from "@/lib/community/friend-types";

const GENERIC_INVITE_ERROR =
  "Nie udało się wysłać zaproszenia. Sprawdź e-mail albo spróbuj ponownie.";

function displayNameFromUser(row: {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  const full = [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (row.name?.trim()) return row.name.trim();
  return row.email.split("@")[0] || "Zawodnik";
}

async function findUserByEmail(email: string) {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return null;
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);
  return row ?? null;
}

export async function shareTeamWithUser(
  viewerId: string,
  otherUserId: string,
): Promise<boolean> {
  if (viewerId === otherUserId) return false;
  const db = getDb();
  const rows = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.userId, viewerId),
        eq(teamMembers.status, "active"),
      ),
    );
  if (rows.length === 0) return false;
  const teamIds = rows.map((r) => r.teamId);
  const [hit] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.userId, otherUserId),
        eq(teamMembers.status, "active"),
        inArray(teamMembers.teamId, teamIds),
      ),
    )
    .limit(1);
  return Boolean(hit);
}

async function getFriendshipRow(userId1: string, userId2: string) {
  const { userAId, userBId } = canonicalPair(userId1, userId2);
  const db = getDb();
  const [row] = await db
    .select()
    .from(friendships)
    .where(
      and(eq(friendships.userAId, userAId), eq(friendships.userBId, userBId)),
    )
    .limit(1);
  return row ?? null;
}

export async function requestFriendshipByEmail(
  requesterId: string,
  rawEmail: string,
) {
  await ensureCriticalSchema();
  const target = await findUserByEmail(rawEmail);
  if (!target || target.id === requesterId) {
    return { ok: false as const, error: GENERIC_INVITE_ERROR };
  }
  return createFriendshipRequest(requesterId, target.id);
}

export async function requestFriendshipFromTeamMember(
  requesterId: string,
  otherUserId: string,
) {
  await ensureCriticalSchema();
  if (requesterId === otherUserId) {
    return { ok: false as const, error: "Nie możesz dodać siebie." };
  }
  const shared = await shareTeamWithUser(requesterId, otherUserId);
  if (!shared) {
    return {
      ok: false as const,
      error: "Możesz dodać tylko kogoś ze wspólnej grupy Team.",
    };
  }
  return createFriendshipRequest(requesterId, otherUserId);
}

async function createFriendshipRequest(
  requesterId: string,
  otherUserId: string,
) {
  const existing = await getFriendshipRow(requesterId, otherUserId);
  if (existing) {
    if (existing.status === "accepted") {
      return { ok: true as const, friendshipId: existing.id, already: true };
    }
    if (existing.status === "blocked") {
      return { ok: false as const, error: GENERIC_INVITE_ERROR };
    }
    if (existing.status === "pending") {
      return { ok: true as const, friendshipId: existing.id, already: true };
    }
  }

  const { userAId, userBId } = canonicalPair(requesterId, otherUserId);
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date();
  try {
    await db.insert(friendships).values({
      id,
      userAId,
      userBId,
      status: "pending",
      requestedBy: requesterId,
      shareWorkoutA: 0,
      shareWorkoutB: 0,
      createdAt: now,
      updatedAt: now,
    });
  } catch {
    return { ok: false as const, error: GENERIC_INVITE_ERROR };
  }
  return { ok: true as const, friendshipId: id, already: false };
}

export async function acceptFriendship(
  userId: string,
  friendshipId: string,
) {
  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, friendshipId))
    .limit(1);
  if (!row || row.status !== "pending") {
    return { ok: false as const, error: "Zaproszenie nie istnieje." };
  }
  if (row.requestedBy === userId) {
    return { ok: false as const, error: "To Twoje własne zaproszenie." };
  }
  if (row.userAId !== userId && row.userBId !== userId) {
    return { ok: false as const, error: "Brak dostępu." };
  }
  const now = new Date();
  await db
    .update(friendships)
    .set({ status: "accepted", respondedAt: now, updatedAt: now })
    .where(eq(friendships.id, friendshipId));
  return { ok: true as const };
}

export async function declineFriendship(
  userId: string,
  friendshipId: string,
) {
  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, friendshipId))
    .limit(1);
  if (!row || row.status !== "pending") {
    return { ok: false as const, error: "Zaproszenie nie istnieje." };
  }
  if (row.userAId !== userId && row.userBId !== userId) {
    return { ok: false as const, error: "Brak dostępu." };
  }
  await db.delete(friendships).where(eq(friendships.id, friendshipId));
  return { ok: true as const };
}

export async function removeFriendship(userId: string, friendshipId: string) {
  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, friendshipId))
    .limit(1);
  if (!row) {
    return { ok: false as const, error: "Znajomość nie istnieje." };
  }
  if (row.userAId !== userId && row.userBId !== userId) {
    return { ok: false as const, error: "Brak dostępu." };
  }
  await db.delete(friendships).where(eq(friendships.id, friendshipId));
  return { ok: true as const };
}

export async function setShareWorkout(
  userId: string,
  friendshipId: string,
  enabled: boolean,
) {
  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, friendshipId))
    .limit(1);
  if (!row || row.status !== "accepted") {
    return { ok: false as const, error: "Znajomość nie jest aktywna." };
  }
  if (row.userAId !== userId && row.userBId !== userId) {
    return { ok: false as const, error: "Brak dostępu." };
  }
  const patch =
    row.userAId === userId
      ? { shareWorkoutA: enabled ? 1 : 0, updatedAt: new Date() }
      : { shareWorkoutB: enabled ? 1 : 0, updatedAt: new Date() };
  await db.update(friendships).set(patch).where(eq(friendships.id, friendshipId));
  return { ok: true as const };
}

export async function listFriendsAndPending(userId: string): Promise<{
  friends: FriendListItem[];
  pending: FriendPendingItem[];
}> {
  await ensureCriticalSchema();
  const db = getDb();
  const rows = await db
    .select()
    .from(friendships)
    .where(
      and(
        or(eq(friendships.userAId, userId), eq(friendships.userBId, userId)),
        or(eq(friendships.status, "accepted"), eq(friendships.status, "pending")),
      ),
    );

  const otherIds = [
    ...new Set(
      rows.map((r) => (r.userAId === userId ? r.userBId : r.userAId)),
    ),
  ];
  const userMap = new Map<
    string,
    {
      email: string;
      name: string | null;
      firstName: string | null;
      lastName: string | null;
    }
  >();
  if (otherIds.length > 0) {
    const userRows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(inArray(users.id, otherIds));
    for (const u of userRows) userMap.set(u.id, u);
  }

  const liveIds = new Set<string>();
  if (otherIds.length > 0) {
    const cutoff = new Date(Date.now() - FRIEND_LIVE_STALE_MS);
    const liveRows = await db
      .select({ userId: friendLivePresence.userId })
      .from(friendLivePresence)
      .where(
        and(
          eq(friendLivePresence.active, 1),
          gte(friendLivePresence.updatedAt, cutoff),
          inArray(friendLivePresence.userId, otherIds),
        ),
      );
    for (const r of liveRows) liveIds.add(r.userId);
  }

  const friends: FriendListItem[] = [];
  const pending: FriendPendingItem[] = [];

  for (const row of rows) {
    const otherId = row.userAId === userId ? row.userBId : row.userAId;
    const other = userMap.get(otherId);
    if (!other) continue;
    const displayName = displayNameFromUser(other);
    const status = isFriendshipStatus(row.status) ? row.status : "pending";

    if (status === "pending") {
      pending.push({
        friendshipId: row.id,
        userId: otherId,
        displayName,
        email: other.email,
        outgoing: row.requestedBy === userId,
        createdAt: row.createdAt.getTime(),
      });
      continue;
    }

    if (status !== "accepted") continue;
    const flags = shareFlagsForViewer(
      userId,
      row.userAId,
      row.shareWorkoutA,
      row.shareWorkoutB,
    );
    friends.push({
      friendshipId: row.id,
      userId: otherId,
      displayName,
      email: other.email,
      status: "accepted",
      iShareWorkout: flags.iShare,
      theyShareWorkout: flags.theyShare,
      mutualShare: isMutualWorkoutShare({
        status: row.status,
        shareWorkoutA: row.shareWorkoutA,
        shareWorkoutB: row.shareWorkoutB,
      }),
      isLive: liveIds.has(otherId),
    });
  }

  friends.sort((a, b) => a.displayName.localeCompare(b.displayName, "pl"));
  pending.sort((a, b) => b.createdAt - a.createdAt);
  return { friends, pending };
}

export async function listMutualShareFriendIds(
  userId: string,
): Promise<string[]> {
  await ensureCriticalSchema();
  const db = getDb();
  const rows = await db
    .select({
      userAId: friendships.userAId,
      userBId: friendships.userBId,
      shareA: friendships.shareWorkoutA,
      shareB: friendships.shareWorkoutB,
      status: friendships.status,
    })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(eq(friendships.userAId, userId), eq(friendships.userBId, userId)),
        eq(friendships.shareWorkoutA, 1),
        eq(friendships.shareWorkoutB, 1),
      ),
    );
  return rows.map((r) => (r.userAId === userId ? r.userBId : r.userAId));
}

export async function canWatchFriendLive(
  viewerId: string,
  subjectId: string,
): Promise<boolean> {
  if (viewerId === subjectId) return false;
  await ensureCriticalSchema();
  const row = await getFriendshipRow(viewerId, subjectId);
  if (!row) return false;
  return isMutualWorkoutShare({
    status: row.status,
    shareWorkoutA: row.shareWorkoutA,
    shareWorkoutB: row.shareWorkoutB,
  });
}

export async function hasAnyMutualShare(userId: string): Promise<boolean> {
  const ids = await listMutualShareFriendIds(userId);
  return ids.length > 0;
}

export async function getFriendshipRelation(
  viewerId: string,
  otherUserId: string,
): Promise<"none" | "pending" | "accepted" | "blocked"> {
  if (viewerId === otherUserId) return "none";
  await ensureCriticalSchema();
  const row = await getFriendshipRow(viewerId, otherUserId);
  if (!row) return "none";
  if (isFriendshipStatus(row.status)) return row.status;
  return "none";
}
