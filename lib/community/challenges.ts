import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import {
  challengeParticipants,
  challengeProgress,
  challengeRewardClaims,
  challenges,
  teamMembers,
  userBadges,
  userCommunityXp,
  users,
} from "@/db/schema";
import {
  computeWorkoutMetricDelta,
  displayMetricValue,
  formatMetricDisplay,
  storageTargetValue,
  type WorkoutMetricSource,
} from "@/lib/community/challenge-metrics";
import {
  CHALLENGE_TEMPLATES,
  challengeScopeLabel,
  isChallengeMetric,
  isChallengeScope,
  xpLevelFromTotal,
  xpProgressInLevel,
  type ChallengeMetricFilter,
  type ChallengeMetricKind,
  type ChallengeScope,
  type ChallengeTemplate,
} from "@/lib/community/challenge-types";
import { getOrCreateChallengeChatChannel } from "@/lib/community/chat";
import { publishAutoPostToUserTeams } from "@/lib/community/team-feed";
import { getActiveMembership } from "@/lib/community/teams";

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

function parseFilter(json: string): ChallengeMetricFilter {
  try {
    const o = JSON.parse(json) as ChallengeMetricFilter;
    return {
      exerciseKeywords: Array.isArray(o.exerciseKeywords)
        ? o.exerciseKeywords.filter((x) => typeof x === "string")
        : [],
    };
  } catch {
    return {};
  }
}

export type ChallengeListItem = {
  id: string;
  scope: ChallengeScope;
  scopeLabel: string;
  teamId: string | null;
  title: string;
  description: string;
  emoji: string;
  metricKind: ChallengeMetricKind;
  targetValue: number;
  targetDisplay: number;
  unitLabel: string;
  startsAt: number;
  endsAt: number | null;
  rewardXp: number;
  rewardBadgeKey: string | null;
  rewardTitle: string | null;
  status: string;
  participantCount: number;
  myProgress: number;
  myProgressDisplay: number;
  myPct: number;
  groupProgress: number;
  groupProgressDisplay: number;
  groupPct: number;
  joined: boolean;
  completed: boolean;
  celebrationPending: boolean;
};

export type ChallengeLeaderboardRow = {
  rank: number;
  userId: string;
  displayName: string;
  value: number;
  valueDisplay: number;
  pct: number;
  completed: boolean;
};

export type ChallengeDetailView = ChallengeListItem & {
  metricFilter: ChallengeMetricFilter;
  leaderboard: ChallengeLeaderboardRow[];
  myXp: { xpTotal: number; level: number; pct: number };
  badges: Array<{
    badgeKey: string;
    title: string;
    emoji: string;
    unlockedAt: number;
  }>;
  canManage: boolean;
};

export type CelebrationPayload = {
  claimId: string;
  challengeId: string;
  title: string;
  emoji: string;
  rewardTitle: string | null;
  xpAwarded: number;
  badgeKey: string | null;
  badgeEmoji: string;
  level: number;
  xpTotal: number;
};

function canCreateForTeam(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "moderator";
}

async function participantCountMap(
  challengeIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (challengeIds.length === 0) return map;
  const db = getDb();
  const rows = await db
    .select({
      challengeId: challengeParticipants.challengeId,
      count: sql<number>`count(*)`,
    })
    .from(challengeParticipants)
    .where(
      and(
        inArray(challengeParticipants.challengeId, challengeIds),
        or(
          eq(challengeParticipants.status, "active"),
          eq(challengeParticipants.status, "completed"),
        ),
      ),
    )
    .groupBy(challengeParticipants.challengeId);
  for (const r of rows) map.set(r.challengeId, Number(r.count ?? 0));
  return map;
}

async function groupProgressMap(
  challengeIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (challengeIds.length === 0) return map;
  const db = getDb();
  const rows = await db
    .select({
      challengeId: challengeProgress.challengeId,
      sum: sql<number>`coalesce(sum(${challengeProgress.currentValue}), 0)`,
    })
    .from(challengeProgress)
    .where(inArray(challengeProgress.challengeId, challengeIds))
    .groupBy(challengeProgress.challengeId);
  for (const r of rows) map.set(r.challengeId, Number(r.sum ?? 0));
  return map;
}

