import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { activeWorkoutSessions, teamInvitations, teamMembers, teams, users, workouts } from "@/db/schema";
import { canInviteMembers, canManageTeamSettings, canViewPrivateTeam } from "@/lib/community/team-permissions";
import { isAssignableTeamRole, isTeamRole, type TeamRankingMetric, type TeamRole } from "@/lib/community/team-types";
import { getActiveMembership } from "@/lib/community/teams-queries";
import { asMetric, asPrivacy, displayNameFromUser, weekStartDate } from "@/lib/community/teams-shared";
import type { TeamDetailView, TeamInviteView, TeamLiveMember, TeamMemberView, TeamRankingRow } from "@/lib/community/teams-types";

async function computeTeamRanking(
  teamId: string,
  metric: TeamRankingMetric,
): Promise<TeamRankingRow[]> {
  if (metric === "fcs") {
    const { computeTeamFcsRanking } = await import("@/lib/community/fcs-compute");
    const rows = await computeTeamFcsRanking(teamId);
    return rows.map((r) => ({
      userId: r.userId,
      displayName: r.displayName,
      score: r.score,
      rank: r.rank,
      metric: "fcs" as const,
      components: r.components,
      newcomerBoost: r.newcomerBoost,
    }));
  }

  const db = getDb();
  const members = await db
    .select({
      userId: teamMembers.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      email: users.email,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.status, "active")),
    );

  if (members.length === 0) return [];

  const userIds = members.map((m) => m.userId);
  const since = weekStartDate();

  const workoutRows = await db
    .select({
      userId: workouts.userId,
      date: workouts.date,
      cardioMinutes: workouts.cardioMinutes,
      exercises: workouts.exercises,
    })
    .from(workouts)
    .where(and(inArray(workouts.userId, userIds), gte(workouts.date, since)));

  const scoreByUser = new Map<string, number>();
  for (const id of userIds) scoreByUser.set(id, 0);

  for (const w of workoutRows) {
    const current = scoreByUser.get(w.userId) ?? 0;
    if (metric === "sessions") {
      scoreByUser.set(w.userId, current + 1);
      continue;
    }
    if (metric === "cardio") {
      scoreByUser.set(w.userId, current + (w.cardioMinutes || 0));
      continue;
    }
    let tonnage = 0;
    try {
      const parsed = JSON.parse(w.exercises) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const obj = parsed as { kind?: string; exercises?: unknown[] };
        if (obj.kind === "cardio_log") continue;
      }
      const list = Array.isArray(parsed)
        ? parsed
        : parsed &&
            typeof parsed === "object" &&
            Array.isArray((parsed as { exercises?: unknown[] }).exercises)
          ? ((parsed as { exercises: unknown[] }).exercises)
          : [];
      for (const ex of list) {
        if (!ex || typeof ex !== "object") continue;
        const sets = (ex as { sets?: unknown[] }).sets;
        if (!Array.isArray(sets)) continue;
        for (const set of sets) {
          if (!set || typeof set !== "object") continue;
          const s = set as {
            completed?: boolean;
            skipped?: boolean;
            weight?: number;
            reps?: number;
          };
          if (s.skipped || s.completed === false) continue;
          const weight = Number(s.weight) || 0;
          const reps = Number(s.reps) || 0;
          if (weight > 0 && reps > 0) tonnage += weight * reps;
        }
      }
    } catch {
      /* ignore broken JSON */
    }
    scoreByUser.set(w.userId, current + tonnage);
  }

  const nameByUser = new Map(
    members.map((m) => [m.userId, displayNameFromUser(m)]),
  );

  return [...scoreByUser.entries()]
    .map(([userId, score]) => ({
      userId,
      displayName: nameByUser.get(userId) ?? "Zawodnik",
      score: Math.round(score * 10) / 10,
      rank: 0,
      metric,
    }))
    .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

async function listLiveNow(teamId: string): Promise<TeamLiveMember[]> {
  const db = getDb();
  const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24);
  // Jedno zapytanie (join) zamiast members → sessions (2× RTT Turso).
  const rows = await db
    .select({
      userId: activeWorkoutSessions.userId,
      updatedAt: activeWorkoutSessions.updatedAt,
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      email: users.email,
    })
    .from(activeWorkoutSessions)
    .innerJoin(
      teamMembers,
      and(
        eq(teamMembers.userId, activeWorkoutSessions.userId),
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.status, "active"),
      ),
    )
    .innerJoin(users, eq(users.id, activeWorkoutSessions.userId))
    .where(gte(activeWorkoutSessions.updatedAt, cutoff));

  return rows.map((r) => ({
    userId: r.userId,
    displayName: displayNameFromUser(r),
    updatedAt: r.updatedAt,
  }));
}

function buildAchievementSummaries(
  ranking: TeamRankingRow[],
  memberCount: number,
  liveCount: number,
): Array<{ id: string; title: string; detail: string }> {
  const items: Array<{ id: string; title: string; detail: string }> = [];
  if (memberCount >= 5) {
    items.push({
      id: "crew-5",
      title: "Skład 5+",
      detail: `${memberCount} aktywnych członków`,
    });
  }
  const top = ranking[0];
  if (top && top.score > 0) {
    items.push({
      id: "week-leader",
      title: "Lider tygodnia",
      detail: `${top.displayName} · ${top.score}`,
    });
  }
  if (liveCount > 0) {
    items.push({
      id: "live-now",
      title: "Na żywo na siłowni",
      detail: `${liveCount} trenuje teraz`,
    });
  }
  const activeScorers = ranking.filter((r) => r.score > 0).length;
  if (activeScorers >= 3) {
    items.push({
      id: "active-week",
      title: "Aktywny tydzień",
      detail: `${activeScorers} osób z wynikiem w tym tygodniu`,
    });
  }
  return items;
}

