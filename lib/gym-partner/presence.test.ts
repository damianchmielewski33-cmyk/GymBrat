import type { Client } from "@libsql/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import { friendships, users } from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";
import {
  clearPresence,
  listIncoming,
  listNearbyPartners,
  respondToRequest,
  sendRequest,
  setPresence,
} from "@/lib/gym-partner/presence";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", () => ({ getDb: () => state.db }));
vi.mock("@/db/ensure-schema", () => ({ ensureCriticalSchema: async () => {} }));

const base = { goal: "sila", level: "sredni", preferredTime: "teraz", durationHours: 2 } as const;

describe("partnerzy treningowi (baza w pamięci)", () => {
  let client: Client;
  let db: Database;
  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
    state.db = db;
    await db.insert(users).values([
      { id: "a", email: "a@t.pl", passwordHash: "x", firstName: "Ania" },
      { id: "b", email: "b@t.pl", passwordHash: "x", firstName: "Bartek" },
      { id: "c", email: "c@t.pl", passwordHash: "x", firstName: "Cezary" },
    ]);
  });
  afterAll(() => client.close());

  it("widać tylko osoby w promieniu, bez siebie, z zaokrągloną pozycją", async () => {
    await setPresence("b", { lat: 52.2301, lng: 21.0125, ...base });
    await setPresence("c", { lat: 50.06, lng: 19.94, ...base }); // Kraków
    await setPresence("a", { lat: 52.2297, lng: 21.0122, ...base });
    const list = await listNearbyPartners("a", { lat: 52.2297, lng: 21.0122 }, 5000);
    expect(list.map((p) => p.userId)).toEqual(["b"]);
    expect(list[0].name).toBe("Bartek");
    expect(list[0].lat).not.toBe(52.2301);
  });

  it("zaproszenie: brak do siebie i do niewidocznych, brak duplikatu, akceptacja tworzy znajomość", async () => {
    expect((await sendRequest("a", "a")).ok).toBe(false);
    expect((await sendRequest("a", "zzz")).ok).toBe(false);
    expect((await sendRequest("a", "b")).ok).toBe(true);
    expect((await sendRequest("a", "b")).ok).toBe(false);
    const inc = await listIncoming("b");
    expect(inc).toHaveLength(1);
    // obca osoba nie może odpowiedzieć
    expect((await respondToRequest("c", inc[0].id, true)).ok).toBe(false);
    expect((await respondToRequest("b", inc[0].id, true)).ok).toBe(true);
    const fr = await db.select().from(friendships);
    expect(fr).toHaveLength(1);
    expect(fr[0].status).toBe("accepted");
  });

  it("po ukryciu nie jest widoczny", async () => {
    await clearPresence("b");
    const list = await listNearbyPartners("a", { lat: 52.2297, lng: 21.0122 }, 5000);
    expect(list).toEqual([]);
  });
});