function toListItem(
  row: typeof challenges.$inferSelect,
  extras: {
    participantCount: number;
    myProgress: number;
    groupProgress: number;
    joined: boolean;
    completed: boolean;
    celebrationPending: boolean;
  },
): ChallengeListItem {
  const scope = isChallengeScope(row.scope) ? row.scope : "individual";
  const metricKind = isChallengeMetric(row.metricKind)
    ? row.metricKind
    : "sessions";
  const target = row.targetValue;
  const my = extras.myProgress;
  const group = extras.groupProgress;
  const useGroup = scope === "group" || scope === "global";
  const effective = useGroup ? group : my;
  return {
    id: row.id,
    scope,
    scopeLabel: challengeScopeLabel(scope),
    teamId: row.teamId,
    title: row.title,
    description: row.description,
    emoji: row.emoji,
    metricKind,
    targetValue: target,
    targetDisplay: displayMetricValue(metricKind, target),
    unitLabel: row.unitLabel,
    startsAt: row.startsAt.getTime(),
    endsAt: row.endsAt ? row.endsAt.getTime() : null,
    rewardXp: row.rewardXp,
    rewardBadgeKey: row.rewardBadgeKey,
    rewardTitle: row.rewardTitle,
    status: row.status,
    participantCount: extras.participantCount,
    myProgress: my,
    myProgressDisplay: displayMetricValue(metricKind, my),
    myPct: target > 0 ? Math.min(100, Math.round((my / target) * 100)) : 0,
    groupProgress: group,
    groupProgressDisplay: displayMetricValue(metricKind, group),
    groupPct: target > 0 ? Math.min(100, Math.round((group / target) * 100)) : 0,
    joined: extras.joined,
    completed:
      extras.completed ||
      (useGroup ? group >= target : my >= target),
    celebrationPending: extras.celebrationPending,
  };
}

export function listChallengeTemplates(): ChallengeTemplate[] {
  return CHALLENGE_TEMPLATES;
}

export async function createChallengeFromTemplate(input: {
  actorUserId: string;
  teamId: string | null;
  templateKey: string;
  scopeOverride?: ChallengeScope;
}): Promise<
  | { ok: true; challengeId: string }
  | { ok: false; error: string }
