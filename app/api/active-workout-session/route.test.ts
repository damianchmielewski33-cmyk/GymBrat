import type { Client } from "@libsql/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import { createMemoryDb } from "@/db/test-memory-db";

let db: Database;
const userId = "u1";

vi.mock("@/db", () => ({ getDb: () => db }));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: userId } }) }));
vi.mock("@/lib/csrf", () => ({ assertCsrf: () => null }));

const { GET, PUT, DELETE } = await import("@/app/api/active-workout-session/route");

function buildPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    startedAt: 1000,
    pausedElapsedSeconds: 0,
    workoutStartedAtMs: 1000,
    operationId: "op-1",
    title: "Trening",
    workoutPlanId: "plan-1",
    cardioMinutes: 0,
    exercises: [{ id: "1", name: "Przysiad", sets: [] }],
    selectedExerciseId: null,
    ...overrides,
  };
}

function putReq(body: Record<string, unknown>) {
  return PUT(
    new Request("http://localhost/api/active-workout-session", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function getReq() {
  return GET(new Request("http://localhost/api/active-workout-session", { method: "GET" }));
}

function deleteReq() {
  return DELETE(
    new Request("http://localhost/api/active-workout-session", { method: "DELETE" }),
  );
}

describe("DELETE/PUT /api/active-workout-session — monotoniczność rewizji (005, B-1b, ADR 0004 p.12)", () => {
  let client: Client;

  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
  });

  afterAll(() => {
    client.close();
  });

  beforeEach(async () => {
    await client.execute("DELETE FROM active_workout_sessions");
  });

  it("DELETE nie zeruje rewizji — wygasza wiersz z rewizją +1, kolejny PUT z niższą rewizją dostaje 409", async () => {
    const put1 = await putReq({ payload: buildPayload(), revision: 0, deviceId: "device-a-00000000" });
    expect(put1.status).toBe(200);
    const putBody1 = (await put1.json()) as { ok: boolean; revision: number };
    expect(putBody1.revision).toBe(1);

    const del = await deleteReq();
    expect(del.status).toBe(200);
    const delBody = (await del.json()) as { ok: boolean; revision: number };
    expect(delBody.revision).toBe(2);

    const put2 = await putReq({ payload: buildPayload(), revision: 0, deviceId: "device-a-00000000" });
    expect(put2.status).toBe(409);
  });

  it("odtwarza dokładny scenariusz sondy testera (sekcja 9.2): zaległy PUT po DELETE i reużyciu operationId nie nadpisuje nowej sesji", async () => {
    const deviceB = "device-b-00000000";
    const deviceA = "device-a-00000000";

    // Urządzenie B pushuje sesję 1 pięć razy, rewizja serwera rośnie do 5.
    let lastRevision = 0;
    for (let i = 0; i < 5; i += 1) {
      const res = await putReq({
        payload: buildPayload({ operationId: "session-1" }),
        revision: lastRevision,
        deviceId: deviceB,
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { revision: number };
      lastRevision = body.revision;
    }
    expect(lastRevision).toBe(5);

    // Urządzenie A kończy sesję 1 -> DELETE. Rewizja musi być 6, nie 0.
    const del = await deleteReq();
    expect(del.status).toBe(200);
    const delBody = (await del.json()) as { ok: boolean; revision: number };
    expect(delBody.revision).toBe(6);

    // A startuje sesję 2 z nowym operationId, clientRevision: 0 -> musi dostać 409 (0 < 6).
    const putSession2Attempt1 = await putReq({
      payload: buildPayload({ operationId: "session-2", title: "Sesja 2" }),
      revision: 0,
      deviceId: deviceA,
    });
    expect(putSession2Attempt1.status).toBe(409);

    // A odczytuje aktualną rewizję przez GET (wygaszony payload, session: null). Wiersz jest
    // JUŻ wygaszony (przez DELETE powyżej) — to jest czysty odczyt, bez mutacji/bumpa rewizji
    // (005, B-1d, ADR 0004 p.13.3 krok 7: odczyt nie jest operacją z efektem ubocznym gdy
    // wiersz jest już wygaszony). Rewizja zostaje 6, nie 7.
    const getAfterConflict = await getReq();
    expect(getAfterConflict.status).toBe(200);
    const getBody = (await getAfterConflict.json()) as { ok: boolean; session: unknown };
    expect(getBody.session).toBeNull();

    const putSession2Attempt2 = await putReq({
      payload: buildPayload({ operationId: "session-2", title: "Sesja 2" }),
      revision: 6,
      deviceId: deviceA,
    });
    expect(putSession2Attempt2.status).toBe(200);
    const putSession2Body = (await putSession2Attempt2.json()) as { revision: number };
    expect(putSession2Body.revision).toBe(7);

    // Zaległy PUT B z clientRevision: 5 musi dostać 409 i NIE nadpisać sesji 2.
    const staleFromB = await putReq({
      payload: buildPayload({ operationId: "session-1", title: "Sesja 1 (zaległa)" }),
      revision: 5,
      deviceId: deviceB,
    });
    expect(staleFromB.status).toBe(409);

    const getAfterStalePut = await getReq();
    const getAfterStaleBody = (await getAfterStalePut.json()) as {
      session: { payload: { title: string; operationId: string }; revision: number } | null;
    };
    expect(getAfterStaleBody.session).not.toBeNull();
    expect(getAfterStaleBody.session?.payload.title).toBe("Sesja 2");
    expect(getAfterStaleBody.session?.payload.operationId).toBe("session-2");
    expect(getAfterStaleBody.session?.revision).toBe(7);
  });

  it("GET na już wygaszonym wierszu nie mutuje rewizji w bazie (005, B-1d, ADR 0004 p.13.3 krok 7)", async () => {
    const put = await putReq({ payload: buildPayload(), revision: 0, deviceId: "device-a-00000000" });
    expect(put.status).toBe(200);

    const del = await deleteReq();
    expect(del.status).toBe(200);
    const delBody = (await del.json()) as { revision: number };
    expect(delBody.revision).toBe(2);

    const rowBefore = await client.execute({
      sql: `SELECT revision, updated_at FROM active_workout_sessions WHERE user_id = ?`,
      args: [userId],
    });
    const revisionBefore = Number(rowBefore.rows[0]!.revision);
    const updatedAtBefore = rowBefore.rows[0]!.updated_at;
    expect(revisionBefore).toBe(2);

    // Kolejne GET na już wygaszonym (świeżym) wierszu — czysty odczyt, bez efektu ubocznego.
    const get1 = await getReq();
    expect(get1.status).toBe(200);
    const get1Body = (await get1.json()) as { session: unknown };
    expect(get1Body.session).toBeNull();

    const get2 = await getReq();
    expect(get2.status).toBe(200);
    const get2Body = (await get2.json()) as { session: unknown };
    expect(get2Body.session).toBeNull();

    const rowAfter = await client.execute({
      sql: `SELECT revision, updated_at FROM active_workout_sessions WHERE user_id = ?`,
      args: [userId],
    });
    expect(Number(rowAfter.rows[0]!.revision)).toBe(revisionBefore);
    expect(rowAfter.rows[0]!.updated_at).toBe(updatedAtBefore);
  });

  it("GET dla przeterminowanego wiersza wygasza payload i inkrementuje rewizję, bez fizycznego usunięcia", async () => {
    const put = await putReq({ payload: buildPayload(), revision: 0, deviceId: "device-a-00000000" });
    expect(put.status).toBe(200);

    // Symuluj przeterminowanie — przestarzały updated_at.
    await client.execute({
      sql: `UPDATE active_workout_sessions SET updated_at = ? WHERE user_id = ?`,
      args: [Date.now() - 48 * 60 * 60 * 1000, userId],
    });

    const get = await getReq();
    expect(get.status).toBe(200);
    const getBody = (await get.json()) as { session: unknown };
    expect(getBody.session).toBeNull();

    const row = await client.execute({
      sql: `SELECT revision FROM active_workout_sessions WHERE user_id = ?`,
      args: [userId],
    });
    expect(row.rows.length).toBe(1);
    expect(Number(row.rows[0]!.revision)).toBe(2);
  });

  it("DELETE bez istniejącego wiersza zwraca revision: 0 i nie tworzy wiersza", async () => {
    const del = await deleteReq();
    expect(del.status).toBe(200);
    const delBody = (await del.json()) as { ok: boolean; revision: number };
    expect(delBody.revision).toBe(0);

    const row = await client.execute(`SELECT COUNT(*) AS c FROM active_workout_sessions`);
    expect(Number(row.rows[0]!.c)).toBe(0);
  });
});
