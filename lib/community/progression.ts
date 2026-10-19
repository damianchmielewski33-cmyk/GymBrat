import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import {
  communityXp,
  progressionXpLedger,
  teamXp,
  userBadges,
  userCommunityXp,
  userCosmetics,
  userSeasonXp,
} from "@/db/schema";
import { gymbratSeasonKey } from "@/lib/community/hof-periods";
import {
  COMMUNITY_MAX_LEVEL,
  PRESTIGE_MAX,
  SEASON_MAX_LEVEL,
  TEAM_MAX_LEVEL,
  USER_MAX_LEVEL,
  levelFromXp,
  progressInLevel,
  xpNeedForLevel,
} from "@/lib/community/progression-curve";
import {
  rewardsUnlockedBetween,
  TEAM_LEVEL_REWARDS,
  USER_LEVEL_REWARDS,
} from "@/lib/community/progression-rewards";
import {
  PRESTIGE_META,
  type UserProgressionView,
} from "@/lib/community/progression-types";
import { calendarDateKey } from "@/lib/local-date";

export {
  xpLevelFromTotal,
  xpProgressInLevel,
} from "@/lib/community/progression-curve";

const COMMUNITY_ID = "global";

export type AwardProgressionInput = {
  userId?: string | null;
  teamId?: string | null;
  amount: number;
  source: string;
  sourceKey: string;
  /** Gdy true — nie sypie community track. */
  skipCommunity?: boolean;
};

export async function awardProgressionXp(
  input: AwardProgressionInput,
): Promise<void> {
  const amount = Math.max(0, Math.floor(input.amount));
  if (amount <= 0) return;
  await ensureCriticalSchema();
  const db = getDb();
  const seasonKey = gymbratSeasonKey(calendarDateKey());

  const tracks: Array<{
    track: string;
    amount: number;
    sourceKey: string;
    userId?: string | null;
    teamId?: string | null;
  }> = [];

  if (input.userId) {
    tracks.push({
      track: "user",
      amount,
      sourceKey: `user:${input.sourceKey}`,
      userId: input.userId,
    });
    tracks.push({
      track: "season",
      amount,
      sourceKey: `season:${seasonKey}:${input.sourceKey}`,
      userId: input.userId,
    });
  }
  if (input.teamId) {
    tracks.push({
      track: "team",
      amount: Math.max(1, Math.round(amount * 0.3)),
      sourceKey: `team:${input.sourceKey}`,
      teamId: input.teamId,
      userId: input.userId,
    });
  }
  if (!input.skipCommunity) {
    tracks.push({
      track: "community",
      amount: Math.max(1, Math.round(amount * 0.05)),
      sourceKey: `community:${input.sourceKey}`,
      userId: input.userId,
      teamId: input.teamId,
    });
  }

  for (const t of tracks) {
    try {
      await db.insert(progressionXpLedger).values({
        userId: t.userId ?? null,
        teamId: t.teamId ?? null,
        track: t.track,
        amount: t.amount,
        source: input.source,
        sourceKey: t.sourceKey,
        seasonKey: t.track === "season" ? seasonKey : null,
      });
    } catch {
      continue; // idempotent
    }

    if (t.track === "user" && t.userId) {
      await creditUserXp(t.userId, t.amount);
    } else if (t.track === "season" && t.userId) {
      await creditSeasonXp(t.userId, seasonKey, t.amount);
    } else if (t.track === "team" && t.teamId) {
      await creditTeamXp(t.teamId, t.amount);
    } else if (t.track === "community") {
      await creditCommunityXp(t.amount);
    }
  }
}

async function creditUserXp(userId: string, amount: number) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(userCommunityXp)
    .where(eq(userCommunityXp.userId, userId))
    .limit(1);
  const prevXp = row?.xpTotal ?? 0;
  const prevLevel = row?.level ?? 1;
  const nextXp = prevXp + amount;
  const nextLevel = Math.min(
    USER_MAX_LEVEL,
    levelFromXp(nextXp, USER_MAX_LEVEL, 100),
  );
  if (row) {
    await db
      .update(userCommunityXp)
      .set({
        xpTotal: nextXp,
        level: nextLevel,
        prestigeXpLifetime: (row.prestigeXpLifetime ?? 0) + amount,
        updatedAt: new Date(),
      })
      .where(eq(userCommunityXp.userId, userId));
  } else {
    await db.insert(userCommunityXp).values({
      userId,
      xpTotal: nextXp,
      level: nextLevel,
      prestige: 0,
      prestigeXpLifetime: amount,
    });
  }
  for (const reward of rewardsUnlockedBetween(
    USER_LEVEL_REWARDS,
    prevLevel,
    nextLevel,
  )) {
    try {
      await db.insert(userBadges).values({
        userId,
        badgeKey: reward.badgeKey,
        title: reward.badgeTitle,
        emoji: reward.emoji,
      });
    } catch {
      /* */
    }
    if (reward.cosmeticKey) {
      try {
        await db.insert(userCosmetics).values({
          userId,
          cosmeticKey: reward.cosmeticKey,
        });
      } catch {
        /* */
      }
    }
  }
}

async function creditSeasonXp(
  userId: string,
  seasonKey: string,
  amount: number,
) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(userSeasonXp)
    .where(
      and(
        eq(userSeasonXp.userId, userId),
        eq(userSeasonXp.seasonKey, seasonKey),
      ),
    )
    .limit(1);
  const nextXp = (row?.xpTotal ?? 0) + amount;
  const nextLevel = levelFromXp(nextXp, SEASON_MAX_LEVEL, 80);
  if (row) {
    await db
      .update(userSeasonXp)
      .set({ xpTotal: nextXp, level: nextLevel })
      .where(
        and(
          eq(userSeasonXp.userId, userId),
          eq(userSeasonXp.seasonKey, seasonKey),
        ),
      );
  } else {
    await db.insert(userSeasonXp).values({
      userId,
      seasonKey,
      xpTotal: nextXp,
      level: nextLevel,
    });
  }
}