> {
  await ensureCriticalSchema();
  const template = CHALLENGE_TEMPLATES.find((t) => t.key === input.templateKey);
  if (!template) return { ok: false, error: "Nieznany szablon wyzwania." };

  const scope = input.scopeOverride ?? template.scope;
  if (scope === "global") {
    // Tylko system / seed — user tworzy global tylko jako admin team? Blokuj z Team UI.
    if (input.teamId) {
      return {
        ok: false,
        error: "Wyzwanie globalne uruchamia platforma — dołącz z listy Global.",
      };
    }
  } else if (!input.teamId) {
    return { ok: false, error: "Wybierz Team dla tego wyzwania." };
  }

  if (input.teamId) {
    const membership = await getActiveMembership(
      input.teamId,
      input.actorUserId,
    );
    if (!canCreateForTeam(membership?.role ?? null)) {
      return {
        ok: false,
        error: "Brak uprawnień do tworzenia wyzwań (Owner / Admin / Moderator).",
      };
    }
  }

  const now = new Date();
  const endsAt =
    template.durationDays != null
      ? new Date(now.getTime() + template.durationDays * 86_400_000)
      : null;
  const target = storageTargetValue(template.metricKind, template.targetValue);
  const id = crypto.randomUUID();
  const db = getDb();

  await db.insert(challenges).values({
    id,
    scope,
    teamId: scope === "global" ? null : input.teamId,
    createdByUserId: input.actorUserId,
    title: template.title,
    description: template.description,
    emoji: template.emoji,
    metricKind: template.metricKind,
    metricFilterJson: JSON.stringify(template.metricFilter),
    targetValue: target,
    unitLabel: template.unitLabel,
    startsAt: now,
    endsAt,
    rewardXp: template.rewardXp,
    rewardBadgeKey: template.rewardBadgeKey,
    rewardTitle: template.rewardTitle,
    status: "active",
    templateKey: template.key,
    createdAt: now,
    updatedAt: now,
  });

  await joinChallenge({
    challengeId: id,
    userId: input.actorUserId,
    skipAnalytics: true,
  });

  if (input.teamId && (scope === "group" || scope === "seasonal")) {
    // Auto-join wszystkich aktywnych członków Team.
    const members = await db
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, input.teamId),
          eq(teamMembers.status, "active"),
        ),
      );
    for (const m of members) {
      if (m.userId === input.actorUserId) continue;
      await joinChallenge({
        challengeId: id,
        userId: m.userId,
        skipAnalytics: true,
      });
    }
  }

  {
    const { track } = await import("@/lib/analytics/track");
    track.challengeCreated(input.actorUserId, {
      challenge_id: id,
      team_id: scope === "global" ? null : input.teamId,
      template_key: template.key,
      scope,
      metric_kind: template.metricKind,
      target_value: template.targetValue,
      duration_days: template.durationDays ?? null,
    });
  }

  if (input.teamId) {
    try {
      await getOrCreateChallengeChatChannel({
        challengeId: id,
        teamId: input.teamId,
        userId: input.actorUserId,
        title: `Challenge · ${template.title}`,
      });
    } catch {
      /* chat opcjonalny */
    }

    void publishAutoPostToUserTeams({
      authorUserId: input.actorUserId,
      type: "achievement",
      body: `${template.emoji} Nowe wyzwanie: ${template.title}`,
      snapshot: {
        challengeId: id,
        scope,
        target: template.targetValue,
        unit: template.unitLabel,
      },
      sourceKeySuffix: `challenge:${id}`,
      teamIds: [input.teamId],
    }).catch(() => {});

    void (async () => {
      try {
        const { notifyTeamMembers } = await import(
          "@/lib/community/notifications"
        );
        await notifyTeamMembers({
          teamId: input.teamId!,
          exceptUserId: input.actorUserId,
          kind: "challenge",
          title: "Nowe wyzwanie",
          body: `${template.emoji} ${template.title}`,
          href: `/community/teams/${input.teamId}/challenges/${id}`,
          actorUserId: input.actorUserId,
          entityType: "challenge",
          entityId: id,
          groupKey: `challenge:new:${id}`,
        });
      } catch {
        /* ignore */
      }
    })();
  }

  return { ok: true, challengeId: id };
}

