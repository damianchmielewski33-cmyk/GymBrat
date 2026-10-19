import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { userFollows, users } from "@/db/schema";

export async function followUser(
  followerId: string,
  followingId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (followerId === followingId) {
    return { ok: false, error: "Nie możesz obserwować siebie." };
  }
  await ensureCriticalSchema();
  const db = getDb();
  try {
    await db.insert(userFollows).values({ followerId, followingId });
  } catch {
    return { ok: true }; // already following
  }
  return { ok: true };
}

export async function unfollowUser(
  followerId: string,
  followingId: string,
): Promise<void> {
  await ensureCriticalSchema();
  const db = getDb();
  await db
    .delete(userFollows)
    .where(
      and(
        eq(userFollows.followerId, followerId),
        eq(userFollows.followingId, followingId),
      ),
    );
}

export async function isFollowing(
  followerId: string,
  followingId: string,
): Promise<boolean> {
  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .select({ id: userFollows.id })
    .from(userFollows)
    .where(
      and(
        eq(userFollows.followerId, followerId),
        eq(userFollows.followingId, followingId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function getFollowCounts(userId: string): Promise<{
  followers: number;
  following: number;
}> {
  await ensureCriticalSchema();
  const db = getDb();
  const [followers] = await db
    .select({ n: sql<number>`count(*)` })
    .from(userFollows)
    .where(eq(userFollows.followingId, userId));
  const [following] = await db
    .select({ n: sql<number>`count(*)` })
    .from(userFollows)
    .where(eq(userFollows.followerId, userId));
  return {
    followers: Number(followers?.n ?? 0),
    following: Number(following?.n ?? 0),
  };
}

export async function listFollowingIds(userId: string): Promise<string[]> {
  await ensureCriticalSchema();
  const db = getDb();
  const rows = await db
    .select({ id: userFollows.followingId })
    .from(userFollows)
    .where(eq(userFollows.followerId, userId));
  return rows.map((r) => r.id);
}

export async function listFollowers(
  userId: string,
  limit = 40,
): Promise<Array<{ userId: string; displayName: string }>> {
  await ensureCriticalSchema();
  const db = getDb();
  const rows = await db
    .select({
      userId: userFollows.followerId,
      name: users.name,
      email: users.email,
    })
    .from(userFollows)
    .innerJoin(users, eq(userFollows.followerId, users.id))
    .where(eq(userFollows.followingId, userId))
    .limit(limit);
  return rows.map((r) => ({
    userId: r.userId,
    displayName: r.name?.trim() || r.email?.split("@")[0] || "Athlete",
  }));
}
