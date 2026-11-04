import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { teamMembers, teams } from "@/db/schema";
import { normalizeTeamInviteCode } from "@/lib/community/team-codes";
import { canChangeMemberRole, canManageTeamSettings, canRemoveMember } from "@/lib/community/team-permissions";
import { type AssignableTeamRole, type TeamPrivacy, type TeamRankingMetric } from "@/lib/community/team-types";
import { getActiveMembership, invalidatePublicTeamsCache } from "@/lib/community/teams-queries";
import { BANNER_COLORS, asPrivacy, refreshMemberCount, uniqueInviteCode } from "@/lib/community/teams-shared";
import type { CreateTeamInput } from "@/lib/community/teams-types";

export type { CreateTeamInput, TeamDetailView, TeamInviteView, TeamListItem, TeamLiveGroupSession, TeamLiveMember, TeamMemberView, TeamRankingRow } from "@/lib/community/teams-types";
export { getActiveMembership, listMyTeams, listPendingInvitesForUser, searchPublicTeams } from "@/lib/community/teams-queries";
export { getTeamDetail } from "@/lib/community/teams-detail";
export { acceptInvitation, createEmailInvitation, declineInvitation, revokeInvitation } from "@/lib/community/teams-invites";

export async function createTeam(ownerUserId: string, input: CreateTeamInput) {
  await ensureCriticalSchema();
  const db = getDb();
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) {
    return { ok: false as const, error: "Nazwa grupy musi mieć 2–60 znaków." };
  }
  const description = (input.description ?? "").trim().slice(0, 500);
  const avatarEmoji = (input.avatarEmoji?.trim() || "🏋️").slice(0, 8);
  const rankingMetric = input.rankingMetric ?? "fcs";
  const inviteCode = await uniqueInviteCode();
  const bannerColor =
    BANNER_COLORS[Math.floor(Math.random() * BANNER_COLORS.length)]!;
  const teamId = crypto.randomUUID();
  const now = new Date();

  await db.insert(teams).values({
    id: teamId,
    ownerUserId,
    name,
    description,
    privacy: input.privacy,
    inviteCode,
    avatarEmoji,
    bannerColor,
    rankingMetric,
    maxMembers: 50,
    memberCount: 1,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(teamMembers).values({
    id: crypto.randomUUID(),
    teamId,
    userId: ownerUserId,
    role: "owner",
    status: "active",
    joinedAt: now,
  });

  invalidatePublicTeamsCache();

  const { track } = await import("@/lib/analytics/track-server");
  track.teamCreated(ownerUserId, {
    team_id: teamId,
    privacy: input.privacy,
    ranking_metric: rankingMetric,
    member_count: 1,
  });

  return { ok: true as const, teamId, inviteCode };
}

export async function joinTeamByCode(
  userId: string,
  rawCode: string,
  opts?: { joinMethod?: "code" | "public" | "invite" },
) {
  await ensureCriticalSchema();
  const code = normalizeTeamInviteCode(rawCode);
  if (code.length < 4) {
    return { ok: false as const, error: "Podaj poprawny kod zaproszenia." };
  }
  const db = getDb();
  const [team] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.inviteCode, code), isNull(teams.archivedAt)))
    .limit(1);
  if (!team) {
    return { ok: false as const, error: "Nie znaleziono grupy z tym kodem." };
  }

  const existing = await getActiveMembership(team.id, userId);
  if (existing) {
    return { ok: true as const, teamId: team.id, alreadyMember: true };
  }

  const [banned] = await db
    .select({ id: teamMembers.id, status: teamMembers.status })
    .from(teamMembers)
    .where(
      and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, userId)),
    )
    .limit(1);
  if (banned?.status === "banned") {
    return { ok: false as const, error: "Nie możesz dołączyć do tej grupy." };
  }

  if (team.memberCount >= team.maxMembers) {
    return { ok: false as const, error: "Grupa osiągnęła limit członków." };
  }

  const now = new Date();
  if (banned) {
    await db
      .update(teamMembers)
      .set({
        status: "active",
        role: "member",
        joinedAt: now,
        leftAt: null,
      })
      .where(eq(teamMembers.id, banned.id));
  } else {
    await db.insert(teamMembers).values({
      id: crypto.randomUUID(),
      teamId: team.id,
      userId,
      role: "member",
      status: "active",
      joinedAt: now,
    });
  }

  // Z72: limit członków sprawdzany też po zapisie (równoległe dołączenia).
  const joinedCount = await refreshMemberCount(team.id);
  if (joinedCount > team.maxMembers) {
    await db
      .update(teamMembers)
      .set({ status: "left", leftAt: new Date() })
      .where(
        and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, userId)),
      );
    await refreshMemberCount(team.id);
    invalidatePublicTeamsCache();
    return { ok: false as const, error: "Grupa osiągnęła limit członków." };
  }
  invalidatePublicTeamsCache();

  const { track } = await import("@/lib/analytics/track-server");
  track.teamJoined(userId, {
    team_id: team.id,
    join_method: opts?.joinMethod ?? "code",
    already_member: false,
    privacy: asPrivacy(team.privacy),
  });

  return { ok: true as const, teamId: team.id, alreadyMember: false };
}

export async function joinPublicTeam(userId: string, teamId: string) {
  await ensureCriticalSchema();
  const db = getDb();
  const [team] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), isNull(teams.archivedAt)))
    .limit(1);
  if (!team) {
    return { ok: false as const, error: "Grupa nie istnieje." };
  }
  if (asPrivacy(team.privacy) !== "public") {
    return {
      ok: false as const,
      error: "To prywatna grupa — użyj kodu lub zaproszenia.",
    };
  }
  return joinTeamByCode(userId, team.inviteCode, { joinMethod: "public" });
}

