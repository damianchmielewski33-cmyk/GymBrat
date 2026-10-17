import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import {
  groupWorkoutParticipants,
  groupWorkoutSessions,
  teamMembers,
  teams,
  users,
} from "@/db/schema";
import { getOrCreateWorkoutChatChannel } from "@/lib/community/chat";
import { cacheGet, cacheInvalidate, cacheSet, SSE_POLL } from "@/lib/community/perf-cache";
import { getActiveMembership } from "@/lib/community/teams";
import {
  emptyPresence,
  parsePresence,
  type GroupTeamOption,
  type GroupWorkoutParticipantView,
  type GroupWorkoutPresence,
} from "@/lib/community/group-workout-types";

function displayName(row: {
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

export async function listUserTeamsForGroupStart(
  userId: string,
): Promise<GroupTeamOption[]> {
  await ensureCriticalSchema();
  const db = getDb();
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      avatarEmoji: teams.avatarEmoji,
      memberCount: teams.memberCount,
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

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    avatarEmoji: r.avatarEmoji,
    memberCount: r.memberCount,
  }));
}

export async function createGroupWorkoutSession(input: {
  hostUserId: string;
  teamId: string;
  title?: string;
}): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
  await ensureCriticalSchema();
  const membership = await getActiveMembership(input.teamId, input.hostUserId);
  if (!membership) {
    return { ok: false, error: "Nie jesteś członkiem tej grupy." };
  }

  const db = getDb();
  const [team] = await db
    .select({ name: teams.name })
    .from(teams)
    .where(and(eq(teams.id, input.teamId), isNull(teams.archivedAt)))
    .limit(1);
  if (!team) return { ok: false, error: "Grupa nie istnieje." };

  const [user] = await db
    .select({
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, input.hostUserId))
    .limit(1);

  const sessionId = crypto.randomUUID();
  const now = new Date();
  const presence = emptyPresence(user ? displayName(user) : "Zawodnik");

  await db.insert(groupWorkoutSessions).values({
    id: sessionId,
    teamId: input.teamId,
    hostUserId: input.hostUserId,
    title: input.title?.trim() || `Trening · ${team.name}`,
    status: "live",
    createdAt: now,
  });

  await db.insert(groupWorkoutParticipants).values({
    id: crypto.randomUUID(),
    sessionId,
    userId: input.hostUserId,
    status: "joined",
    presenceJson: JSON.stringify(presence),
    joinedAt: now,
    updatedAt: now,
  });

  await getOrCreateWorkoutChatChannel({
    groupSessionId: sessionId,
    userId: input.hostUserId,
  });

  void (async () => {
    try {
      const { notifyTeamMembers } = await import(
        "@/lib/community/notifications"
      );
      const hostName = user ? displayName(user) : "Ktoś";
      await notifyTeamMembers({
        teamId: input.teamId,
        exceptUserId: input.hostUserId,
        kind: "live",
        title: "Live trening",
        body: `${hostName} wystartował trening grupowy.`,
        href: `/community/teams/${input.teamId}`,
        actorUserId: input.hostUserId,
        actorDisplayName: hostName,
        entityType: "group_session",
        entityId: sessionId,
        groupKey: `live:session:${sessionId}`,
      });
    } catch {
      /* ignore */
    }
  })();

  {
    const { track } = await import("@/lib/analytics/track");
    track.liveStarted(input.hostUserId, {
      session_id: sessionId,
      team_id: input.teamId,
    });
  }

  return { ok: true, sessionId };
}

export async function joinGroupWorkoutSession(input: {
  userId: string;
  sessionId: string;
}): Promise<
  | { ok: true; sessionId: string; teamId: string; teamName: string }
  | { ok: false; error: string }
