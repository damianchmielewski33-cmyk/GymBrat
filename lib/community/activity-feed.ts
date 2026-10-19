import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { userActivityPosts, users } from "@/db/schema";
import { listFriendsAndPending } from "@/lib/community/friendships";
import {
  ensureSocialProfile,
  type ProfileVisibility,
} from "@/lib/community/social-profile";

export type ActivityKind =
  | "workout"
  | "pr"
  | "achievement"
  | "challenge"
  | "quest"
  | "war"
  | "hof"
  | "level_up"
  | "prestige"
  | "text";

export type ActivityPostView = {
  id: string;
  userId: string;
  displayName: string;
  kind: string;
  title: string;
  body: string | null;
  createdAt: Date;
};

export async function emitActivity(input: {
  userId: string;
  kind: ActivityKind;
  title: string;
  body?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  await ensureCriticalSchema();
  const profile = await ensureSocialProfile(input.userId);
  if (profile.visibility === "private") return;

  const db = getDb();
  await db.insert(userActivityPosts).values({
    userId: input.userId,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    metaJson: JSON.stringify(input.meta ?? {}),
    visibilitySnapshot: profile.visibility,
  });
}

async function hydrate(
  rows: Array<typeof userActivityPosts.$inferSelect>,
): Promise<ActivityPostView[]> {
  if (rows.length === 0) return [];
  const db = getDb();
  const ids = [...new Set(rows.map((r) => r.userId))];
  const people = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(inArray(users.id, ids));
  const names = new Map(
    people.map((p) => [
      p.id,
      p.name?.trim() || p.email?.split("@")[0] || "Athlete",
    ]),
  );
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    displayName: names.get(r.userId) ?? "Athlete",
    kind: r.kind,
    title: r.title,
    body: r.body,
    createdAt: r.createdAt,
  }));
}

export async function getFriendsFeed(
  userId: string,
  limit = 40,
): Promise<ActivityPostView[]> {
  await ensureCriticalSchema();
  const { friends } = await listFriendsAndPending(userId);
  const friendIds = friends.map((f) => f.userId);
  if (friendIds.length === 0) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(userActivityPosts)
    .where(inArray(userActivityPosts.userId, friendIds))
    .orderBy(desc(userActivityPosts.createdAt))
    .limit(limit);
  return hydrate(rows);
}

export async function getGlobalFeed(limit = 40): Promise<ActivityPostView[]> {
  await ensureCriticalSchema();
  const db = getDb();
  const rows = await db
    .select()
    .from(userActivityPosts)
    .where(eq(userActivityPosts.visibilitySnapshot, "public"))
    .orderBy(desc(userActivityPosts.createdAt))
    .limit(limit);
  return hydrate(rows);
}

export async function getUserProfileFeed(
  subjectId: string,
  access: "full" | "teaser" | "none",
  limit = 30,
): Promise<ActivityPostView[]> {
  if (access === "none" || access === "teaser") return [];
  await ensureCriticalSchema();
  const db = getDb();
  const rows = await db
    .select()
    .from(userActivityPosts)
    .where(eq(userActivityPosts.userId, subjectId))
    .orderBy(desc(userActivityPosts.createdAt))
    .limit(limit);
  return hydrate(rows);
}

export type { ProfileVisibility };
