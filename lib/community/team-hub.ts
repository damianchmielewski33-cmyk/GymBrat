/**
 * Agregat „Dziś w zespole” — dane pod hub UX 012.
 */

import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { teamMembers, teamXp, users } from "@/db/schema";
import { getBadgeCatalogForUser } from "@/lib/community/badge-catalog";
import { getMyRankingSummary } from "@/lib/community/fcs-compute";
import {
  levelFromXp,
  progressInLevel,
  TEAM_MAX_LEVEL,
} from "@/lib/community/progression-curve";
import { getUserProgressionView } from "@/lib/community/progression";
import {
  awardRingClosedIfNeeded,
  getWeeklyRingsForUser,
  type WeeklyRingsView,
} from "@/lib/community/rings";
import {
  ensureActiveQuestForTeam,
  getQuestBoardView,
  type QuestBoardView,
} from "@/lib/community/team-quests";
import { getMyTeamWarSummary } from "@/lib/community/team-wars";
import { getCurrentConsents } from "@/lib/consents";

export type TeamLevelsView = {
  user: {
    level: number;
    intoLevel: number;
    needForNext: number;
    pct: number;
  };
  team: {
    level: number;
    intoLevel: number;
    needForNext: number;
    pct: number;
    xpTotal: number;
  };
};

export type TeamTodayHub = {
  teamId: string;
  teamName: string;
  ranking: Awaited<ReturnType<typeof getMyRankingSummary>>;
  rings: WeeklyRingsView;
  levels: TeamLevelsView;
  mission: QuestBoardView | null;
  memberCount: number;
  war: Awaited<ReturnType<typeof getMyTeamWarSummary>>;
  badges: { unlockedCount: number; totalCount: number };
  consents: {
    teamRanking: boolean;
    teamCardio: boolean;
  };
  hasDisplayName: boolean;
};

export async function getTeamProgressionView(teamId: string): Promise<{
  xpTotal: number;
  level: number;
  intoLevel: number;
  needForNext: number;
  pct: number;
}> {
  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .select()
    .from(teamXp)
    .where(eq(teamXp.teamId, teamId))
    .limit(1);
  const xp = row?.xpTotal ?? 0;
  const prog = progressInLevel(xp, TEAM_MAX_LEVEL, 200);
  return {
    xpTotal: xp,
    level: Math.min(
      TEAM_MAX_LEVEL,
      row?.level ?? levelFromXp(xp, TEAM_MAX_LEVEL, 200),
    ),
    intoLevel: prog.intoLevel,
    needForNext: prog.needForNext,
    pct: prog.pct,
  };
}

export async function getTeamTodayHub(input: {
  teamId: string;
  userId: string;
  teamName: string;
}): Promise<TeamTodayHub> {
  await ensureCriticalSchema();

  await ensureActiveQuestForTeam(input.teamId, input.userId).catch(() => null);

  const db = getDb();
  const [
    ranking,
    rings,
    userProg,
    teamProg,
    mission,
    war,
    badges,
    consents,
    memberCountRow,
    user,
  ] = await Promise.all([
    getMyRankingSummary(input.teamId, input.userId),
    getWeeklyRingsForUser(input.userId),
    getUserProgressionView(input.userId),
    getTeamProgressionView(input.teamId),
    getQuestBoardView(input.teamId),
    getMyTeamWarSummary(input.teamId),
    getBadgeCatalogForUser(input.userId),
    getCurrentConsents(input.userId),
    db
      .select({ n: sql<number>`count(*)` })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, input.teamId),
          eq(teamMembers.status, "active"),
        ),
      )
      .then((r) => r[0]),
    db
      .select({ name: users.name, firstName: users.firstName })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1)
      .then((r) => r[0]),
  ]);

  await awardRingClosedIfNeeded(input.userId, rings).catch(() => undefined);

  const hasDisplayName = Boolean(
    user?.name?.trim() || user?.firstName?.trim(),
  );

  return {
    teamId: input.teamId,
    teamName: input.teamName,
    ranking,
    rings,
    levels: {
      user: {
        level: userProg.level,
        intoLevel: userProg.intoLevel,
        needForNext: userProg.needForNext,
        pct: userProg.pct,
      },
      team: {
        level: teamProg.level,
        intoLevel: teamProg.intoLevel,
        needForNext: teamProg.needForNext,
        pct: teamProg.pct,
        xpTotal: teamProg.xpTotal,
      },
    },
    mission,
    memberCount: Number(memberCountRow?.n ?? 0),
    war,
    badges: {
      unlockedCount: badges.unlockedCount,
      totalCount: badges.totalCount,
    },
    consents: {
      teamRanking: Boolean(consents.team_ranking?.granted),
      teamCardio: Boolean(consents.team_cardio?.granted),
    },
    hasDisplayName,
  };
}