async function creditTeamXp(teamId: string, amount: number) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(teamXp)
    .where(eq(teamXp.teamId, teamId))
    .limit(1);
  const prevLevel = row?.level ?? 1;
  const nextXp = (row?.xpTotal ?? 0) + amount;
  const nextLevel = levelFromXp(nextXp, TEAM_MAX_LEVEL, 200);
  if (row) {
    await db
      .update(teamXp)
      .set({ xpTotal: nextXp, level: nextLevel, updatedAt: new Date() })
      .where(eq(teamXp.teamId, teamId));
  } else {
    await db.insert(teamXp).values({
      teamId,
      xpTotal: nextXp,
      level: nextLevel,
    });
  }
  void prevLevel;
  void TEAM_LEVEL_REWARDS;
}

async function creditCommunityXp(amount: number) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(communityXp)
    .where(eq(communityXp.id, COMMUNITY_ID))
    .limit(1);
  const nextXp = (row?.xpTotal ?? 0) + amount;
  const nextLevel = levelFromXp(nextXp, COMMUNITY_MAX_LEVEL, 5000);
  if (row) {
    await db
      .update(communityXp)
      .set({ xpTotal: nextXp, level: nextLevel, updatedAt: new Date() })
      .where(eq(communityXp.id, COMMUNITY_ID));
  } else {
    await db.insert(communityXp).values({
      id: COMMUNITY_ID,
      xpTotal: nextXp,
      level: nextLevel,
    });
  }
}

export async function prestigeUp(userId: string): Promise<
  | { ok: true; prestige: number }
  | { ok: false; error: string }
> {
  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .select()
    .from(userCommunityXp)
    .where(eq(userCommunityXp.userId, userId))
    .limit(1);
  if (!row) return { ok: false, error: "Brak postępu XP." };
  if (row.level < USER_MAX_LEVEL) {
    return { ok: false, error: "Najpierw osiągnij poziom 50." };
  }
  if ((row.prestige ?? 0) >= PRESTIGE_MAX) {
    return { ok: false, error: "Prestige V to maksimum." };
  }
  const next = (row.prestige ?? 0) + 1;
  const meta = PRESTIGE_META[next]!;
  await db
    .update(userCommunityXp)
    .set({
      prestige: next,
      xpTotal: 0,
      level: 1,
      auraKey: meta.auraKey,
      frameKey: meta.frameKey,
      titleKey: `prestige_${next}`,
      updatedAt: new Date(),
    })
    .where(eq(userCommunityXp.userId, userId));
  try {
    await db.insert(userBadges).values({
      userId,
      badgeKey: `prestige_${next}`,
      title: meta.label,
      emoji: "✨",
    });
  } catch {
    /* */
  }
  try {
    await db.insert(userCosmetics).values({
      userId,
      cosmeticKey: meta.auraKey,
    });
  } catch {
    /* */
  }
  return { ok: true, prestige: next };
}

export async function getUserProgressionView(
  userId: string,
): Promise<UserProgressionView> {
  await ensureCriticalSchema();
  const db = getDb();
  const seasonKey = gymbratSeasonKey(calendarDateKey());
  const [row] = await db
    .select()
    .from(userCommunityXp)
    .where(eq(userCommunityXp.userId, userId))
    .limit(1);
  const [season] = await db
    .select()
    .from(userSeasonXp)
    .where(
      and(
        eq(userSeasonXp.userId, userId),
        eq(userSeasonXp.seasonKey, seasonKey),
      ),
    )
    .limit(1);

  const xp = row?.xpTotal ?? 0;
  const prestige = row?.prestige ?? 0;
  const prog = progressInLevel(xp, USER_MAX_LEVEL, 100);
  const seasonProg = progressInLevel(
    season?.xpTotal ?? 0,
    SEASON_MAX_LEVEL,
    80,
  );
  const meta = prestige > 0 ? PRESTIGE_META[prestige] : null;

  return {
    xpTotal: xp,
    level: Math.min(USER_MAX_LEVEL, row?.level ?? prog.level),
    prestige,
    prestigeLabel: meta?.label ?? null,
    intoLevel: prog.intoLevel,
    needForNext: prog.needForNext,
    pct: prog.pct,
    canPrestige: prog.level >= USER_MAX_LEVEL && prestige < PRESTIGE_MAX,
    frameKey: row?.frameKey ?? null,
    auraKey: row?.auraKey ?? null,
    titleKey: row?.titleKey ?? null,
    seasonLevel: season?.level ?? seasonProg.level,
    seasonXp: season?.xpTotal ?? 0,
    seasonPct: seasonProg.pct,
  };
}

export async function getCommunityLevel(): Promise<{
  level: number;
  xpTotal: number;
  pct: number;
}> {
  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .select()
    .from(communityXp)
    .where(eq(communityXp.id, COMMUNITY_ID))
    .limit(1);
  const xp = row?.xpTotal ?? 0;
  const prog = progressInLevel(xp, COMMUNITY_MAX_LEVEL, 5000);
  return { level: prog.level, xpTotal: xp, pct: prog.pct };
}

export { xpNeedForLevel, USER_MAX_LEVEL, PRESTIGE_MAX };
