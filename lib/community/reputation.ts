/**
 * Reputation System — status społeczny Community.
 *
 * RP (Reputation Points) ≠ Challenge XP.
 * Tier: Bronze → Silver → Gold → Platinum → Diamond → Legend
 *
 * Źródła: help, replies, comments, activity, live, challenge, achievements
 * Anty-farm: unikalny sourceKey + dzienne capy per kind.
 */

import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import {
  userBadges,
  userReputation,
  userReputationEvents,
} from "@/db/schema";

export const REPUTATION_TIERS = [
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond",
  "legend",
] as const;

export type ReputationTier = (typeof REPUTATION_TIERS)[number];

export type ReputationKind =
  | "help_reaction"
  | "help_comment"
  | "reply"
  | "comment"
  | "activity_post"
  | "live_join"
  | "challenge"
  | "achievement";

/** Progi cumulative RP. */
export const REPUTATION_THRESHOLDS: Record<ReputationTier, number> = {
  bronze: 0,
  silver: 100,
  gold: 300,
  platinum: 700,
  diamond: 1500,
  legend: 3500,
};

export const REPUTATION_POINTS: Record<ReputationKind, number> = {
  help_reaction: 3,
  help_comment: 8,
  reply: 5,
  comment: 4,
  activity_post: 6,
  live_join: 12,
  challenge: 40,
  achievement: 25,
};

/** Max zdarzeń punktowanych / dzień / kind (UTC day). */
export const REPUTATION_DAILY_CAPS: Partial<Record<ReputationKind, number>> = {
  help_reaction: 15,
  help_comment: 12,
  reply: 20,
  comment: 20,
  activity_post: 8,
  live_join: 5,
  challenge: 10,
  achievement: 10,
};

export const REPUTATION_TIER_META: Record<
  ReputationTier,
  {
    label: string;
    /** Klasy Tailwind / CSS variables dla pilli i ringów. */
    pillClass: string;
    ringClass: string;
    textClass: string;
    exclusive: string;
  }
> = {
  bronze: {
    label: "Bronze",
    pillClass: "border-amber-700/50 bg-amber-900/35 text-amber-200",
    ringClass: "ring-amber-700/55",
    textClass: "text-amber-200",
    exclusive: "Początek drogi społeczności",
  },
  silver: {
    label: "Silver",
    pillClass: "border-slate-300/40 bg-slate-400/20 text-slate-100",
    ringClass: "ring-slate-300/50",
    textClass: "text-slate-200",
    exclusive: "Aktywny członek zespołu",
  },
  gold: {
    label: "Gold",
    pillClass:
      "border-[var(--gym-gold)]/45 bg-[var(--gym-gold)]/15 text-[var(--gym-gold)]",
    ringClass: "ring-[var(--gym-gold)]/55",
    textClass: "text-[var(--gym-gold)]",
    exclusive: "Złoty status · wyróżniony w feedzie",
  },
  platinum: {
    label: "Platinum",
    pillClass: "border-cyan-300/45 bg-cyan-400/15 text-cyan-100",
    ringClass: "ring-cyan-300/50",
    textClass: "text-cyan-200",
    exclusive: "Platyna · priorytet w rankingu social",
  },
  diamond: {
    label: "Diamond",
    pillClass: "border-sky-200/50 bg-sky-300/15 text-sky-100",
    ringClass: "ring-sky-200/60",
    textClass: "text-sky-100",
    exclusive: "Diament · ekskluzywna ramka profilu",
  },
  legend: {
    label: "Legend",
    pillClass:
      "border-[var(--neon)]/50 bg-[var(--neon)]/15 text-[var(--neon)]",
    ringClass: "ring-[var(--neon)]/60",
    textClass: "text-[var(--neon)]",
    exclusive: "Legenda Community · najwyższy status",
  },
};

export type ReputationPublic = {
  points: number;
  tier: ReputationTier;
  label: string;
  exclusive: string;
  nextTier: ReputationTier | null;
  pointsToNext: number | null;
  progressToNext: number;
};

export function tierFromPoints(points: number): ReputationTier {
  const p = Math.max(0, Math.floor(points));
  if (p >= REPUTATION_THRESHOLDS.legend) return "legend";
  if (p >= REPUTATION_THRESHOLDS.diamond) return "diamond";
  if (p >= REPUTATION_THRESHOLDS.platinum) return "platinum";
  if (p >= REPUTATION_THRESHOLDS.gold) return "gold";
  if (p >= REPUTATION_THRESHOLDS.silver) return "silver";
  return "bronze";
}

export function nextTierAfter(tier: ReputationTier): ReputationTier | null {
  const i = REPUTATION_TIERS.indexOf(tier);
  if (i < 0 || i >= REPUTATION_TIERS.length - 1) return null;
  return REPUTATION_TIERS[i + 1]!;
}

export function toReputationPublic(points: number): ReputationPublic {
  const tier = tierFromPoints(points);
  const meta = REPUTATION_TIER_META[tier];
  const next = nextTierAfter(tier);
  if (!next) {
    return {
      points,
      tier,
      label: meta.label,
      exclusive: meta.exclusive,
      nextTier: null,
      pointsToNext: null,
      progressToNext: 1,
    };
  }
  const curTh = REPUTATION_THRESHOLDS[tier];
  const nextTh = REPUTATION_THRESHOLDS[next];
  const span = Math.max(1, nextTh - curTh);
  const progressToNext = Math.max(
    0,
    Math.min(1, (points - curTh) / span),
  );
  return {
    points,
    tier,
    label: meta.label,
    exclusive: meta.exclusive,
    nextTier: next,
    pointsToNext: Math.max(0, nextTh - points),
    progressToNext,
  };
}

