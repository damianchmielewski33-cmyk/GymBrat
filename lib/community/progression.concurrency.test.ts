import type { Client } from "@libsql/client";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import {
  communityXp,
  progressionXpLedger,
  teams,
  teamXp,
  userCommunityXp,
  users,
  userSeasonXp,
} from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";
import {
  awardProgressionXp,
  prestigeUp,
  USER_MAX_LEVEL,
} from "@/lib/community/progression";
import { levelFromXp } from "@/lib/community/progression-curve";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", () => ({ getDb: () => state.db }));
vi.mock("@/db/ensure-schema", () => ({
  ensureCriticalSchema: async () => {},
}));

describe("Z72: współbieżne XP (baza w pamięci)", () => {
  let client: Client;
  let db: Database;

  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
    state.db = db;
    await db.insert(users).values([
      { id: "u1", email: "u1@t.pl", passwordHash: "x" },
      { id: "u2", email: "u2@t.pl", passwordHash: "x" },
    ]);
    await db.insert(teams).values({
      id: "t1",
      ownerUserId: "u1",
      name: "Team",
      inviteCode: "ABC123",
    });
  });

  afterAll(() => client.close());

  it("równoległe nagrody sumują się bez gubienia XP na wszystkich torach", async () => {
    const n = 20;
    await Promise.all(
      Array.from({ length: n }, (_, i) =>
        awardProgressionXp({
          userId: "u1",
          teamId: "t1",
          amount: 100,
          source: "test",
          sourceKey: `par:${i}`,
        }),
      ),
    );
    const [user] = await db
      .select()
      .from(userCommunityXp)
      .where(eq(userCommunityXp.userId, "u1"));
    expect(user?.xpTotal).toBe(n * 100);
    expect(user?.level).toBe(Math.min(USER_MAX_LEVEL, levelFromXp(n * 100, USER_MAX_LEVEL, 100)));
    const seasons = await db.select().from(userSeasonXp).where(eq(userSeasonXp.userId, "u1"));
    expect(seasons.reduce((a, r) => a + r.xpTotal, 0)).toBe(n * 100);
    const [team] = await db.select().from(teamXp).where(eq(teamXp.teamId, "t1"));
    expect(team?.xpTotal).toBe(n * 30);
    const [community] = await db.select().from(communityXp);
    expect(community?.xpTotal).toBe(n * 5);
  });

  it("ten sam sourceKey wysłany równolegle jest przyznany raz", async () => {
    await Promise.all(
      Array.from({ length: 10 }, () =>
        awardProgressionXp({
          userId: "u2",
          amount: 50,
          source: "test",
          sourceKey: "dup:workout-1",
          skipCommunity: true,
        }),
      ),
    );
    const [user] = await db
      .select()
      .from(userCommunityXp)
      .where(eq(userCommunityXp.userId, "u2"));
    expect(user?.xpTotal).toBe(50);
    const ledger = await db
      .select()
      .from(progressionXpLedger)
      .where(eq(progressionXpLedger.userId, "u2"));
    expect(ledger.filter((r) => r.track === "user")).toHaveLength(1);
  });

  it("prestigeUp wykonuje się raz przy równoległych wywołaniach", async () => {
    await db
      .update(userCommunityXp)
      .set({ level: USER_MAX_LEVEL, xpTotal: 999_999 })
      .where(eq(userCommunityXp.userId, "u1"));
    const results = await Promise.all(
      Array.from({ length: 5 }, () => prestigeUp("u1")),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const [user] = await db
      .select()
      .from(userCommunityXp)
      .where(eq(userCommunityXp.userId, "u1"));
    expect(user?.prestige).toBe(1);
  });
});
