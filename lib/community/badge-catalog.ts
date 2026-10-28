/**
 * Katalog odznak z progresem i rzadkością (globalny cache) — ADR 0011 §4.1 / §9, LR-T12.
 */

import "server-only";

import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { badgeDefinitions, userBadges } from "@/db/schema";
import { CHALLENGE_TEMPLATES } from "@/lib/community/challenge-types";
import { HOF_CATEGORIES, HOF_CATEGORY_META } from "@/lib/community/hof-types";
import {
  TEAM_LEVEL_REWARDS,
  USER_LEVEL_REWARDS,
} from "@/lib/community/progression-rewards";
import { TEAM_QUEST_TEMPLATES } from "@/lib/community/team-quest-types";

/** LR-T12: próg N ≥ 50 zdobywców globalnie zanim pokażemy %. */
export const BADGE_RARITY_MIN_HOLDERS = 50;
const RARITY_TTL_MS = 6 * 60 * 60 * 1000;

export type BadgeCategory =
  | "challenge"
  | "team_quest"
  | "progression"
  | "hof"
  | "streak";

export type BadgeCatalogItem = {
  definitionKey: string;
  category: BadgeCategory;
  title: string;
  emoji: string;
  description: string | null;
  targetValue: number | null;
  unitLabel: string | null;
  unlocked: boolean;
  unlockedAt: string | null;
  /** Progres do celu (gdy zablokowana i da się policzyć) — null gdy nieznany. */
  progress: number | null;
  rarityPct: number | null;
  uncatalogued?: boolean;
};

export type BadgeCatalogView = {
  items: BadgeCatalogItem[];
  unlockedCount: number;
  totalCount: number;
  suggestedKey: string | null;
};

type SeedDef = {
  key: string;
  category: BadgeCategory;
  title: string;
  emoji: string;
  description: string;
  targetValue: number | null;
  unitLabel: string | null;
  isRepeatable: number;
};

function catalogSeeds(): SeedDef[] {
  const out: SeedDef[] = [];
  for (const t of CHALLENGE_TEMPLATES) {
    out.push({
      key: t.rewardBadgeKey,
      category: "challenge",
      title: t.rewardTitle,
      emoji: t.emoji,
      description: t.description,
      targetValue: t.targetValue,
      unitLabel: t.unitLabel,
      isRepeatable: 0,
    });
  }
  for (const t of TEAM_QUEST_TEMPLATES) {
    out.push({
      key: `quest_template:${t.key}`,
      category: "team_quest",
      title: t.rewardTitle,
      emoji: t.emoji,
      description: t.description,
      targetValue: t.targetValue,
      unitLabel: t.unitLabel,
      isRepeatable: 1,
    });
  }
  for (const r of [...USER_LEVEL_REWARDS, ...TEAM_LEVEL_REWARDS]) {
    out.push({
      key: r.badgeKey,
      category: "progression",
      title: r.badgeTitle,
      emoji: r.emoji,
      description: `Odblokuj na poziomie ${r.level}.`,
      targetValue: r.level,
      unitLabel: "poziom",
      isRepeatable: 0,
    });
  }
  for (const cat of HOF_CATEGORIES) {
    const meta = HOF_CATEGORY_META[cat];
    out.push({
      key: `hof:${cat}`,
      category: "hof",
      title: meta.label,
      emoji: meta.emoji,
      description: meta.description,
      targetValue: null,
      unitLabel: null,
      isRepeatable: 0,
    });
  }
  out.push({
    key: "badge_first_workout",
    category: "streak",
    title: "Pierwszy trening",
    emoji: "🌱",
    description: "Zapisz swój pierwszy trening w aplikacji.",
    targetValue: 1,
    unitLabel: "trening",
    isRepeatable: 0,
  });
  return out;
}