> {
  await ensureCriticalSchema();
  const db = getDb();
  const [session] = await db
    .select({
      id: groupWorkoutSessions.id,
      teamId: groupWorkoutSessions.teamId,
      status: groupWorkoutSessions.status,
      teamName: teams.name,
    })
    .from(groupWorkoutSessions)
    .innerJoin(teams, eq(teams.id, groupWorkoutSessions.teamId))
    .where(eq(groupWorkoutSessions.id, input.sessionId))
    .limit(1);

  if (!session || session.status !== "live") {
    return { ok: false, error: "Sesja grupowa nie jest już aktywna." };
  }

  const membership = await getActiveMembership(session.teamId, input.userId);
  if (!membership) {
    return { ok: false, error: "Musisz być w Team, by dołączyć." };
  }

  const [user] = await db
    .select({
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  const now = new Date();
  const presence = emptyPresence(user ? displayName(user) : "Zawodnik");

  const [existing] = await db
    .select({ id: groupWorkoutParticipants.id, status: groupWorkoutParticipants.status })
    .from(groupWorkoutParticipants)
    .where(
      and(
        eq(groupWorkoutParticipants.sessionId, input.sessionId),
        eq(groupWorkoutParticipants.userId, input.userId),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(groupWorkoutParticipants)
      .set({
        status: "joined",
        presenceJson: JSON.stringify(presence),
        updatedAt: now,
        leftAt: null,
      })
      .where(eq(groupWorkoutParticipants.id, existing.id));
  } else {
    await db.insert(groupWorkoutParticipants).values({
      id: crypto.randomUUID(),
      sessionId: input.sessionId,
      userId: input.userId,
      status: "joined",
      presenceJson: JSON.stringify(presence),
      joinedAt: now,
      updatedAt: now,
    });
  }

  void (async () => {
    try {
      const { notifyTeamMembers } = await import(
        "@/lib/community/notifications"
      );
      const joinName = user ? displayName(user) : "Ktoś";
      await notifyTeamMembers({
        teamId: session.teamId,
        exceptUserId: input.userId,
        kind: "live",
        title: "Live trening",
        body: `${joinName} dołączył do sesji grupowej.`,
        href: `/community/teams/${session.teamId}`,
        actorUserId: input.userId,
        actorDisplayName: joinName,
        entityType: "group_session",
        entityId: session.id,
        groupKey: `live:session:${session.id}`,
      });
    } catch {
      /* ignore */
    }
  })();

  {
    const { track } = await import("@/lib/analytics/track");
    track.liveJoined(input.userId, {
      session_id: session.id,
      team_id: session.teamId,
    });
  }

  return {
    ok: true,
    sessionId: session.id,
    teamId: session.teamId,
    teamName: session.teamName,
  };
}

export async function updateGroupWorkoutPresence(input: {
  userId: string;
  sessionId: string;
  presence: GroupWorkoutPresence;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await ensureCriticalSchema();
  const db = getDb();
  const [session] = await db
    .select({ status: groupWorkoutSessions.status })
    .from(groupWorkoutSessions)
    .where(eq(groupWorkoutSessions.id, input.sessionId))
    .limit(1);
  if (!session || session.status !== "live") {
    return { ok: false, error: "Sesja nieaktywna." };
  }

  const [row] = await db
    .select({ id: groupWorkoutParticipants.id, status: groupWorkoutParticipants.status })
    .from(groupWorkoutParticipants)
    .where(
      and(
        eq(groupWorkoutParticipants.sessionId, input.sessionId),
        eq(groupWorkoutParticipants.userId, input.userId),
      ),
    )
    .limit(1);

  if (!row || row.status !== "joined") {
    return { ok: false, error: "Nie jesteś w tej sesji." };
  }

  await db
    .update(groupWorkoutParticipants)
    .set({
      presenceJson: JSON.stringify(input.presence),
      updatedAt: new Date(),
    })
    .where(eq(groupWorkoutParticipants.id, row.id));

  cacheInvalidate(`presence:${input.sessionId}`);

  return { ok: true };
}

export async function listGroupWorkoutPresence(
  sessionId: string,
  viewerId: string,
): Promise<GroupWorkoutParticipantView[]> {
  await ensureCriticalSchema();
  const db = getDb();

  const [session] = await db
    .select({
      id: groupWorkoutSessions.id,
      teamId: groupWorkoutSessions.teamId,
      status: groupWorkoutSessions.status,
    })
    .from(groupWorkoutSessions)
    .where(eq(groupWorkoutSessions.id, sessionId))
    .limit(1);

  if (!session || session.status !== "live") return [];

  // ALAC: presence tylko dla członka Team LUB aktywnego uczestnika sesji (fix IDOR).
  const membership = await getActiveMembership(session.teamId, viewerId);
  const [participant] = await db
    .select({
      id: groupWorkoutParticipants.id,
      status: groupWorkoutParticipants.status,
    })
    .from(groupWorkoutParticipants)
    .where(
      and(
        eq(groupWorkoutParticipants.sessionId, sessionId),
        eq(groupWorkoutParticipants.userId, viewerId),
      ),
    )
    .limit(1);

  const allowed =
    !!membership ||
    (!!participant && participant.status === "joined");
  if (!allowed) return [];

  const cacheKey = `presence:${sessionId}`;
  const cached = cacheGet<
    Array<{
      userId: string;
      status: string;
      updatedAt: number;
      presence: GroupWorkoutPresence;
    }>
  >(cacheKey);

  let base: Array<{
    userId: string;
    status: string;
    updatedAt: number;
    presence: GroupWorkoutPresence;
  }>;

  if (cached) {
    base = cached;
  } else {
    const rows = await db
      .select({
        userId: groupWorkoutParticipants.userId,
        status: groupWorkoutParticipants.status,
        presenceJson: groupWorkoutParticipants.presenceJson,
        updatedAt: groupWorkoutParticipants.updatedAt,
      })
      .from(groupWorkoutParticipants)
      .where(
        and(
          eq(groupWorkoutParticipants.sessionId, sessionId),
          eq(groupWorkoutParticipants.status, "joined"),
        ),
      );

    base = rows.map((r) => ({
      userId: r.userId,
      status: r.status,
      updatedAt: r.updatedAt.getTime(),
      presence: parsePresence(r.presenceJson),
    }));
    cacheSet(cacheKey, base, SSE_POLL.presenceTtlMs);
  }

  // 90s — partnerzy bez ticka nie znikają od razu (wcześniej 30s → zostawał tylko „Ty”).
  const cutoff = Date.now() - 90_000;
  return base
    .filter((r) => r.updatedAt >= cutoff || r.userId === viewerId)
    .map((r) => ({
      userId: r.userId,
      status: r.status,
      updatedAt: r.updatedAt,
      presence: r.presence,
      isSelf: r.userId === viewerId,
    }));
}

export async function leaveGroupWorkoutSession(input: {
  userId: string;
  sessionId: string;
}) {
  await ensureCriticalSchema();
  const db = getDb();
  await db
    .update(groupWorkoutParticipants)
    .set({ status: "left", leftAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(groupWorkoutParticipants.sessionId, input.sessionId),
        eq(groupWorkoutParticipants.userId, input.userId),
      ),
    );

  const [session] = await db
    .select({
      hostUserId: groupWorkoutSessions.hostUserId,
      teamId: groupWorkoutSessions.teamId,
    })
    .from(groupWorkoutSessions)
    .where(eq(groupWorkoutSessions.id, input.sessionId))
    .limit(1);

  const isHost = session?.hostUserId === input.userId;
  if (isHost) {
    await db
      .update(groupWorkoutSessions)
      .set({ status: "ended", endedAt: new Date() })
      .where(eq(groupWorkoutSessions.id, input.sessionId));
  }

  if (session?.teamId) {
    const { track } = await import("@/lib/analytics/track");
    track.liveEnded(input.userId, {
      session_id: input.sessionId,
      team_id: session.teamId,
      ended_by: isHost ? "host" : "leave",
    });
  }

  return { ok: true as const };
}

export async function listLiveGroupSessionsForTeam(teamId: string) {
  await ensureCriticalSchema();
  const db = getDb();
  return db
    .select({
      id: groupWorkoutSessions.id,
      title: groupWorkoutSessions.title,
      hostUserId: groupWorkoutSessions.hostUserId,
      createdAt: groupWorkoutSessions.createdAt,
    })
    .from(groupWorkoutSessions)
    .where(
      and(
        eq(groupWorkoutSessions.teamId, teamId),
        eq(groupWorkoutSessions.status, "live"),
      ),
    )
    .orderBy(desc(groupWorkoutSessions.createdAt))
    .limit(10);
}
