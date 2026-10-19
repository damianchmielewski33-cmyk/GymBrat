import { and, eq, like, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { teams, userSocialProfiles, users } from "@/db/schema";

export async function searchDiscoverableUsers(
  query: string,
  viewerId: string,
  limit = 20,
): Promise<Array<{ userId: string; displayName: string; bio: string | null }>> {
  await ensureCriticalSchema();
  const q = query.trim();
  if (q.length < 2) return [];
  const db = getDb();
  const pattern = `%${q}%`;
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      bio: userSocialProfiles.bio,
    })
    .from(users)
    .innerJoin(
      userSocialProfiles,
      eq(userSocialProfiles.userId, users.id),
    )
    .where(
      and(
        eq(userSocialProfiles.discoverable, 1),
        ne(users.id, viewerId),
        or(like(users.name, pattern), like(users.email, pattern)),
      ),
    )
    .limit(limit);

  return rows.map((r) => ({
    userId: r.userId,
    displayName: r.name?.trim() || r.email?.split("@")[0] || "Athlete",
    bio: r.bio,
  }));
}

export async function listPublicTeams(limit = 20) {
  await ensureCriticalSchema();
  const db = getDb();
  return db
    .select({
      id: teams.id,
      name: teams.name,
      description: teams.description,
      memberCount: teams.memberCount,
    })
    .from(teams)
    .where(eq(teams.privacy, "public"))
    .orderBy(sql`${teams.memberCount} desc`)
    .limit(limit);
}