export async function ensureBadgeDefinitionsSeeded(): Promise<void> {
  await ensureCriticalSchema();
  const db = getDb();
  const now = new Date();
  for (const s of catalogSeeds()) {
    try {
      await db
        .insert(badgeDefinitions)
        .values({
          key: s.key,
          category: s.category,
          title: s.title,
          emoji: s.emoji,
          description: s.description,
          targetValue: s.targetValue,
          unitLabel: s.unitLabel,
          isRepeatable: s.isRepeatable,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: badgeDefinitions.key,
          set: {
            category: s.category,
            title: s.title,
            emoji: s.emoji,
            description: s.description,
            targetValue: s.targetValue,
            unitLabel: s.unitLabel,
            isRepeatable: s.isRepeatable,
          },
        });
    } catch {
      /* best-effort seed */
    }
  }
}

async function refreshRarityIfStale(definitionKey: string): Promise<number | null> {
  const db = getDb();
  const [def] = await db
    .select()
    .from(badgeDefinitions)
    .where(eq(badgeDefinitions.key, definitionKey))
    .limit(1);
  if (!def) return null;
  const updatedAt = def.rarityCacheUpdatedAt?.getTime() ?? 0;
  if (
    def.rarityCachePct != null &&
    Date.now() - updatedAt < RARITY_TTL_MS
  ) {
    return def.rarityCachePct;
  }

  const [holdersRow] = await db
    .select({
      n: sql<number>`count(distinct ${userBadges.userId})`,
    })
    .from(userBadges)
    .where(eq(userBadges.definitionKey, definitionKey));
  const holders = Number(holdersRow?.n ?? 0);

  const [usersRow] = await db.select({
    n: sql<number>`count(distinct ${userBadges.userId})`,
  }).from(userBadges);
  const totalUsersWithBadges = Math.max(1, Number(usersRow?.n ?? 0));

  const pct =
    holders >= BADGE_RARITY_MIN_HOLDERS
      ? Math.round((holders / totalUsersWithBadges) * 1000) / 10
      : null;

  await db
    .update(badgeDefinitions)
    .set({
      rarityCachePct: pct,
      rarityCacheUpdatedAt: new Date(),
    })
    .where(eq(badgeDefinitions.key, definitionKey));

  return pct;
}

export async function getBadgeCatalogForUser(
  userId: string,
): Promise<BadgeCatalogView> {
  await ensureBadgeDefinitionsSeeded();
  const db = getDb();

  const defs = await db.select().from(badgeDefinitions);
  const owned = await db
    .select()
    .from(userBadges)
    .where(eq(userBadges.userId, userId));

  const ownedByDef = new Map<string, (typeof owned)[number]>();
  const uncatalogued: BadgeCatalogItem[] = [];
  for (const b of owned) {
    const defKey =
      b.definitionKey ??
      (b.badgeKey.startsWith("quest_")
        ? null
        : defs.some((d) => d.key === b.badgeKey)
          ? b.badgeKey
          : null);
    if (defKey) {
      if (!ownedByDef.has(defKey)) ownedByDef.set(defKey, b);
    } else {
      uncatalogued.push({
        definitionKey: b.badgeKey,
        category: "challenge",
        title: b.title,
        emoji: b.emoji,
        description: null,
        targetValue: null,
        unitLabel: null,
        unlocked: true,
        unlockedAt: b.unlockedAt.toISOString(),
        progress: null,
        rarityPct: null,
        uncatalogued: true,
      });
    }
  }

  const items: BadgeCatalogItem[] = [];
  for (const d of defs) {
    const own = ownedByDef.get(d.key);
    const rarityPct = await refreshRarityIfStale(d.key);
    items.push({
      definitionKey: d.key,
      category: d.category as BadgeCategory,
      title: d.title,
      emoji: d.emoji,
      description: d.description,
      targetValue: d.targetValue,
      unitLabel: d.unitLabel,
      unlocked: Boolean(own),
      unlockedAt: own ? own.unlockedAt.toISOString() : null,
      progress: own ? (d.targetValue ?? null) : 0,
      rarityPct,
    });
  }

  items.push(...uncatalogued);
  items.sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    return a.title.localeCompare(b.title, "pl");
  });

  const unlockedCount = items.filter((i) => i.unlocked).length;
  const suggested =
    items.find((i) => !i.unlocked && i.definitionKey === "badge_first_workout") ??
    items.find((i) => !i.unlocked) ??
    null;

  return {
    items,
    unlockedCount,
    totalCount: items.length,
    suggestedKey: suggested?.definitionKey ?? null,
  };
}