export async function ensureGlobalChallenges(seedUserId: string): Promise<void> {
  await ensureCriticalSchema();
  const db = getDb();
  const globalTemplates = CHALLENGE_TEMPLATES.filter((t) => t.scope === "global");
  for (const template of globalTemplates) {
    const [existing] = await db
      .select({ id: challenges.id })
      .from(challenges)
      .where(
        and(
          eq(challenges.templateKey, template.key),
          eq(challenges.scope, "global"),
          eq(challenges.status, "active"),
        ),
      )
      .limit(1);
    if (existing) continue;

    const now = new Date();
    const endsAt =
      template.durationDays != null
        ? new Date(now.getTime() + template.durationDays * 86_400_000)
        : null;
    await db.insert(challenges).values({
      id: crypto.randomUUID(),
      scope: "global",
      teamId: null,
      createdByUserId: seedUserId,
      title: template.title,
      description: template.description,
      emoji: template.emoji,
      metricKind: template.metricKind,
      metricFilterJson: JSON.stringify(template.metricFilter),
      targetValue: storageTargetValue(template.metricKind, template.targetValue),
      unitLabel: template.unitLabel,
      startsAt: now,
      endsAt,
      rewardXp: template.rewardXp,
      rewardBadgeKey: template.rewardBadgeKey,
      rewardTitle: template.rewardTitle,
      status: "active",
      templateKey: template.key,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function joinChallenge(input: {
  challengeId: string;
  userId: string;
  /** Auto-join przy create — bez eventów (źródło: community_challenge_created). */
  skipAnalytics?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await ensureCriticalSchema();
  const db = getDb();
  const [ch] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.id, input.challengeId))
    .limit(1);
  if (!ch || ch.status !== "active") {
    return { ok: false, error: "Wyzwanie nie jest aktywne." };
  }
  if (ch.endsAt && ch.endsAt.getTime() < Date.now()) {
    return { ok: false, error: "Wyzwanie już się zakończyło." };
  }
  if (ch.teamId) {
    const membership = await getActiveMembership(ch.teamId, input.userId);
    if (!membership) {
      return { ok: false, error: "Musisz być w Team, by dołączyć." };
    }
  }

  const [existing] = await db
    .select({ id: challengeParticipants.id, status: challengeParticipants.status })
    .from(challengeParticipants)
    .where(
      and(
        eq(challengeParticipants.challengeId, input.challengeId),
        eq(challengeParticipants.userId, input.userId),
      ),
    )
    .limit(1);

  const now = new Date();
  if (existing) {
    if (existing.status === "left") {
      await db
        .update(challengeParticipants)
        .set({ status: "active", joinedAt: now, completedAt: null })
        .where(eq(challengeParticipants.id, existing.id));
    }
  } else {
    await db.insert(challengeParticipants).values({
      id: crypto.randomUUID(),
      challengeId: input.challengeId,
      userId: input.userId,
      status: "active",
      joinedAt: now,
    });
  }

  const [prog] = await db
    .select({ challengeId: challengeProgress.challengeId })
    .from(challengeProgress)
    .where(
      and(
        eq(challengeProgress.challengeId, input.challengeId),
        eq(challengeProgress.userId, input.userId),
      ),
    )
    .limit(1);
  if (!prog) {
    await db.insert(challengeProgress).values({
      challengeId: input.challengeId,
      userId: input.userId,
      currentValue: 0,
      updatedAt: now,
    });
  }

  if (!input.skipAnalytics) {
    const { track } = await import("@/lib/analytics/track");
    track.challengeJoined(input.userId, {
      challenge_id: input.challengeId,
      team_id: ch.teamId,
      scope: ch.scope,
      template_key: ch.templateKey,
    });
  }

  return { ok: true };
}

export async function listTeamChallenges(
  teamId: string,
  viewerId: string,
): Promise<ChallengeListItem[]> {
  await ensureCriticalSchema();
  const membership = await getActiveMembership(teamId, viewerId);
  if (!membership) return [];

  const db = getDb();
  const rows = await db
    .select()
    .from(challenges)
    .where(
      and(
        eq(challenges.teamId, teamId),
        or(eq(challenges.status, "active"), eq(challenges.status, "completed")),
      ),
    )
    .orderBy(desc(challenges.createdAt))
    .limit(40);

  return hydrateChallengeList(rows, viewerId);
}

export async function listGlobalChallenges(
  viewerId: string,
): Promise<ChallengeListItem[]> {
  await ensureCriticalSchema();
  await ensureGlobalChallenges(viewerId);
  const db = getDb();
  const rows = await db
    .select()
    .from(challenges)
    .where(
      and(
        eq(challenges.scope, "global"),
        or(eq(challenges.status, "active"), eq(challenges.status, "completed")),
      ),
    )
    .orderBy(desc(challenges.createdAt))
    .limit(20);
  return hydrateChallengeList(rows, viewerId);
}

async function hydrateChallengeList(
  rows: (typeof challenges.$inferSelect)[],
  viewerId: string,
): Promise<ChallengeListItem[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const db = getDb();
  const [counts, groups, myProg, myParts, pendingClaims] = await Promise.all([
    participantCountMap(ids),
    groupProgressMap(ids),
    db
      .select()
      .from(challengeProgress)
      .where(
        and(
          inArray(challengeProgress.challengeId, ids),
          eq(challengeProgress.userId, viewerId),
        ),
      ),
    db
      .select()
      .from(challengeParticipants)
      .where(
        and(
          inArray(challengeParticipants.challengeId, ids),
          eq(challengeParticipants.userId, viewerId),
        ),
      ),
    db
      .select({
        challengeId: challengeRewardClaims.challengeId,
      })
      .from(challengeRewardClaims)
      .where(
        and(
          inArray(challengeRewardClaims.challengeId, ids),
          eq(challengeRewardClaims.userId, viewerId),
          isNull(challengeRewardClaims.celebrationSeenAt),
        ),
      ),
  ]);

  const myProgMap = new Map(myProg.map((p) => [p.challengeId, p.currentValue]));
  const partMap = new Map(myParts.map((p) => [p.challengeId, p]));
  const pending = new Set(pendingClaims.map((c) => c.challengeId));

  return rows.map((row) => {
    const part = partMap.get(row.id);
    return toListItem(row, {
      participantCount: counts.get(row.id) ?? 0,
      myProgress: myProgMap.get(row.id) ?? 0,
      groupProgress: groups.get(row.id) ?? 0,
      joined: !!part && part.status !== "left",
      completed: part?.status === "completed" || !!part?.completedAt,
      celebrationPending: pending.has(row.id),
    });
  });
}

export async function getChallengeDetail(
  challengeId: string,
  viewerId: string,
): Promise<ChallengeDetailView | null> {
  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.id, challengeId))
    .limit(1);
  if (!row) return null;

  if (row.teamId) {
    const membership = await getActiveMembership(row.teamId, viewerId);
    if (!membership) return null;
  }

  const [list] = await hydrateChallengeList([row], viewerId);
  if (!list) return null;

  const progressRows = await db
    .select({
      userId: challengeProgress.userId,
      currentValue: challengeProgress.currentValue,
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      email: users.email,
      partStatus: challengeParticipants.status,
      completedAt: challengeParticipants.completedAt,
    })
    .from(challengeProgress)
    .innerJoin(users, eq(users.id, challengeProgress.userId))
    .leftJoin(
      challengeParticipants,
      and(
        eq(challengeParticipants.challengeId, challengeProgress.challengeId),
        eq(challengeParticipants.userId, challengeProgress.userId),
      ),
    )
    .where(eq(challengeProgress.challengeId, challengeId))
    .orderBy(desc(challengeProgress.currentValue))
    .limit(50);

  const target = row.targetValue;
  const metricKind = list.metricKind;
  const leaderboard: ChallengeLeaderboardRow[] = progressRows.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    displayName: displayName(r),
    value: r.currentValue,
    valueDisplay: displayMetricValue(metricKind, r.currentValue),
    pct: target > 0 ? Math.min(100, Math.round((r.currentValue / target) * 100)) : 0,
    completed:
      r.partStatus === "completed" ||
      !!r.completedAt ||
      r.currentValue >= target,
  }));

  const [xpRow] = await db
    .select()
    .from(userCommunityXp)
    .where(eq(userCommunityXp.userId, viewerId))
    .limit(1);
  const xpTotal = xpRow?.xpTotal ?? 0;
  const xpInfo = xpProgressInLevel(xpTotal);

  const badges = await db
    .select({
      badgeKey: userBadges.badgeKey,
      title: userBadges.title,
      emoji: userBadges.emoji,
      unlockedAt: userBadges.unlockedAt,
    })
    .from(userBadges)
    .where(eq(userBadges.userId, viewerId))
    .orderBy(desc(userBadges.unlockedAt))
    .limit(30);

  let canManage = false;
  if (row.teamId) {
    const membership = await getActiveMembership(row.teamId, viewerId);
    canManage = canCreateForTeam(membership?.role ?? null);
  }

  return {
    ...list,
    metricFilter: parseFilter(row.metricFilterJson),
    leaderboard,
    myXp: {
      xpTotal,
      level: xpInfo.level,
      pct: xpInfo.pct,
    },
    badges: badges.map((b) => ({
      badgeKey: b.badgeKey,
      title: b.title,
      emoji: b.emoji,
      unlockedAt: b.unlockedAt.getTime(),
    })),
    canManage,
  };
}

