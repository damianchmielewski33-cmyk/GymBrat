import { and, desc, eq, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import {
  teamMembers,
  teamWarQueue,
  teamWarStats,
  teams,
  warSeasons,
  wars,
} from "@/db/schema";
import { computeTeamFcsRanking } from "@/lib/community/fcs-compute";
import { gymbratSeasonKey } from "@/lib/community/hof-periods";
import { decideWarWinner, meanActiveFcs } from "@/lib/community/team-war-score";
import {
  applyLpDelta,
  WAR_DRAW_LP,
  WAR_DURATION_MS,
  WAR_LOSS_LP,
  WAR_WIN_LP,
  type WarLeague,
  leagueFromLp,
} from "@/lib/community/team-war-types";
import { calendarDateKey } from "@/lib/local-date";

export async function ensureWarSeason(): Promise<string> {
  await ensureCriticalSchema();
  const key = gymbratSeasonKey(calendarDateKey());
  const db = getDb();
  const [existing] = await db
    .select()
    .from(warSeasons)
    .where(eq(warSeasons.key, key))
    .limit(1);
  if (existing) return key;
  const [y, , s] = key.split(/-S/);
  const seasonNum = Number(s);
  const startMonth = (seasonNum - 1) * 3;
  const startsAt = new Date(Date.UTC(Number(y), startMonth, 1));
  const endsAt = new Date(Date.UTC(Number(y), startMonth + 3, 1));
  await db.insert(warSeasons).values({
    key,
    title: `Sezon wojen ${key}`,
    startsAt,
    endsAt,
    status: "open",
  });
  return key;
}

export async function getOrCreateTeamWarStats(teamId: string) {
  await ensureCriticalSchema();
  const seasonKey = await ensureWarSeason();
  const db = getDb();
  const [row] = await db
    .select()
    .from(teamWarStats)
    .where(eq(teamWarStats.teamId, teamId))
    .limit(1);
  if (row) {
    if (row.seasonKey !== seasonKey) {
      await db
        .update(teamWarStats)
        .set({ seasonKey, updatedAt: new Date() })
        .where(eq(teamWarStats.teamId, teamId));
      return { ...row, seasonKey };
    }
    return row;
  }
  await db.insert(teamWarStats).values({
    teamId,
    league: "bronze",
    lp: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    seasonKey,
  });
  return {
    teamId,
    league: "bronze" as WarLeague,
    lp: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    seasonKey,
    updatedAt: new Date(),
  };
}

export async function queueForWar(
  teamId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const live = await getLiveWarForTeam(teamId);
  if (live) return { ok: false, error: "Masz już aktywną wojnę." };

  const stats = await getOrCreateTeamWarStats(teamId);
  const db = getDb();
  const [existing] = await db
    .select()
    .from(teamWarQueue)
    .where(eq(teamWarQueue.teamId, teamId))
    .limit(1);

  if (existing?.status === "queued") {
    await tryMatchmake(teamId);
    return { ok: true };
  }

  if (existing) {
    await db
      .update(teamWarQueue)
      .set({
        league: stats.league,
        lp: stats.lp,
        queuedAt: new Date(),
        status: "queued",
      })
      .where(eq(teamWarQueue.teamId, teamId));
  } else {
    await db.insert(teamWarQueue).values({
      teamId,
      league: stats.league,
      lp: stats.lp,
      status: "queued",
    });
  }
  await tryMatchmake(teamId);
  return { ok: true };
}

export async function cancelWarQueue(teamId: string): Promise<void> {
  const db = getDb();
  await db
    .update(teamWarQueue)
    .set({ status: "cancelled" })
    .where(eq(teamWarQueue.teamId, teamId));
}

async function tryMatchmake(teamId: string): Promise<void> {
  const db = getDb();
  const [me] = await db
    .select()
    .from(teamWarQueue)
    .where(and(eq(teamWarQueue.teamId, teamId), eq(teamWarQueue.status, "queued")))
    .limit(1);
  if (!me) return;

  const waitMs = Date.now() - me.queuedAt.getTime();
  const band = waitMs > 24 * 3600_000 ? 9999 : waitMs > 12 * 3600_000 ? 150 : 80;

  const candidates = await db
    .select()
    .from(teamWarQueue)
    .where(
      and(
        eq(teamWarQueue.status, "queued"),
        eq(teamWarQueue.league, me.league),
        ne(teamWarQueue.teamId, teamId),
      ),
    );

  const opponent = candidates
    .filter((c) => Math.abs(c.lp - me.lp) <= band)
    .sort((a, b) => Math.abs(a.lp - me.lp) - Math.abs(b.lp - me.lp))[0];

  if (!opponent) return;

  const recent = await db
    .select()
    .from(wars)
    .where(
      or(
        and(eq(wars.teamAId, teamId), eq(wars.teamBId, opponent.teamId)),
        and(eq(wars.teamAId, opponent.teamId), eq(wars.teamBId, teamId)),
      ),
    )
    .orderBy(desc(wars.startsAt))
    .limit(1);
  if (
    recent[0] &&
    Date.now() - recent[0].startsAt.getTime() < 14 * 86_400_000
  ) {
    return;
  }

  const seasonKey = await ensureWarSeason();
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + WAR_DURATION_MS);
  const warId = crypto.randomUUID();

  await db.insert(wars).values({
    id: warId,
    seasonKey,
    teamAId: teamId,
    teamBId: opponent.teamId,
    startsAt,
    endsAt,
    status: "live",
  });

  await db
    .update(teamWarQueue)
    .set({ status: "matched" })
    .where(
      or(
        eq(teamWarQueue.teamId, teamId),
        eq(teamWarQueue.teamId, opponent.teamId),
      ),
    );

  try {
    const { notifyTeamMembers } = await import("@/lib/community/notifications");
    for (const tid of [teamId, opponent.teamId]) {
      await notifyTeamMembers({
        teamId: tid,
        kind: "ranking",
        title: "Wojna drużyn!",
        body: "Mecz 7 dni na Fair Competition Score — powodzenia!",
        href: "/community/wars",
        groupKey: `war:start:${warId}`,
        entityType: "war",
        entityId: warId,
      });
    }
  } catch {
    /* */
  }
}

