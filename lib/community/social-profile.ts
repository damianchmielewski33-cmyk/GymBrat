import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { userSocialProfiles, users } from "@/db/schema";
import { getFriendshipRelation } from "@/lib/community/friendships";

export type ProfileVisibility = "private" | "friends" | "public";

export type SocialProfile = {
  userId: string;
  visibility: ProfileVisibility;
  bio: string | null;
  showStats: boolean;
  showOnGlobal: boolean;
  discoverable: boolean;
};

export async function ensureSocialProfile(
  userId: string,
): Promise<SocialProfile> {
  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .select()
    .from(userSocialProfiles)
    .where(eq(userSocialProfiles.userId, userId))
    .limit(1);
  if (row) {
    return {
      userId,
      visibility: row.visibility as ProfileVisibility,
      bio: row.bio,
      showStats: row.showStats === 1,
      showOnGlobal: row.showOnGlobal === 1,
      discoverable: row.discoverable === 1,
    };
  }
  await db.insert(userSocialProfiles).values({
    userId,
    // Privacy-by-default (prawo 012 / LR-T2) — nowe konta i fallback bez wiersza.
    visibility: "private",
    showStats: 0,
    showOnGlobal: 0,
    discoverable: 0,
  });
  return {
    userId,
    visibility: "private",
    bio: null,
    showStats: false,
    showOnGlobal: false,
    discoverable: false,
  };
}

export async function updateSocialProfile(
  userId: string,
  patch: Partial<{
    visibility: ProfileVisibility;
    bio: string | null;
    showStats: boolean;
    showOnGlobal: boolean;
    discoverable: boolean;
  }>,
): Promise<SocialProfile> {
  await ensureSocialProfile(userId);
  const db = getDb();
  await db
    .update(userSocialProfiles)
    .set({
      ...(patch.visibility ? { visibility: patch.visibility } : {}),
      ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
      ...(patch.showStats !== undefined
        ? { showStats: patch.showStats ? 1 : 0 }
        : {}),
      ...(patch.showOnGlobal !== undefined
        ? { showOnGlobal: patch.showOnGlobal ? 1 : 0 }
        : {}),
      ...(patch.discoverable !== undefined
        ? { discoverable: patch.discoverable ? 1 : 0 }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(userSocialProfiles.userId, userId));
  return ensureSocialProfile(userId);
}

export type ProfileAccess = "full" | "teaser" | "none";

export async function canViewProfile(
  viewerId: string | null,
  subjectId: string,
): Promise<ProfileAccess> {
  if (viewerId === subjectId) return "full";
  const profile = await ensureSocialProfile(subjectId);
  if (profile.visibility === "public") return "full";
  if (!viewerId) return "teaser";
  if (profile.visibility === "private") return "teaser";
  // friends
  const rel = await getFriendshipRelation(viewerId, subjectId);
  return rel === "accepted" ? "full" : "teaser";
}

export async function getPublicUserCard(userId: string) {
  const db = getDb();
  const [u] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) return null;
  const profile = await ensureSocialProfile(userId);
  return {
    userId: u.id,
    displayName: u.name?.trim() || u.email?.split("@")[0] || "Athlete",
    bio: profile.bio,
    visibility: profile.visibility,
    showStats: profile.showStats,
  };
}
