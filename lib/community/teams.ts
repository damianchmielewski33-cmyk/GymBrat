import { and, desc, eq, gte, inArray, isNull, like, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import {
  activeWorkoutSessions,
  teamInvitations,
  teamMembers,
  teams,
  users,
  workouts,
} from "@/db/schema";
import {
  generateInviteToken,
  generateTeamInviteCode,
  normalizeTeamInviteCode,
} from "@/lib/community/team-codes";
import {
  cacheGet,
  cacheInvalidate,
  cacheSet,
} from "@/lib/community/perf-cache";
import {
  canChangeMemberRole,
  canInviteMembers,
  canManageTeamSettings,
  canRemoveMember,
  canViewPrivateTeam,
} from "@/lib/community/team-permissions";
import {
  isAssignableTeamRole,
  isTeamRole,
  type AssignableTeamRole,
  type TeamPrivacy,
  type TeamRankingMetric,
  type TeamRole,
} from "@/lib/community/team-types";
import { localDateKey } from "@/lib/local-date";

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const BANNER_COLORS = [
  "#1a1a1c",
  "#12181f",
  "#1c1612",
  "#141c18",
  "#1a1420",
] as const;

export type TeamListItem = {
  id: string;
  name: string;
  description: string;
  privacy: TeamPrivacy;
  avatarEmoji: string;
  bannerColor: string;
  memberCount: number;
  maxMembers: number;
  myRole: TeamRole | null;
  isMember: boolean;
};

export type TeamMemberView = {
  membershipId: string;
  userId: string;
  role: TeamRole;
  displayName: string;
  joinedAt: Date;
};

export type TeamInviteView = {
  id: string;
  inviteeEmail: string | null;
  inviteeUserId: string | null;
  inviteeName: string | null;
  role: AssignableTeamRole;
  status: string;
  createdAt: Date;
  expiresAt: Date;
  token: string;
};

export type TeamRankingRow = {
  userId: string;
  displayName: string;
  score: number;
  rank: number;
  metric: TeamRankingMetric;
};

export type TeamLiveMember = {
  userId: string;
  displayName: string;
  updatedAt: Date | null;
};

export type TeamLiveGroupSession = {
  id: string;
  title: string;
  hostUserId: string;
  createdAt: Date;
};

export type TeamDetailView = {
  id: string;
  name: string;
  description: string;
  privacy: TeamPrivacy;
  avatarEmoji: string;
  bannerColor: string;
  inviteCode: string | null;
  rankingMetric: TeamRankingMetric;
  maxMembers: number;
  memberCount: number;
  createdAt: Date;
  myRole: TeamRole | null;
  isMember: boolean;
  canManage: boolean;
  canInvite: boolean;
  members: TeamMemberView[];
  pendingInvites: TeamInviteView[];
  ranking: TeamRankingRow[];
  liveNow: TeamLiveMember[];
  liveGroupSessions: TeamLiveGroupSession[];
  achievementSummaries: Array<{ id: string; title: string; detail: string }>;
};

function displayNameFromUser(row: {
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string;
}): string {
  const full = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim();
  if (full) return full;
  if (row.name?.trim()) return row.name.trim();
  return row.email.split("@")[0] || "Zawodnik";
}

function asPrivacy(value: string): TeamPrivacy {
  return value === "public" ? "public" : "private";
}

function asMetric(value: string): TeamRankingMetric {
  if (value === "tonnage" || value === "cardio") return value;
  return "sessions";
}

async function uniqueInviteCode(): Promise<string> {
  const db = getDb();
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateTeamInviteCode();
    const [existing] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.inviteCode, code))
      .limit(1);
    if (!existing) return code;
  }
  return generateTeamInviteCode(10);
}

async function refreshMemberCount(teamId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(teamMembers)
    .where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.status, "active")),
    );
  const count = Number(row?.count ?? 0);
  await db
    .update(teams)
    .set({ memberCount: count, updatedAt: new Date() })
    .where(eq(teams.id, teamId));
  return count;
}

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

type PublicTeamRow = {
  id: string;
  name: string;
  description: string;
  privacy: string;
  avatarEmoji: string;
  bannerColor: string;
  memberCount: number;
  maxMembers: number;
};

const PUBLIC_TEAMS_CACHE_TTL_MS = 30_000;
const PUBLIC_TEAMS_CACHE_PREFIX = "teams:public:";