async function awardChallengeRewards(input: {
  challengeId: string;
  userId: string;
  challenge: typeof challenges.$inferSelect;
}): Promise<CelebrationPayload | null> {
  const db = getDb();
  const [existing] = await db
    .select({ id: challengeRewardClaims.id })
    .from(challengeRewardClaims)
    .where(
      and(
        eq(challengeRewardClaims.challengeId, input.challengeId),
        eq(challengeRewardClaims.userId, input.userId),
      ),
    )
    .limit(1);
  if (existing) return null;

  const xpAwarded = Math.max(0, input.challenge.rewardXp);
  const now = new Date();
  const claimId = crypto.randomUUID();

  await db.insert(challengeRewardClaims).values({
    id: claimId,
    challengeId: input.challengeId,
    userId: input.userId,
    xpAwarded,
    badgeKey: input.challenge.rewardBadgeKey,
    claimedAt: now,
    celebrationSeenAt: null,
  });

  const [xpRow] = await db
    .select()
    .from(userCommunityXp)
    .where(eq(userCommunityXp.userId, input.userId))
    .limit(1);
  const nextXp = (xpRow?.xpTotal ?? 0) + xpAwarded;
  const nextLevel = xpLevelFromTotal(nextXp);
  if (xpRow) {
    await db
      .update(userCommunityXp)
      .set({ xpTotal: nextXp, level: nextLevel, updatedAt: now })
      .where(eq(userCommunityXp.userId, input.userId));
  } else {
    await db.insert(userCommunityXp).values({
      userId: input.userId,
      xpTotal: nextXp,
      level: nextLevel,
      updatedAt: now,
    });
  }

  const badgeKey = input.challenge.rewardBadgeKey;
  const badgeTitle =
    input.challenge.rewardTitle || input.challenge.title || "Odznaka";
  if (badgeKey) {
    const [hasBadge] = await db
      .select({ id: userBadges.id })
      .from(userBadges)
      .where(
        and(eq(userBadges.userId, input.userId), eq(userBadges.badgeKey, badgeKey)),
      )
      .limit(1);
    if (!hasBadge) {
      await db.insert(userBadges).values({
        id: crypto.randomUUID(),
        userId: input.userId,
        badgeKey,
        title: badgeTitle,
        emoji: input.challenge.emoji || "🏅",
        challengeId: input.challengeId,
        unlockedAt: now,
      });
    }
  }

  await db
    .update(challengeParticipants)
    .set({ status: "completed", completedAt: now })
    .where(
      and(
        eq(challengeParticipants.challengeId, input.challengeId),
        eq(challengeParticipants.userId, input.userId),
      ),
    );

  if (input.challenge.teamId) {
    void publishAutoPostToUserTeams({
      authorUserId: input.userId,
      type: "challenge_complete",
      body: `${input.challenge.emoji} Ukończono wyzwanie: ${input.challenge.title} (+${xpAwarded} XP)`,
      snapshot: {
        challengeId: input.challengeId,
        xpAwarded,
        badgeKey,
      },
      sourceKeySuffix: `challenge-complete:${input.challengeId}:${input.userId}`,
      teamIds: [input.challenge.teamId],
    }).catch(() => {});

    void (async () => {
      try {
        const { emitNotification, notifyTeamMembers } = await import(
          "@/lib/community/notifications"
        );
        await emitNotification({
          userId: input.userId,
          kind: "achievement",
          title: "Wyzwanie ukończone",
          body: `${input.challenge.emoji} ${input.challenge.title} · +${xpAwarded} XP`,
          href: `/community/teams/${input.challenge.teamId}/challenges/${input.challengeId}`,
          teamId: input.challenge.teamId,
          entityType: "challenge",
          entityId: input.challengeId,
          groupKey: `challenge:done:${input.challengeId}:${input.userId}`,
        });
        await notifyTeamMembers({
          teamId: input.challenge.teamId!,
          exceptUserId: input.userId,
          kind: "challenge",
          title: "Wyzwanie ukończone",
          body: `Ktoś ukończył: ${input.challenge.title}`,
          href: `/community/teams/${input.challenge.teamId}/challenges/${input.challengeId}`,
          actorUserId: input.userId,
          entityType: "challenge",
          entityId: input.challengeId,
          groupKey: `challenge:done:team:${input.challengeId}`,
        });
      } catch {
        /* ignore */
      }
    })();
  }

  {
    const { track } = await import("@/lib/analytics/track");
    track.challengeCompleted(input.userId, {
      challenge_id: input.challengeId,
      team_id: input.challenge.teamId,
      template_key: input.challenge.templateKey,
      scope: input.challenge.scope,
      xp_awarded: xpAwarded,
      badge_key: badgeKey,
    });
  }

  return {
    claimId,
    challengeId: input.challengeId,
    title: input.challenge.title,
    emoji: input.challenge.emoji,
    rewardTitle: input.challenge.rewardTitle,
    xpAwarded,
    badgeKey,
    badgeEmoji: input.challenge.emoji || "🏅",
    level: nextLevel,
    xpTotal: nextXp,
  };
}