export async function getTeamDetail(
  teamId: string,
  viewerId: string,
): Promise<TeamDetailView | null> {
  await ensureCriticalSchema();
  const db = getDb();

  // Team + membership równolegle — jedna runda sieci zamiast waterfalla.
  const [[team], membership] = await Promise.all([
    db
      .select()
      .from(teams)
      .where(and(eq(teams.id, teamId), isNull(teams.archivedAt)))
      .limit(1),
    getActiveMembership(teamId, viewerId),
  ]);
  if (!team) return null;

  const privacy = asPrivacy(team.privacy);
  if (!canViewPrivateTeam(privacy, membership?.role ?? null)) {
    return null;
  }

  const myRole = membership?.role ?? null;
  const canManage = canManageTeamSettings(myRole);
  const canInvite = canInviteMembers(myRole);
  const rankingMetric = asMetric(team.rankingMetric);

  const membersQuery = db
    .select({
      membershipId: teamMembers.id,
      userId: teamMembers.userId,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      email: users.email,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.status, "active")),
    )
    .orderBy(desc(teamMembers.joinedAt));

  const invitesQuery = canInvite
    ? db
        .select({
          id: teamInvitations.id,
          inviteeEmail: teamInvitations.inviteeEmail,
          inviteeUserId: teamInvitations.inviteeUserId,
          role: teamInvitations.role,
          status: teamInvitations.status,
          createdAt: teamInvitations.createdAt,
          expiresAt: teamInvitations.expiresAt,
          token: teamInvitations.token,
          firstName: users.firstName,
          lastName: users.lastName,
          name: users.name,
          email: users.email,
        })
        .from(teamInvitations)
        .leftJoin(users, eq(users.id, teamInvitations.inviteeUserId))
        .where(
          and(
            eq(teamInvitations.teamId, teamId),
            eq(teamInvitations.status, "pending"),
          ),
        )
        .orderBy(desc(teamInvitations.createdAt))
    : Promise.resolve([]);

  const { listLiveGroupSessionsForTeam } = await import(
    "@/lib/community/group-workout"
  );

  // Ranking / live / feed-sesje / zaproszenia w jednej rundzie (Turso: mniej RTT).
  const [memberRows, inviteRows, ranking, liveNow, liveGroupSessions] =
    await Promise.all([
      membersQuery,
      invitesQuery,
      computeTeamRanking(teamId, rankingMetric),
      listLiveNow(teamId),
      listLiveGroupSessionsForTeam(teamId),
    ]);

  const { getReputationMap } = await import("@/lib/community/reputation");
  const repMap = await getReputationMap(memberRows.map((r) => r.userId));

  const members: TeamMemberView[] = memberRows
    .filter((row) => isTeamRole(row.role))
    .map((row) => ({
      membershipId: row.membershipId,
      userId: row.userId,
      role: row.role as TeamRole,
      displayName: displayNameFromUser(row),
      joinedAt: row.joinedAt,
      reputation: repMap.get(row.userId),
    }))
    .sort(
      (a, b) =>
        (b.role === "owner" ? 1 : 0) - (a.role === "owner" ? 1 : 0) ||
        (b.reputation?.points ?? 0) - (a.reputation?.points ?? 0) ||
        a.displayName.localeCompare(b.displayName),
    );

  const now = Date.now();
  const pendingInvites: TeamInviteView[] = (
    inviteRows as Array<{
      id: string;
      inviteeEmail: string | null;
      inviteeUserId: string | null;
      role: string;
      status: string;
      createdAt: Date;
      expiresAt: Date;
      token: string;
      firstName: string | null;
      lastName: string | null;
      name: string | null;
      email: string | null;
    }>
  )
    .filter((row) => row.expiresAt.getTime() > now)
    .map((row) => ({
      id: row.id,
      inviteeEmail: row.inviteeEmail,
      inviteeUserId: row.inviteeUserId,
      inviteeName: row.email
        ? displayNameFromUser({
            firstName: row.firstName,
            lastName: row.lastName,
            name: row.name,
            email: row.email,
          })
        : null,
      role: isAssignableTeamRole(row.role) ? row.role : "member",
      status: row.status,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      token: row.token,
    }));

  const achievementSummaries = buildAchievementSummaries(
    ranking,
    team.memberCount,
    liveNow.length,
  );

  return {
    id: team.id,
    name: team.name,
    description: team.description,
    privacy,
    avatarEmoji: team.avatarEmoji,
    bannerColor: team.bannerColor,
    inviteCode: canInvite ? team.inviteCode : null,
    rankingMetric,
    maxMembers: team.maxMembers,
    memberCount: team.memberCount,
    createdAt: team.createdAt,
    myRole,
    isMember: myRole != null,
    canManage,
    canInvite,
    members,
    pendingInvites,
    ranking,
    liveNow,
    liveGroupSessions,
    achievementSummaries,
  };
}