function invalidatePublicTeamsCache() {
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

function weekStartDate(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return localDateKey(d);
}

async function computeTeamRanking(
  teamId: string,
  metric: TeamRankingMetric,
): Promise<TeamRankingRow[]> {
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
  const memberIds = await db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.status, "active")),
    );
  if (memberIds.length === 0) return [];

  const ids = memberIds.map((m) => m.userId);
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
    .innerJoin(users, eq(users.id, activeWorkoutSessions.userId))
    .where(inArray(activeWorkoutSessions.userId, ids));

  const cutoff = Date.now() - 1000 * 60 * 60 * 24;
  return rows
    .filter((r) => (r.updatedAt?.getTime() ?? 0) >= cutoff)
    .map((r) => ({
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
  const [team] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), isNull(teams.archivedAt)))
    .limit(1);
  if (!team) return null;

  const membership = await getActiveMembership(teamId, viewerId);
  const privacy = asPrivacy(team.privacy);
  if (!canViewPrivateTeam(privacy, membership?.role ?? null)) {
    return null;
  }

  const memberRows = await db
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

  const members: TeamMemberView[] = memberRows
    .filter((row) => isTeamRole(row.role))
    .map((row) => ({
      membershipId: row.membershipId,
      userId: row.userId,
      role: row.role as TeamRole,
      displayName: displayNameFromUser(row),
      joinedAt: row.joinedAt,
    }))
    .sort(
      (a, b) =>
        (b.role === "owner" ? 1 : 0) - (a.role === "owner" ? 1 : 0) ||
        a.displayName.localeCompare(b.displayName),
    );

  const myRole = membership?.role ?? null;
  const canManage = canManageTeamSettings(myRole);
  const canInvite = canInviteMembers(myRole);

  let pendingInvites: TeamInviteView[] = [];
  if (canInvite) {
    const inviteRows = await db
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
      .orderBy(desc(teamInvitations.createdAt));

    const now = Date.now();
    pendingInvites = inviteRows
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
  }

  const rankingMetric = asMetric(team.rankingMetric);
  const ranking = await computeTeamRanking(teamId, rankingMetric);
  const liveNow = await listLiveNow(teamId);
  const { listLiveGroupSessionsForTeam } = await import(
    "@/lib/community/group-workout"
  );
  const liveGroupSessions = await listLiveGroupSessionsForTeam(teamId);
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

export type CreateTeamInput = {
  name: string;
  description?: string;
  privacy: TeamPrivacy;
  avatarEmoji?: string;
  rankingMetric?: TeamRankingMetric;
};

export async function createTeam(ownerUserId: string, input: CreateTeamInput) {
  await ensureCriticalSchema();
  const db = getDb();
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) {
    return { ok: false as const, error: "Nazwa grupy musi mieć 2–60 znaków." };
  }
  const description = (input.description ?? "").trim().slice(0, 500);
  const avatarEmoji = (input.avatarEmoji?.trim() || "🏋️").slice(0, 8);
  const rankingMetric = input.rankingMetric ?? "sessions";
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

  const { track } = await import("@/lib/analytics/track");
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

  await refreshMemberCount(team.id);
  invalidatePublicTeamsCache();

  const { track } = await import("@/lib/analytics/track");
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

export async function createEmailInvitation(
  actorUserId: string,
  teamId: string,
  rawEmail: string,
  role: AssignableTeamRole = "member",
) {
  const membership = await getActiveMembership(teamId, actorUserId);
  if (!canInviteMembers(membership?.role ?? null)) {
    return { ok: false as const, error: "Brak uprawnień do zapraszania." };
  }
  if (role === "admin" && membership?.role !== "owner") {
    return {
      ok: false as const,
      error: "Tylko Owner może zapraszać na rolę Admin.",
    };
  }

  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: "Podaj poprawny adres e-mail." };
  }

  const db = getDb();
  const [team] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), isNull(teams.archivedAt)))
    .limit(1);
  if (!team) return { ok: false as const, error: "Grupa nie istnieje." };
  if (team.memberCount >= team.maxMembers) {
    return { ok: false as const, error: "Grupa osiągnęła limit członków." };
  }

  const [invitee] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (invitee) {
    const existing = await getActiveMembership(teamId, invitee.id);
    if (existing) {
      return { ok: false as const, error: "Ta osoba jest już w grupie." };
    }
  }

  const [pending] = await db
    .select({ id: teamInvitations.id })
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.teamId, teamId),
        eq(teamInvitations.status, "pending"),
        invitee
          ? eq(teamInvitations.inviteeUserId, invitee.id)
          : eq(teamInvitations.inviteeEmail, email),
      ),
    )
    .limit(1);
  if (pending) {
    return { ok: false as const, error: "Zaproszenie już oczekuje na odpowiedź." };
  }

  const token = generateInviteToken();
  const now = new Date();
  const id = crypto.randomUUID();
  await db.insert(teamInvitations).values({
    id,
    teamId,
    invitedByUserId: actorUserId,
    inviteeUserId: invitee?.id ?? null,
    inviteeEmail: email,
    role,
    token,
    status: "pending",
    createdAt: now,
    expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
  });

  if (invitee?.id) {
    void (async () => {
      try {
        const { emitNotification } = await import(
          "@/lib/community/notifications"
        );
        const [actor] = await db
          .select({
            firstName: users.firstName,
            lastName: users.lastName,
            name: users.name,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, actorUserId))
          .limit(1);
        const actorName = actor ? displayNameFromUser(actor) : "Ktoś";
        await emitNotification({
          userId: invitee.id,
          kind: "invite",
          title: "Zaproszenie do grupy",
          body: `${actorName} zaprasza Cię do „${team.name}”.`,
          href: `/community/teams`,
          actorUserId: actorUserId,
          actorDisplayName: actorName,
          teamId,
          entityType: "invitation",
          entityId: id,
          groupKey: `invite:${id}`,
        });
      } catch {
        /* ignore */
      }
    })();
  }

  return {
    ok: true as const,
    invitationId: id,
    token,
    inviteCode: team.inviteCode,
  };
}

