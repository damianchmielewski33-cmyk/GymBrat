import { and, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { friendLivePresence, users } from "@/db/schema";
import {
  FRIEND_LIVE_STALE_MS,
  type FriendLiveView,
} from "@/lib/community/friend-types";
import {
  canWatchFriendLive,
  hasAnyMutualShare,
  listMutualShareFriendIds,
} from "@/lib/community/friendships";
import {
  emptyPresence,
  parsePresence,
  type GroupWorkoutPresence,
} from "@/lib/community/group-workout-types";

export type { FriendLiveView };
export { FRIEND_LIVE_STALE_MS };

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

export async function upsertFriendLivePresence(input: {
  userId: string;
  presence: GroupWorkoutPresence;
  startedAt?: Date | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await ensureCriticalSchema();
  const hasShare = await hasAnyMutualShare(input.userId);
  if (!hasShare) {
    return { ok: false, error: "Brak wzajemnego udostępniania treningu." };
  }

  const db = getDb();
  const now = new Date();
  const [existing] = await db
    .select({
      startedAt: friendLivePresence.startedAt,
      active: friendLivePresence.active,
    })
    .from(friendLivePresence)
    .where(eq(friendLivePresence.userId, input.userId))
    .limit(1);

  const startedAt =
    input.startedAt ??
    (existing?.active === 1 && existing.startedAt
      ? existing.startedAt
      : now);

  await db
    .insert(friendLivePresence)
    .values({
      userId: input.userId,
      presenceJson: JSON.stringify(input.presence),
      active: 1,
      startedAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: friendLivePresence.userId,
      set: {
        presenceJson: JSON.stringify(input.presence),
        active: 1,
        startedAt,
        updatedAt: now,
      },
    });

  return { ok: true };
}

export async function clearFriendLivePresence(userId: string): Promise<void> {
  await ensureCriticalSchema();
  const db = getDb();
  await db
    .update(friendLivePresence)
    .set({ active: 0, updatedAt: new Date() })
    .where(eq(friendLivePresence.userId, userId));
}

export async function getFriendLivePresence(
  viewerId: string,
  subjectId: string,
): Promise<FriendLiveView | null> {
  const allowed = await canWatchFriendLive(viewerId, subjectId);
  if (!allowed) return null;

  await ensureCriticalSchema();
  const db = getDb();
  const cutoff = new Date(Date.now() - FRIEND_LIVE_STALE_MS);
  const [row] = await db
    .select({
      presenceJson: friendLivePresence.presenceJson,
      startedAt: friendLivePresence.startedAt,
      updatedAt: friendLivePresence.updatedAt,
      active: friendLivePresence.active,
      email: users.email,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(friendLivePresence)
    .innerJoin(users, eq(users.id, friendLivePresence.userId))
    .where(
      and(
        eq(friendLivePresence.userId, subjectId),
        eq(friendLivePresence.active, 1),
        gte(friendLivePresence.updatedAt, cutoff),
      ),
    )
    .limit(1);

  if (!row) return null;
  const presence = parsePresence(row.presenceJson);
  const displayName = displayNameFromUser(row);
  return {
    userId: subjectId,
    displayName,
    presence: { ...presence, displayName },
    startedAt: row.startedAt?.getTime() ?? null,
    updatedAt: row.updatedAt.getTime(),
  };
}

export async function listLiveFriendsForViewer(
  viewerId: string,
): Promise<FriendLiveView[]> {
  const friendIds = await listMutualShareFriendIds(viewerId);
  if (friendIds.length === 0) return [];

  await ensureCriticalSchema();
  const db = getDb();
  const cutoff = new Date(Date.now() - FRIEND_LIVE_STALE_MS);
  const rows = await db
    .select({
      userId: friendLivePresence.userId,
      presenceJson: friendLivePresence.presenceJson,
      startedAt: friendLivePresence.startedAt,
      updatedAt: friendLivePresence.updatedAt,
      email: users.email,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(friendLivePresence)
    .innerJoin(users, eq(users.id, friendLivePresence.userId))
    .where(
      and(
        eq(friendLivePresence.active, 1),
        gte(friendLivePresence.updatedAt, cutoff),
        inArray(friendLivePresence.userId, friendIds),
      ),
    );

  return rows.map((row) => {
    const displayName = displayNameFromUser(row);
    const presence = parsePresence(row.presenceJson);
    return {
      userId: row.userId,
      displayName,
      presence: { ...presence, displayName },
      startedAt: row.startedAt?.getTime() ?? null,
      updatedAt: row.updatedAt.getTime(),
    };
  });
}

export { emptyPresence };