function utcDayStart(): Date {
  const d = new Date();
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0),
  );
}

export type AwardReputationResult =
  | { ok: true; awarded: number; points: number; tier: ReputationTier; tierUp: boolean }
  | { ok: false; reason: "duplicate" | "cap" | "zero" | "error"; points?: number };

/**
 * Przyznaje RP idempotentnie (sourceKey UNIQUE).
 * Nie rzuca — błędy logowane, żeby nie psuć feedu.
 */
export async function awardReputation(input: {
  userId: string;
  kind: ReputationKind;
  sourceKey: string;
  teamId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<AwardReputationResult> {
  try {
    await ensureCriticalSchema();
    const pointsDelta = REPUTATION_POINTS[input.kind] ?? 0;
    if (pointsDelta <= 0 || !input.userId || !input.sourceKey.trim()) {
      return { ok: false, reason: "zero" };
    }

    const db = getDb();
    const [dup] = await db
      .select({ id: userReputationEvents.id })
      .from(userReputationEvents)
      .where(eq(userReputationEvents.sourceKey, input.sourceKey.trim()))
      .limit(1);
    if (dup) return { ok: false, reason: "duplicate" };

    const cap = REPUTATION_DAILY_CAPS[input.kind];
    if (cap != null) {
      const dayStart = utcDayStart();
      const [{ c }] = await db
        .select({ c: sql<number>`count(*)` })
        .from(userReputationEvents)
        .where(
          and(
            eq(userReputationEvents.userId, input.userId),
            eq(userReputationEvents.kind, input.kind),
            gte(userReputationEvents.createdAt, dayStart),
          ),
        );
      if (Number(c) >= cap) return { ok: false, reason: "cap" };
    }

    const [row] = await db
      .select()
      .from(userReputation)
      .where(eq(userReputation.userId, input.userId))
      .limit(1);

    const prevPoints = row?.points ?? 0;
    const prevTier = (row?.tier as ReputationTier) || tierFromPoints(prevPoints);
    const nextPoints = prevPoints + pointsDelta;
    const nextTier = tierFromPoints(nextPoints);
    const now = new Date();

    await db.insert(userReputationEvents).values({
      id: crypto.randomUUID(),
      userId: input.userId,
      kind: input.kind,
      points: pointsDelta,
      sourceKey: input.sourceKey.trim(),
      teamId: input.teamId ?? null,
      metaJson: JSON.stringify(input.meta ?? {}),
      createdAt: now,
    });

    if (row) {
      await db
        .update(userReputation)
        .set({ points: nextPoints, tier: nextTier, updatedAt: now })
        .where(eq(userReputation.userId, input.userId));
    } else {
      await db.insert(userReputation).values({
        userId: input.userId,
        points: nextPoints,
        tier: nextTier,
        updatedAt: now,
      });
    }

    const tierUp = nextTier !== prevTier || !row;
    if (tierUp || (!row && nextPoints > 0)) {
      await unlockTierBadge(input.userId, nextTier);
    }

    return {
      ok: true,
      awarded: pointsDelta,
      points: nextPoints,
      tier: nextTier,
      tierUp,
    };
  } catch (e) {
    console.warn(
      "[reputation]",
      e instanceof Error ? e.message : e,
    );
    return { ok: false, reason: "error" };
  }
}

async function unlockTierBadge(userId: string, tier: ReputationTier) {
  const db = getDb();
  const badgeKey = `rep_${tier}`;
  const meta = REPUTATION_TIER_META[tier];
  const [has] = await db
    .select({ id: userBadges.id })
    .from(userBadges)
    .where(
      and(eq(userBadges.userId, userId), eq(userBadges.badgeKey, badgeKey)),
    )
    .limit(1);
  if (has) return;
  const emoji =
    tier === "legend"
      ? "👑"
      : tier === "diamond"
        ? "💎"
        : tier === "platinum"
          ? "🔷"
          : tier === "gold"
            ? "🥇"
            : tier === "silver"
              ? "🥈"
              : "🥉";
  await db.insert(userBadges).values({
    id: crypto.randomUUID(),
    userId,
    badgeKey,
    title: `Reputacja ${meta.label}`,
    emoji,
    challengeId: null,
    unlockedAt: new Date(),
  });
}

export async function getUserReputation(
  userId: string,
): Promise<ReputationPublic> {
  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .select({ points: userReputation.points })
    .from(userReputation)
    .where(eq(userReputation.userId, userId))
    .limit(1);
  return toReputationPublic(row?.points ?? 0);
}

export async function getReputationMap(
  userIds: string[],
): Promise<Map<string, ReputationPublic>> {
  const map = new Map<string, ReputationPublic>();
  const unique = [...new Set(userIds.filter(Boolean))];
  for (const id of unique) map.set(id, toReputationPublic(0));
  if (unique.length === 0) return map;

  await ensureCriticalSchema();
  const db = getDb();
  const { inArray } = await import("drizzle-orm");
  const rows = await db
    .select({
      userId: userReputation.userId,
      points: userReputation.points,
    })
    .from(userReputation)
    .where(inArray(userReputation.userId, unique));

  for (const r of rows) {
    map.set(r.userId, toReputationPublic(r.points));
  }
  return map;
}