export async function getLiveWarForTeam(teamId: string) {
  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .select()
    .from(wars)
    .where(
      and(
        eq(wars.status, "live"),
        or(eq(wars.teamAId, teamId), eq(wars.teamBId, teamId)),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function computeWarScores(warId: string): Promise<{
  scoreA: number;
  scoreB: number;
}> {
  const db = getDb();
  const [war] = await db.select().from(wars).where(eq(wars.id, warId)).limit(1);
  if (!war) return { scoreA: 0, scoreB: 0 };

  const [rankA, rankB] = await Promise.all([
    computeTeamFcsRanking(war.teamAId),
    computeTeamFcsRanking(war.teamBId),
  ]);
  const scoreA = meanActiveFcs(rankA.map((r) => r.score));
  const scoreB = meanActiveFcs(rankB.map((r) => r.score));

  await db
    .update(wars)
    .set({ scoreA, scoreB })
    .where(eq(wars.id, warId));

  return { scoreA, scoreB };
}

export async function finalizeWarIfDue(warId: string): Promise<boolean> {
  const db = getDb();
  const [war] = await db.select().from(wars).where(eq(wars.id, warId)).limit(1);
  if (!war || war.status !== "live") return false;
  if (Date.now() < war.endsAt.getTime()) {
    await computeWarScores(warId);
    return false;
  }

  const { scoreA, scoreB } = await computeWarScores(warId);
  const result = decideWarWinner(scoreA, scoreB);
  const winnerTeamId =
    result === "a" ? war.teamAId : result === "b" ? war.teamBId : null;

  // CAS: tylko jeden równoległy finalize stosuje LP (ADR 0011 §6).
  const cas = await db
    .update(wars)
    .set({
      status: "completed",
      winnerTeamId,
      scoreA,
      scoreB,
      summaryJson: JSON.stringify({ result, scoreA, scoreB }),
      completedAt: new Date(),
    })
    .where(and(eq(wars.id, warId), eq(wars.status, "live")));

  const affected =
    typeof cas === "object" && cas && "rowsAffected" in cas
      ? Number((cas as { rowsAffected: number }).rowsAffected)
      : 0;
  if (affected !== 1) return false;

  await applyWarResults(war.teamAId, war.teamBId, result);
  await grantWarRewards(war, result);
  return true;
}

async function applyWarResults(
  teamA: string,
  teamB: string,
  result: "a" | "b" | "draw",
) {
  const statsA = await getOrCreateTeamWarStats(teamA);
  const statsB = await getOrCreateTeamWarStats(teamB);
  const db = getDb();

  const patch = async (
    teamId: string,
    stats: typeof statsA,
    outcome: "win" | "loss" | "draw",
  ) => {
    const delta =
      outcome === "win" ? WAR_WIN_LP : outcome === "loss" ? -WAR_LOSS_LP : WAR_DRAW_LP;
    const next = applyLpDelta(stats.lp, delta);
    await db
      .update(teamWarStats)
      .set({
        lp: next.lp,
        league: next.league,
        wins: stats.wins + (outcome === "win" ? 1 : 0),
        losses: stats.losses + (outcome === "loss" ? 1 : 0),
        draws: stats.draws + (outcome === "draw" ? 1 : 0),
        updatedAt: new Date(),
      })
      .where(eq(teamWarStats.teamId, teamId));
  };

  if (result === "draw") {
    await patch(teamA, statsA, "draw");
    await patch(teamB, statsB, "draw");
  } else if (result === "a") {
    await patch(teamA, statsA, "win");
    await patch(teamB, statsB, "loss");
  } else {
    await patch(teamA, statsA, "loss");
    await patch(teamB, statsB, "win");
  }
}

async function grantWarRewards(
  war: typeof wars.$inferSelect,
  result: "a" | "b" | "draw",
) {
  const { awardProgressionXp } = await import("@/lib/community/progression");
  const db = getDb();
  for (const teamId of [war.teamAId, war.teamBId]) {
    const won =
      (result === "a" && teamId === war.teamAId) ||
      (result === "b" && teamId === war.teamBId);
    const members = await db
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId));
    for (const m of members) {
      await awardProgressionXp({
        userId: m.userId,
        teamId,
        amount: won ? 150 : result === "draw" ? 60 : 40,
        source: "team_war",
        sourceKey: `war:${war.id}:${teamId}:${m.userId}`,
      });
    }
  }
}

export async function getWarsHubData(userId: string) {
  await ensureCriticalSchema();
  const seasonKey = await ensureWarSeason();
  const db = getDb();

  const myTeams = await db
    .select({ teamId: teamMembers.teamId, name: teams.name })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, userId));

  const liveWars = [];
  for (const t of myTeams) {
    const war = await getLiveWarForTeam(t.teamId);
    if (war) {
      await finalizeWarIfDue(war.id);
      const fresh = await getLiveWarForTeam(t.teamId);
      if (fresh) {
        await computeWarScores(fresh.id);
        liveWars.push({ team: t, war: fresh });
      }
    }
  }

  const standings = await db
    .select({
      teamId: teamWarStats.teamId,
      league: teamWarStats.league,
      lp: teamWarStats.lp,
      wins: teamWarStats.wins,
      losses: teamWarStats.losses,
      draws: teamWarStats.draws,
      name: teams.name,
    })
    .from(teamWarStats)
    .innerJoin(teams, eq(teamWarStats.teamId, teams.id))
    .where(eq(teamWarStats.seasonKey, seasonKey))
    .orderBy(desc(teamWarStats.lp))
    .limit(50);

  const recent = await db
    .select()
    .from(wars)
    .where(eq(wars.status, "completed"))
    .orderBy(desc(wars.completedAt))
    .limit(15);

  const queues = [];
  for (const t of myTeams) {
    const [q] = await db
      .select()
      .from(teamWarQueue)
      .where(
        and(eq(teamWarQueue.teamId, t.teamId), eq(teamWarQueue.status, "queued")),
      )
      .limit(1);
    const stats = await getOrCreateTeamWarStats(t.teamId);
    queues.push({ team: t, queued: Boolean(q), stats });
  }

  return {
    seasonKey,
    myTeams,
    liveWars,
    standings,
    recent,
    queues,
  };
}

/** Lekka karta ligi na hubie grupy — bez pełnego standings (ADR 0011 §8 US-11). */
export async function getMyTeamWarSummary(teamId: string): Promise<{
  league: WarLeague;
  lp: number;
  wins: number;
  losses: number;
  draws: number;
  seasonKey: string;
  hasPlayed: boolean;
  liveWarId: string | null;
}> {
  await ensureCriticalSchema();
  const stats = await getOrCreateTeamWarStats(teamId);
  const live = await getLiveWarForTeam(teamId);
  if (live) await finalizeWarIfDue(live.id);
  const fresh = await getLiveWarForTeam(teamId);
  return {
    league: leagueFromLp(stats.lp),
    lp: stats.lp,
    wins: stats.wins,
    losses: stats.losses,
    draws: stats.draws,
    seasonKey: stats.seasonKey,
    hasPlayed: stats.wins + stats.losses + stats.draws > 0,
    liveWarId: fresh?.id ?? null,
  };
}

export { leagueFromLp };