export async function leaveTeam(userId: string, teamId: string) {
  await ensureCriticalSchema();
  const membership = await getActiveMembership(teamId, userId);
  if (!membership) {
    return { ok: false as const, error: "Nie jesteś członkiem tej grupy." };
  }
  if (membership.role === "owner") {
    return {
      ok: false as const,
      error: "Owner musi najpierw przekazać własność albo zarchiwizować grupę.",
    };
  }
  const db = getDb();
  await db
    .update(teamMembers)
    .set({ status: "left", leftAt: new Date() })
    .where(eq(teamMembers.id, membership.id));
  await refreshMemberCount(teamId);
  invalidatePublicTeamsCache();
  return { ok: true as const };
}

export async function updateTeamSettings(
  actorUserId: string,
  teamId: string,
  input: {
    name?: string;
    description?: string;
    privacy?: TeamPrivacy;
    avatarEmoji?: string;
    bannerColor?: string;
    rankingMetric?: TeamRankingMetric;
  },
) {
  const membership = await getActiveMembership(teamId, actorUserId);
  if (!canManageTeamSettings(membership?.role ?? null)) {
    return { ok: false as const, error: "Brak uprawnień do edycji grupy." };
  }
  const db = getDb();
  const patch: Partial<typeof teams.$inferInsert> = { updatedAt: new Date() };
  if (input.name != null) {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 60) {
      return { ok: false as const, error: "Nazwa grupy musi mieć 2–60 znaków." };
    }
    patch.name = name;
  }
  if (input.description != null) {
    patch.description = input.description.trim().slice(0, 500);
  }
  if (input.privacy) patch.privacy = input.privacy;
  if (input.avatarEmoji != null) {
    patch.avatarEmoji = input.avatarEmoji.trim().slice(0, 8) || "🏋️";
  }
  if (input.bannerColor != null) {
    const color = input.bannerColor.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) patch.bannerColor = color;
  }
  if (input.rankingMetric) patch.rankingMetric = input.rankingMetric;

  await db.update(teams).set(patch).where(eq(teams.id, teamId));
  invalidatePublicTeamsCache();
  return { ok: true as const };
}

export async function regenerateInviteCode(actorUserId: string, teamId: string) {
  const membership = await getActiveMembership(teamId, actorUserId);
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return { ok: false as const, error: "Brak uprawnień do zmiany kodu." };
  }
  const db = getDb();
  const inviteCode = await uniqueInviteCode();
  await db
    .update(teams)
    .set({ inviteCode, updatedAt: new Date() })
    .where(eq(teams.id, teamId));
  return { ok: true as const, inviteCode };
}

export async function changeMemberRole(
  actorUserId: string,
  teamId: string,
  targetUserId: string,
  nextRole: AssignableTeamRole,
) {
  const actor = await getActiveMembership(teamId, actorUserId);
  const target = await getActiveMembership(teamId, targetUserId);
  if (!actor || !target) {
    return { ok: false as const, error: "Nie znaleziono członka grupy." };
  }
  if (!canChangeMemberRole(actor.role, target.role, nextRole)) {
    return { ok: false as const, error: "Nie możesz zmienić tej roli." };
  }
  const db = getDb();
  await db
    .update(teamMembers)
    .set({ role: nextRole })
    .where(eq(teamMembers.id, target.id));
  return { ok: true as const };
}

export async function removeMember(
  actorUserId: string,
  teamId: string,
  targetUserId: string,
) {
  const actor = await getActiveMembership(teamId, actorUserId);
  const target = await getActiveMembership(teamId, targetUserId);
  if (!actor || !target) {
    return { ok: false as const, error: "Nie znaleziono członka grupy." };
  }
  if (!canRemoveMember(actor.role, target.role, actorUserId, targetUserId)) {
    return { ok: false as const, error: "Nie możesz usunąć tej osoby." };
  }
  const db = getDb();
  await db
    .update(teamMembers)
    .set({ status: "left", leftAt: new Date() })
    .where(eq(teamMembers.id, target.id));
  await refreshMemberCount(teamId);
  return { ok: true as const };
}

export async function transferOwnership(
  actorUserId: string,
  teamId: string,
  newOwnerUserId: string,
) {
  const actor = await getActiveMembership(teamId, actorUserId);
  const target = await getActiveMembership(teamId, newOwnerUserId);
  if (!actor || actor.role !== "owner") {
    return { ok: false as const, error: "Tylko Owner może przekazać własność." };
  }
  if (!target) {
    return { ok: false as const, error: "Nowy owner musi być członkiem grupy." };
  }
  if (actorUserId === newOwnerUserId) {
    return { ok: true as const };
  }
  const db = getDb();
  await db
    .update(teamMembers)
    .set({ role: "admin" })
    .where(eq(teamMembers.id, actor.id));
  await db
    .update(teamMembers)
    .set({ role: "owner" })
    .where(eq(teamMembers.id, target.id));
  await db
    .update(teams)
    .set({ ownerUserId: newOwnerUserId, updatedAt: new Date() })
    .where(eq(teams.id, teamId));
  return { ok: true as const };
}

export async function archiveTeam(actorUserId: string, teamId: string) {
  const actor = await getActiveMembership(teamId, actorUserId);
  if (!actor || actor.role !== "owner") {
    return { ok: false as const, error: "Tylko Owner może zarchiwizować grupę." };
  }
  const db = getDb();
  await db
    .update(teams)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(teams.id, teamId));
  invalidatePublicTeamsCache();
  return { ok: true as const };
}
