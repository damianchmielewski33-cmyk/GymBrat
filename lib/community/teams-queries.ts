import { and, desc, eq, gte, isNull, like, or } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { teamInvitations, teamMembers, teams } from "@/db/schema";
import { cacheGet, cacheInvalidate, cacheSet } from "@/lib/community/perf-cache";
import { isAssignableTeamRole, isTeamRole, type TeamRole } from "@/lib/community/team-types";
import { asPrivacy } from "@/lib/community/teams-shared";
import type { PublicTeamRow, TeamListItem } from "@/lib/community/teams-types";

export async function getActiveMembership(
  teamId: string,
  userId: string,
): Promise<{ id: string; role: TeamRole } | null> {
  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .select({
      id: teamMembers.id,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, userId),
        eq(teamMembers.status, "active"),
      ),
    )
    .limit(1);
  if (!row || !isTeamRole(row.role)) return null;
  return { id: row.id, role: row.role };
}

export async function listMyTeams(userId: string): Promise<TeamListItem[]> {
  await ensureCriticalSchema();
  const db = getDb();
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      description: teams.description,
      privacy: teams.privacy,
      avatarEmoji: teams.avatarEmoji,
      bannerColor: teams.bannerColor,
      memberCount: teams.memberCount,
      maxMembers: teams.maxMembers,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(
      and(
        eq(teamMembers.userId, userId),
        eq(teamMembers.status, "active"),
        isNull(teams.archivedAt),
      ),
    )
    .orderBy(desc(teamMembers.joinedAt));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    privacy: asPrivacy(row.privacy),
    avatarEmoji: row.avatarEmoji,
    bannerColor: row.bannerColor,
    memberCount: row.memberCount,
    maxMembers: row.maxMembers,
    myRole: isTeamRole(row.role) ? row.role : "member",
    isMember: true,
  }));
}

const PUBLIC_TEAMS_CACHE_TTL_MS = 30_000;

const PUBLIC_TEAMS_CACHE_PREFIX = "teams:public:";

export function invalidatePublicTeamsCache() {
  cacheInvalidate(PUBLIC_TEAMS_CACHE_PREFIX);
}

async function loadPublicTeamRows(
  query: string,
  limit: number,
): Promise<PublicTeamRow[]> {
  const q = query.trim();
  const cacheKey = q
    ? `teams:public:q:${q.toLowerCase()}:${limit}`
    : `teams:public:all:${limit}`;
  const cached = cacheGet<PublicTeamRow[]>(cacheKey);
  if (cached) return cached;

  const db = getDb();
  const pattern = q ? `%${q.replace(/[%_]/g, "")}%` : null;
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      description: teams.description,
      privacy: teams.privacy,
      avatarEmoji: teams.avatarEmoji,
      bannerColor: teams.bannerColor,
      memberCount: teams.memberCount,
      maxMembers: teams.maxMembers,
    })
    .from(teams)
    .where(
      and(
        eq(teams.privacy, "public"),
        isNull(teams.archivedAt),
        pattern
          ? or(like(teams.name, pattern), like(teams.description, pattern))
          : undefined,
      ),
    )
    .orderBy(desc(teams.memberCount), desc(teams.createdAt))
    .limit(limit);

  cacheSet(cacheKey, rows, PUBLIC_TEAMS_CACHE_TTL_MS);
  return rows;
}

export async function searchPublicTeams(
  query: string,
  viewerId: string,
  limit = 30,
  opts?: {
    /** Gdy masz już listMyTeams — bez drugiego SELECT membership. */
    membershipByTeamId?: Map<string, TeamRole>;
  },
): Promise<TeamListItem[]> {
  await ensureCriticalSchema();

  let roleByTeam = opts?.membershipByTeamId;
  if (!roleByTeam) {
    const db = getDb();
    const [membershipRows, rows] = await Promise.all([
      db
        .select({ teamId: teamMembers.teamId, role: teamMembers.role })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.userId, viewerId),
            eq(teamMembers.status, "active"),
          ),
        ),
      loadPublicTeamRows(query, limit),
    ]);
    roleByTeam = new Map(
      membershipRows.map((r) => [
        r.teamId,
        isTeamRole(r.role) ? r.role : ("member" as TeamRole),
      ]),
    );
    return rows.map((row) => {
      const myRole = roleByTeam!.get(row.id) ?? null;
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        privacy: "public" as const,
        avatarEmoji: row.avatarEmoji,
        bannerColor: row.bannerColor,
        memberCount: row.memberCount,
        maxMembers: row.maxMembers,
        myRole,
        isMember: myRole != null,
      };
    });
  }

  const rows = await loadPublicTeamRows(query, limit);
  return rows.map((row) => {
    const myRole = roleByTeam!.get(row.id) ?? null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      privacy: "public" as const,
      avatarEmoji: row.avatarEmoji,
      bannerColor: row.bannerColor,
      memberCount: row.memberCount,
      maxMembers: row.maxMembers,
      myRole,
      isMember: myRole != null,
    };
  });
}

export async function listPendingInvitesForUser(userId: string, email: string) {
  await ensureCriticalSchema();
  const db = getDb();
  const now = new Date();
  const normalizedEmail = email.trim().toLowerCase();

  const rows = await db
    .select({
      id: teamInvitations.id,
      token: teamInvitations.token,
      role: teamInvitations.role,
      expiresAt: teamInvitations.expiresAt,
      teamId: teams.id,
      teamName: teams.name,
      avatarEmoji: teams.avatarEmoji,
      privacy: teams.privacy,
      memberCount: teams.memberCount,
    })
    .from(teamInvitations)
    .innerJoin(teams, eq(teams.id, teamInvitations.teamId))
    .where(
      and(
        eq(teamInvitations.status, "pending"),
        isNull(teams.archivedAt),
        gte(teamInvitations.expiresAt, now),
        or(
          eq(teamInvitations.inviteeUserId, userId),
          eq(teamInvitations.inviteeEmail, normalizedEmail),
        ),
      ),
    )
    .orderBy(desc(teamInvitations.createdAt));

  return rows.map((row) => ({
    id: row.id,
    token: row.token,
    role: isAssignableTeamRole(row.role) ? row.role : ("member" as const),
    expiresAt: row.expiresAt,
    team: {
      id: row.teamId,
      name: row.teamName,
      avatarEmoji: row.avatarEmoji,
      privacy: asPrivacy(row.privacy),
      memberCount: row.memberCount,
    },
  }));
}