export async function acceptInvitation(userId: string, userEmail: string, token: string) {
  await ensureCriticalSchema();
  const db = getDb();
  const [invite] = await db
    .select()
    .from(teamInvitations)
    .where(
      and(eq(teamInvitations.token, token), eq(teamInvitations.status, "pending")),
    )
    .limit(1);
  if (!invite) {
    return { ok: false as const, error: "Zaproszenie jest nieaktualne." };
  }
  if (invite.expiresAt.getTime() <= Date.now()) {
    await db
      .update(teamInvitations)
      .set({ status: "expired", respondedAt: new Date() })
      .where(eq(teamInvitations.id, invite.id));
    return { ok: false as const, error: "Zaproszenie wygasło." };
  }

  const email = userEmail.trim().toLowerCase();
  const allowed =
    invite.inviteeUserId === userId ||
    (invite.inviteeEmail && invite.inviteeEmail === email);
  if (!allowed) {
    return {
      ok: false as const,
      error: "To zaproszenie jest przypisane do innego konta.",
    };
  }

  const role = isAssignableTeamRole(invite.role) ? invite.role : "member";
  const join = await joinTeamByCode(
    userId,
    (
      await db
        .select({ inviteCode: teams.inviteCode })
        .from(teams)
        .where(eq(teams.id, invite.teamId))
        .limit(1)
    )[0]?.inviteCode ?? "",
    { joinMethod: "invite" },
  );
  if (!join.ok) return join;

  if (role !== "member") {
    const membership = await getActiveMembership(invite.teamId, userId);
    if (membership && membership.role !== "owner") {
      await db
        .update(teamMembers)
        .set({ role })
        .where(eq(teamMembers.id, membership.id));
    }
  }

  await db
    .update(teamInvitations)
    .set({
      status: "accepted",
      respondedAt: new Date(),
      inviteeUserId: userId,
    })
    .where(eq(teamInvitations.id, invite.id));

  return { ok: true as const, teamId: invite.teamId };
}

export async function declineInvitation(
  userId: string,
  userEmail: string,
  token: string,
) {
  await ensureCriticalSchema();
  const db = getDb();
  const [invite] = await db
    .select()
    .from(teamInvitations)
    .where(
      and(eq(teamInvitations.token, token), eq(teamInvitations.status, "pending")),
    )
    .limit(1);
  if (!invite) {
    return { ok: false as const, error: "Zaproszenie jest nieaktualne." };
  }
  const email = userEmail.trim().toLowerCase();
  const allowed =
    invite.inviteeUserId === userId ||
    (invite.inviteeEmail && invite.inviteeEmail === email);
  if (!allowed) {
    return { ok: false as const, error: "To zaproszenie nie jest dla Ciebie." };
  }
  await db
    .update(teamInvitations)
    .set({ status: "declined", respondedAt: new Date() })
    .where(eq(teamInvitations.id, invite.id));
  return { ok: true as const };
}

export async function revokeInvitation(
  actorUserId: string,
  teamId: string,
  invitationId: string,
) {
  const membership = await getActiveMembership(teamId, actorUserId);
  if (!canInviteMembers(membership?.role ?? null)) {
    return { ok: false as const, error: "Brak uprawnień." };
  }
  const db = getDb();
  await db
    .update(teamInvitations)
    .set({ status: "revoked", respondedAt: new Date() })
    .where(
      and(
        eq(teamInvitations.id, invitationId),
        eq(teamInvitations.teamId, teamId),
        eq(teamInvitations.status, "pending"),
      ),
    );
  return { ok: true as const };
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