/**
 * Po ukończeniu treningu — aktualizuje aktywne wyzwania użytkownika.
 */
export async function applyChallengeProgressAfterWorkout(input: {
  userId: string;
  source: WorkoutMetricSource;
}): Promise<CelebrationPayload[]> {
  const celebrations: CelebrationPayload[] = [];
  try {
    await ensureCriticalSchema();
    const db = getDb();
    const now = Date.now();

    const memberships = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.userId, input.userId),
          eq(teamMembers.status, "active"),
        ),
      );
    const teamIds = memberships.map((m) => m.teamId);

    const activeParts = await db
      .select({
        challengeId: challengeParticipants.challengeId,
        status: challengeParticipants.status,
      })
      .from(challengeParticipants)
      .where(
        and(
          eq(challengeParticipants.userId, input.userId),
          eq(challengeParticipants.status, "active"),
        ),
      );

    if (activeParts.length === 0 && teamIds.length === 0) {
      // Auto-join globalnych, w których user jeszcze nie jest
    }

    // Auto-dołącz do aktywnych globalnych, jeśli jeszcze nie
    const globals = await db
      .select({ id: challenges.id })
      .from(challenges)
      .where(
        and(eq(challenges.scope, "global"), eq(challenges.status, "active")),
      )
      .limit(10);
    for (const g of globals) {
      const already = activeParts.some((p) => p.challengeId === g.id);
      if (!already) {
        await joinChallenge({ challengeId: g.id, userId: input.userId });
      }
    }

    const parts = await db
      .select({
        challengeId: challengeParticipants.challengeId,
      })
      .from(challengeParticipants)
      .where(
        and(
          eq(challengeParticipants.userId, input.userId),
          eq(challengeParticipants.status, "active"),
        ),
      );

    if (parts.length === 0) return celebrations;

    const challengeRows = await db
      .select()
      .from(challenges)
      .where(
        and(
          inArray(
            challenges.id,
            parts.map((p) => p.challengeId),
          ),
          eq(challenges.status, "active"),
        ),
      );

    for (const ch of challengeRows) {
      if (ch.startsAt.getTime() > now) continue;
      if (ch.endsAt && ch.endsAt.getTime() < now) continue;
      if (ch.teamId && !teamIds.includes(ch.teamId)) continue;

      const metricKind = isChallengeMetric(ch.metricKind)
        ? ch.metricKind
        : "sessions";
      const filter = parseFilter(ch.metricFilterJson);
      const delta = computeWorkoutMetricDelta(metricKind, filter, input.source);
      if (delta <= 0) continue;

      const [prog] = await db
        .select()
        .from(challengeProgress)
        .where(
          and(
            eq(challengeProgress.challengeId, ch.id),
            eq(challengeProgress.userId, input.userId),
          ),
        )
        .limit(1);

      // Idempotencja per workout
      if (prog?.lastWorkoutId === input.source.workoutId) continue;

      const nextVal = (prog?.currentValue ?? 0) + delta;
      const stamp = new Date();
      if (prog) {
        await db
          .update(challengeProgress)
          .set({
            currentValue: nextVal,
            lastWorkoutId: input.source.workoutId,
            updatedAt: stamp,
          })
          .where(
            and(
              eq(challengeProgress.challengeId, ch.id),
              eq(challengeProgress.userId, input.userId),
            ),
          );
      } else {
        await db.insert(challengeProgress).values({
          challengeId: ch.id,
          userId: input.userId,
          currentValue: nextVal,
          lastWorkoutId: input.source.workoutId,
          updatedAt: stamp,
        });
      }

      const scope = isChallengeScope(ch.scope) ? ch.scope : "individual";
      const useGroup = scope === "group" || scope === "global";

      if (useGroup) {
        const [sumRow] = await db
          .select({
            sum: sql<number>`coalesce(sum(${challengeProgress.currentValue}), 0)`,
          })
          .from(challengeProgress)
          .where(eq(challengeProgress.challengeId, ch.id));
        const groupTotal = Number(sumRow?.sum ?? 0);
        if (groupTotal >= ch.targetValue) {
          // Nagroda dla wszystkich aktywnych uczestników, którzy jeszcze nie dostali
          const allParts = await db
            .select({ userId: challengeParticipants.userId })
            .from(challengeParticipants)
            .where(
              and(
                eq(challengeParticipants.challengeId, ch.id),
                or(
                  eq(challengeParticipants.status, "active"),
                  eq(challengeParticipants.status, "completed"),
                ),
              ),
            );
          for (const p of allParts) {
            const celeb = await awardChallengeRewards({
              challengeId: ch.id,
              userId: p.userId,
              challenge: ch,
            });
            if (celeb && p.userId === input.userId) celebrations.push(celeb);
          }
          await db
            .update(challenges)
            .set({ status: "completed", updatedAt: stamp })
            .where(eq(challenges.id, ch.id));
        }
      } else if (nextVal >= ch.targetValue) {
        const celeb = await awardChallengeRewards({
          challengeId: ch.id,
          userId: input.userId,
          challenge: ch,
        });
        if (celeb) celebrations.push(celeb);
      }
    }
  } catch {
    /* nie psuj complete workout */
  }
  return celebrations;
}

