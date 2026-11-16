import type { Client } from "@libsql/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createMemoryDb } from "@/db/test-memory-db";
import { consumeBudget, monthKey, monthlyLimit } from "@/lib/gym-partner/budget";
import { parseDetails } from "@/lib/gym-partner/places";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", () => ({ getDb: () => state.db }));
vi.mock("@/db/ensure-schema", () => ({ ensureCriticalSchema: async () => {} }));

describe("budżet miesięczny Google", () => {
  let client: Client;
  beforeAll(async () => {
    const m = await createMemoryDb();
    client = m.client;
    state.db = m.db;
  });
  afterAll(() => client.close());

  it("domyślne limity i klucz miesiąca", () => {
    expect(monthlyLimit("details", {})).toBe(900);
    expect(monthlyLimit("list", { GYM_PLACES_MONTHLY_LIST_LIMIT: "10" })).toBe(10);
    expect(monthlyLimit("map", { GYM_MAPS_MONTHLY_LOAD_LIMIT: "x" })).toBe(9000);
    expect(monthKey("list", new Date("2026-11-16T10:00:00Z"))).toBe("gym-list:2026-11");
  });

  it("odmawia po wyczerpaniu limitu (atomowo)", async () => {
    vi.stubEnv("GYM_PLACES_MONTHLY_DETAILS_LIMIT", "3");
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await consumeBudget("details"));
    expect(results).toEqual([true, true, true, false, false]);
    vi.unstubAllEnvs();
  });

  it("limit 0 wyłącza funkcję", async () => {
    vi.stubEnv("GYM_PLACES_MONTHLY_LIST_LIMIT", "0");
    expect(await consumeBudget("list")).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("parseDetails", () => {
  it("godziny i bezpieczny URL", () => {
    const d = parseDetails({
      websiteUri: "https://zdrofit.pl",
      regularOpeningHours: { openNow: false, weekdayDescriptions: ["pon: 6–22"] },
    });
    expect(d).toEqual({ website: "https://zdrofit.pl/", openNow: false, hours: ["pon: 6–22"] });
    expect(parseDetails({ websiteUri: "javascript:1" }).website).toBeNull();
  });
});