export async function listPendingCelebrations(
  userId: string,
): Promise<CelebrationPayload[]> {
  await ensureCriticalSchema();
  const db = getDb();
  const rows = await db
    .select({
      claimId: challengeRewardClaims.id,
      challengeId: challengeRewardClaims.challengeId,
      xpAwarded: challengeRewardClaims.xpAwarded,
      badgeKey: challengeRewardClaims.badgeKey,
      title: challenges.title,
      emoji: challenges.emoji,
      rewardTitle: challenges.rewardTitle,
    })
    .from(challengeRewardClaims)
    .innerJoin(
      challenges,
      eq(challenges.id, challengeRewardClaims.challengeId),
    )
    .where(
      and(
        eq(challengeRewardClaims.userId, userId),
        isNull(challengeRewardClaims.celebrationSeenAt),
      ),
    )
    .orderBy(asc(challengeRewardClaims.claimedAt))
    .limit(5);

  const [xpRow] = await db
    .select()
    .from(userCommunityXp)
    .where(eq(userCommunityXp.userId, userId))
    .limit(1);

  return rows.map((r) => ({
    claimId: r.claimId,
    challengeId: r.challengeId,
    title: r.title,
    emoji: r.emoji,
    rewardTitle: r.rewardTitle,
    xpAwarded: r.xpAwarded,
    badgeKey: r.badgeKey,
    badgeEmoji: r.emoji || "🏅",
    level: xpRow?.level ?? xpLevelFromTotal(xpRow?.xpTotal ?? 0),
    xpTotal: xpRow?.xpTotal ?? 0,
  }));
}

export async function markCelebrationSeen(input: {
  userId: string;
  claimId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .select({ id: challengeRewardClaims.id })
    .from(challengeRewardClaims)
    .where(
      and(
        eq(challengeRewardClaims.id, input.claimId),
        eq(challengeRewardClaims.userId, input.userId),
      ),
    )
    .limit(1);
  if (!row) return { ok: false, error: "Nie znaleziono nagrody." };
  await db
    .update(challengeRewardClaims)
    .set({ celebrationSeenAt: new Date() })
    .where(eq(challengeRewardClaims.id, input.claimId));
  return { ok: true };
}

export async function getUserXpSummary(userId: string) {
  await ensureCriticalSchema();
  const db = getDb();
  const [xpRow] = await db
    .select()
    .from(userCommunityXp)
    .where(eq(userCommunityXp.userId, userId))
    .limit(1);
  const xpTotal = xpRow?.xpTotal ?? 0;
  return {
    xpTotal,
    ...xpProgressInLevel(xpTotal),
  };
}

export { formatMetricDisplay };
