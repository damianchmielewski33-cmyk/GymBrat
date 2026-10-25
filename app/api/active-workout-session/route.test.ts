import type { Client } from "@libsql/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import { createMemoryDb } from "@/db/test-memory-db";
import { shouldApplyConflictPayload } from "@/lib/active-workout-cloud-client";

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

function deleteReq(body: Record<string, unknown>) {
  return DELETE(
    new Request("http://localhost/api/active-workout-session", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function deleteReqRaw(rawBody?: string) {
  return DELETE(
    new Request("http://localhost/api/active-workout-session", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      ...(rawBody !== undefined ? { body: rawBody } : {}),
    }),
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

    const del = await deleteReq({ revision: 1 });
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
    const del = await deleteReq({ revision: 5 });
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

    const del = await deleteReq({ revision: 1 });
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
    const del = await deleteReq({ revision: 0 });
    expect(del.status).toBe(200);
    const delBody = (await del.json()) as { ok: boolean; revision: number };
    expect(delBody.revision).toBe(0);

    const row = await client.execute(`SELECT COUNT(*) AS c FROM active_workout_sessions`);
    expect(Number(row.rows[0]!.c)).toBe(0);
  });

  it("DELETE bez istniejącego wiersza zwraca revision: 0 niezależnie od rewizji w ciele (brak historii do chronienia, ADR 0004 p.16.4 pkt 2)", async () => {
    const del = await deleteReq({ revision: 999 });
    expect(del.status).toBe(200);
    const delBody = (await del.json()) as { ok: boolean; revision: number };
    expect(delBody.revision).toBe(0);

    const row = await client.execute(`SELECT COUNT(*) AS c FROM active_workout_sessions`);
    expect(Number(row.rows[0]!.c)).toBe(0);
  });

  it("DELETE bez ciała / z nieprawidłowym JSON / z revision ujemną lub nie-liczbą -> 400, bez mutacji wiersza (ADR 0004 p.16.5.3)", async () => {
    const put = await putReq({ payload: buildPayload(), revision: 0, deviceId: "device-a-00000000" });
    expect(put.status).toBe(200);

    const noBody = await deleteReqRaw(undefined);
    expect(noBody.status).toBe(400);

    const invalidJson = await deleteReqRaw("{not valid json");
    expect(invalidJson.status).toBe(400);

    const negativeRevision = await deleteReq({ revision: -1 });
    expect(negativeRevision.status).toBe(400);

    const nonNumberRevision = await deleteReq({ revision: "1" as unknown as number });
    expect(nonNumberRevision.status).toBe(400);

    const row = await client.execute({
      sql: `SELECT revision FROM active_workout_sessions WHERE user_id = ?`,
      args: [userId],
    });
    expect(Number(row.rows[0]!.revision)).toBe(1);
  });

  it("DELETE z revision wyższą niż serwerowa jest akceptowany — symetria z PUT (ADR 0004 p.16.5.4)", async () => {
    const put = await putReq({ payload: buildPayload(), revision: 0, deviceId: "device-a-00000000" });
    expect(put.status).toBe(200);

    const del = await deleteReq({ revision: 999 });
    expect(del.status).toBe(200);
    const delBody = (await del.json()) as { ok: boolean; revision: number };
    expect(delBody.revision).toBe(2);

    const row = await client.execute({
      sql: `SELECT revision FROM active_workout_sessions WHERE user_id = ?`,
      args: [userId],
    });
    expect(Number(row.rows[0]!.revision)).toBe(2);
  });

  it("DELETE z revision niższą niż serwerowa -> 409, bez mutacji wiersza (N-P13-7, ADR 0004 p.16.4 pkt 2)", async () => {
    const put1 = await putReq({ payload: buildPayload(), revision: 0, deviceId: "device-a-00000000" });
    expect(put1.status).toBe(200);
    const put2 = await putReq({
      payload: buildPayload({ title: "Trening 2" }),
      revision: 1,
      deviceId: "device-a-00000000",
    });
    expect(put2.status).toBe(200);
    expect(((await put2.json()) as { revision: number }).revision).toBe(2);

    // Klient z rewizją 0 (nigdy nie synchronizował) próbuje DELETE na wierszu o rewizji 2.
    const staleDelete = await deleteReq({ revision: 0 });
    expect(staleDelete.status).toBe(409);
    const conflictBody = (await staleDelete.json()) as {
      ok: boolean;
      conflict: boolean;
      session: { revision: number; payload: { title: string } } | null;
    };
    expect(conflictBody.ok).toBe(false);
    expect(conflictBody.conflict).toBe(true);
    expect(conflictBody.session?.revision).toBe(2);
    expect(conflictBody.session?.payload.title).toBe("Trening 2");

    const row = await client.execute({
      sql: `SELECT revision FROM active_workout_sessions WHERE user_id = ?`,
      args: [userId],
    });
    expect(Number(row.rows[0]!.revision)).toBe(2);
  });
});

/**
 * 005, naprawa N-P13-7 (ADR 0004 p.16) — dokładna replika sondy testera 13.4: `DELETE`
 * bez kontroli rewizji mogło pozwolić nieinformowanemu "bystanderowi" C (świeża/pusta
 * karta, `revision: 0`) wygasić AKTYWNĄ sesję innego urządzenia. Po naprawie DELETE
 * wymaga tej samej kontroli optymistycznej współbieżności co PUT.
 */
describe("DELETE wymaga kontroli rewizji — zamknięcie N-P13-7 (ADR 0004 p.16)", () => {
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

  it("dokładna replika sondy 13.4: A kończy S1 (tombstone), startuje S2 (rev rośnie); C z pustą kartą (revision: 0) wysyła DELETE -> 409, zero mutacji wiersza S2", async () => {
    const deviceA = "device-a-00000000";

    // PUT A, S1 (workoutStartedAtMs: 1000), revision: 0 -> 200, revision: 1.
    const putS1 = await putReq({
      payload: buildPayload({ workoutStartedAtMs: 1000, operationId: "session-1" }),
      revision: 0,
      deviceId: deviceA,
    });
    expect(putS1.status).toBe(200);
    expect(((await putS1.json()) as { revision: number }).revision).toBe(1);

    // DELETE A z revision: 1 -> 200, revision: 2 (tombstone 1000).
    const delS1 = await deleteReq({ revision: 1 });
    expect(delS1.status).toBe(200);
    expect(((await delS1.json()) as { revision: number }).revision).toBe(2);

    // PUT A, S2 (workoutStartedAtMs: 2000), revision: 2 -> 200, revision: 3.
    const putS2 = await putReq({
      payload: buildPayload({ workoutStartedAtMs: 2000, operationId: "session-2" }),
      revision: 2,
      deviceId: deviceA,
    });
    expect(putS2.status).toBe(200);
    expect(((await putS2.json()) as { revision: number }).revision).toBe(3);

    // C wysyła DELETE z revision: 0 (fresh, nigdy nie synchronizował) -> 409, conflict: true.
    const deleteFromC = await deleteReq({ revision: 0 });
    expect(deleteFromC.status).toBe(409);
    const deleteFromCBody = (await deleteFromC.json()) as {
      ok: boolean;
      conflict: boolean;
      session: { revision: number; payload: { workoutStartedAtMs: number } } | null;
    };
    expect(deleteFromCBody.ok).toBe(false);
    expect(deleteFromCBody.conflict).toBe(true);

    // Odczyt wiersza bezpośrednio z bazy PO żądaniu C: payload wciąż aktywny,
    // workoutStartedAtMs === 2000, revision === 3 (niezmieniona przez próbę C).
    const row = await client.execute({
      sql: `SELECT revision, payload_json FROM active_workout_sessions WHERE user_id = ?`,
      args: [userId],
    });
    expect(row.rows.length).toBe(1);
    expect(Number(row.rows[0]!.revision)).toBe(3);
    const storedPayload = JSON.parse(String(row.rows[0]!.payload_json)) as {
      workoutStartedAtMs: number;
    };
    expect(storedPayload.workoutStartedAtMs).toBe(2000);

    // Kontynuacja: PUT A z revision: 3 (kolejna seria) -> 200 bez żadnej interferencji od C.
    const putS2Continued = await putReq({
      payload: buildPayload({ workoutStartedAtMs: 2000, operationId: "session-2", title: "Trening (seria 2)" }),
      revision: 3,
      deviceId: deviceA,
    });
    expect(putS2Continued.status).toBe(200);
    expect(((await putS2Continued.json()) as { revision: number }).revision).toBe(4);
  });
});

describe("tożsamość tombstone — clearedSessionStartedAtMs (005, N-P13-1, ADR 0004 p.14)", () => {
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

  async function readStoredPayload(): Promise<{ clearedSessionStartedAtMs: unknown }> {
    const row = await client.execute({
      sql: `SELECT payload_json FROM active_workout_sessions WHERE user_id = ?`,
      args: [userId],
    });
    expect(row.rows.length).toBe(1);
    return JSON.parse(String(row.rows[0]!.payload_json)) as { clearedSessionStartedAtMs: unknown };
  }

  it("DELETE wygasza wiersz z clearedSessionStartedAtMs == workoutStartedAtMs wygaszanej sesji", async () => {
    const put = await putReq({
      payload: buildPayload({ workoutStartedAtMs: 5555 }),
      revision: 0,
      deviceId: "device-a-00000000",
    });
    expect(put.status).toBe(200);

    const del = await deleteReq({ revision: 1 });
    expect(del.status).toBe(200);

    const stored = await readStoredPayload();
    expect(stored.clearedSessionStartedAtMs).toBe(5555);
  });

  it("GET na przeterminowanym wierszu (ghost) wygasza z clearedSessionStartedAtMs == workoutStartedAtMs", async () => {
    const put = await putReq({
      payload: buildPayload({ workoutStartedAtMs: 7777 }),
      revision: 0,
      deviceId: "device-a-00000000",
    });
    expect(put.status).toBe(200);

    await client.execute({
      sql: `UPDATE active_workout_sessions SET updated_at = ? WHERE user_id = ?`,
      args: [Date.now() - 48 * 60 * 60 * 1000, userId],
    });

    const get = await getReq();
    expect(get.status).toBe(200);
    const getBody = (await get.json()) as { session: unknown };
    expect(getBody.session).toBeNull();

    const stored = await readStoredPayload();
    expect(stored.clearedSessionStartedAtMs).toBe(7777);
  });

  it("DELETE na wierszu z nieparsowalnym payloadJson wygasza z clearedSessionStartedAtMs == null", async () => {
    await client.execute({
      sql: `INSERT INTO active_workout_sessions (user_id, payload_json, revision, device_id, updated_at) VALUES (?, ?, ?, ?, ?)`,
      args: [userId, "{not valid json", 1, "device-a-00000000", Date.now()],
    });

    const del = await deleteReq({ revision: 1 });
    expect(del.status).toBe(200);

    const stored = await readStoredPayload();
    expect(stored.clearedSessionStartedAtMs).toBeNull();
  });

  it("GET na wierszu z nieparsowalnym payloadJson wygasza z clearedSessionStartedAtMs == null", async () => {
    await client.execute({
      sql: `INSERT INTO active_workout_sessions (user_id, payload_json, revision, device_id, updated_at) VALUES (?, ?, ?, ?, ?)`,
      args: [userId, "{not valid json", 1, "device-a-00000000", Date.now()],
    });

    const get = await getReq();
    expect(get.status).toBe(200);
    const getBody = (await get.json()) as { session: unknown };
    expect(getBody.session).toBeNull();

    const stored = await readStoredPayload();
    expect(stored.clearedSessionStartedAtMs).toBeNull();
  });

  it("PUT konfliktowy (409) po wygaszeniu przez A zwraca conflict.session.payload.clearedSessionStartedAtMs tej samej sesji", async () => {
    const put = await putReq({
      payload: buildPayload({ workoutStartedAtMs: 9999 }),
      revision: 0,
      deviceId: "device-a-00000000",
    });
    expect(put.status).toBe(200);

    const del = await deleteReq({ revision: 1 });
    expect(del.status).toBe(200);
    const delBody = (await del.json()) as { revision: number };
    expect(delBody.revision).toBe(2);

    // Zaległy klient B z przestarzałą rewizją dostaje 409 z aktualnym (wygaszonym) stanem.
    const staleFromB = await putReq({
      payload: buildPayload({ workoutStartedAtMs: 9999 }),
      revision: 0,
      deviceId: "device-b-00000000",
    });
    expect(staleFromB.status).toBe(409);
    const conflictBody = (await staleFromB.json()) as {
      conflict: boolean;
      session: { payload: { clearedSessionStartedAtMs: unknown } } | null;
    };
    expect(conflictBody.conflict).toBe(true);
    expect(conflictBody.session?.payload.clearedSessionStartedAtMs).toBe(9999);
  });
});

/**
 * 005, naprawa N-P13-6 (ADR 0004 p.15.5) — macierz regresji, jeden kompletny przebieg
 * zamiast kolejnych rund na pojedyncze rogi przypadku. Scenariusze (a)-(f) z tabeli 15.5.
 */
describe("macierz regresji N-P13-6 — tożsamość tombstone nie ginie przy idempotentnym wygaszeniu (ADR 0004 p.15.5)", () => {
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

  async function readStoredClearedId(): Promise<unknown> {
    const row = await client.execute({
      sql: `SELECT payload_json FROM active_workout_sessions WHERE user_id = ?`,
      args: [userId],
    });
    expect(row.rows.length).toBe(1);
    const parsed = JSON.parse(String(row.rows[0]!.payload_json)) as {
      clearedSessionStartedAtMs: unknown;
    };
    return parsed.clearedSessionStartedAtMs;
  }

  it("(a)-(b)-(c): pojedynczy DELETE ustawia tożsamość, kolejne DELETE/GET-ghost na pustym wierszu NIE kasują jej (sonda P4b)", async () => {
    // (a) PUT S1 (workoutStartedAtMs = 1000) rev 0 -> 200; DELETE -> 200.
    const put = await putReq({
      payload: buildPayload({ workoutStartedAtMs: 1000 }),
      revision: 0,
      deviceId: "device-a-00000000",
    });
    expect(put.status).toBe(200);

    const del1 = await deleteReq({ revision: 1 });
    expect(del1.status).toBe(200);
    expect(((await del1.json()) as { revision: number }).revision).toBe(2);
    expect(await readStoredClearedId()).toBe(1000);

    // (b) DELETE x2 kolejne razy na już pustym wierszu — tożsamość NIE może zniknąć.
    const del2 = await deleteReq({ revision: 2 });
    expect(del2.status).toBe(200);
    expect(((await del2.json()) as { revision: number }).revision).toBe(3);
    expect(await readStoredClearedId()).toBe(1000);

    const del3 = await deleteReq({ revision: 3 });
    expect(del3.status).toBe(200);
    expect(((await del3.json()) as { revision: number }).revision).toBe(4);
    expect(await readStoredClearedId()).toBe(1000);

    // (c) GET-ghost: przesuń updatedAt > 24h, GET nie gubi tożsamości (gałąź ghost nie
    // jest wywoływana na tombstonie — hasActiveLocalSession(tombstone) === false, linia
    // "już wygaszony" zwraca wcześniej, bez mutacji).
    await client.execute({
      sql: `UPDATE active_workout_sessions SET updated_at = ? WHERE user_id = ?`,
      args: [Date.now() - 48 * 60 * 60 * 1000, userId],
    });
    const get = await getReq();
    expect(get.status).toBe(200);
    expect(((await get.json()) as { session: unknown }).session).toBeNull();
    expect(await readStoredClearedId()).toBe(1000);
  });

  it("(d) trzy urządzenia: A kończy S1, B (miał S1) akceptuje i sam wysyła DELETE idempotentny, tożsamość S1 NIE ginie, C (zaległy, wciąż ma S1) dostaje 409 z tombstone S1 i akceptuje wygaszenie", async () => {
    const deviceA = "device-a-00000000";
    const deviceB = "device-b-00000000";
    const payloadS1 = buildPayload({ workoutStartedAtMs: 1000 });

    // A startuje S1.
    const putA = await putReq({ payload: payloadS1, revision: 0, deviceId: deviceA });
    expect(putA.status).toBe(200);
    expect(((await putA.json()) as { revision: number }).revision).toBe(1);

    // B synchronizuje tę samą sesję S1 (np. po otwarciu karty), rewizja rośnie 1 -> 2.
    const putB = await putReq({ payload: payloadS1, revision: 1, deviceId: deviceB });
    expect(putB.status).toBe(200);
    expect(((await putB.json()) as { revision: number }).revision).toBe(2);

    // A kończy trening -> DELETE, rewizja 2 -> 3, tombstone niesie tożsamość S1 (1000).
    const delA = await deleteReq({ revision: 2 });
    expect(delA.status).toBe(200);
    expect(((await delA.json()) as { revision: number }).revision).toBe(3);
    expect(await readStoredClearedId()).toBe(1000);

    // B przyjmuje wygaszenie (np. po konflikcie 409, który niesie aktualną rewizję 3) i sam
    // wysyła idempotentny DELETE z tą rewizją — TO JEST DOKŁADNIE SCENARIUSZ, KTÓRY
    // WCZEŚNIEJ KASOWAŁ TOŻSAMOŚĆ (N-P13-6).
    const delB = await deleteReq({ revision: 3 });
    expect(delB.status).toBe(200);
    expect(((await delB.json()) as { revision: number }).revision).toBe(4);
    expect(await readStoredClearedId()).toBe(1000); // tożsamość S1 NIE wyzerowana przez DELETE od B

    // C, zaległe urządzenie wciąż z lokalną S1, robi PUT ze starą rewizją -> 409.
    const putC = await putReq({ payload: payloadS1, revision: 2, deviceId: "device-c-00000000" });
    expect(putC.status).toBe(409);
    const conflictC = (await putC.json()) as {
      conflict: boolean;
      session: { payload: { clearedSessionStartedAtMs: unknown } } | null;
    };
    expect(conflictC.conflict).toBe(true);
    expect(conflictC.session?.payload.clearedSessionStartedAtMs).toBe(1000);

    // C musi PRZYJĄĆ wygaszenie (nie wskrzesić S1) — weryfikacja przez logikę klienta.
    expect(
      shouldApplyConflictPayload(
        payloadS1 as never,
        conflictC.session!.payload as never,
      ),
    ).toBe(true);
  });

  it("(e)-(f): inna sesja lokalna (S2) po konflikcie republikuje się bez utraty, a jej własne, genuinie-inne wygaszenie poprawnie nadpisuje tożsamość na swoją", async () => {
    // Powtórzenie (a)-(b): S1 kończona, zaległy DELETE na pustym wierszu, tombstone 1000.
    const putS1 = await putReq({
      payload: buildPayload({ workoutStartedAtMs: 1000 }),
      revision: 0,
      deviceId: "device-a-00000000",
    });
    expect(putS1.status).toBe(200);
    const del1 = await deleteReq({ revision: 1 });
    expect(del1.status).toBe(200);
    const del1Revision = ((await del1.json()) as { revision: number }).revision;
    expect(del1Revision).toBe(2);
    const del2 = await deleteReq({ revision: 2 });
    expect(((await del2.json()) as { revision: number }).revision).toBe(3);
    expect(await readStoredClearedId()).toBe(1000);

    // (e) PUT z inną sesją lokalną S2 (workoutStartedAtMs = 2000), z przestarzałą (niższą niż
    // serwerowa) rewizją klienta -> 409 (klient jeszcze nie wiedział o wygaszeniu S1).
    const payloadS2 = buildPayload({ workoutStartedAtMs: 2000, operationId: "session-2" });
    const putS2Attempt1 = await putReq({
      payload: payloadS2,
      revision: 0,
      deviceId: "device-c-00000000",
    });
    expect(putS2Attempt1.status).toBe(409);
    const conflict1 = (await putS2Attempt1.json()) as {
      conflict: boolean;
      session: {
        revision: number;
        payload: { clearedSessionStartedAtMs: unknown };
      } | null;
    };
    expect(conflict1.conflict).toBe(true);
    expect(conflict1.session?.payload.clearedSessionStartedAtMs).toBe(1000);

    // S2 ≠ 1000 -> klient NIE przyjmuje tombstone'u, zachowuje S2 i republikuje.
    expect(
      shouldApplyConflictPayload(payloadS2 as never, conflict1.session!.payload as never),
    ).toBe(false);

    // Republikacja S2 z rewizją z konfliktu -> 200, wiersz ma aktywną S2.
    const putS2Attempt2 = await putReq({
      payload: payloadS2,
      revision: conflict1.session!.revision,
      deviceId: "device-c-00000000",
    });
    expect(putS2Attempt2.status).toBe(200);
    const putS2Body = (await putS2Attempt2.json()) as { revision: number };
    expect(putS2Body.revision).toBe(conflict1.session!.revision + 1);

    const getAfterS2 = await getReq();
    const getAfterS2Body = (await getAfterS2.json()) as {
      session: { payload: { workoutStartedAtMs: number } } | null;
    };
    expect(getAfterS2Body.session?.payload.workoutStartedAtMs).toBe(2000);

    // (f) S2 kończy się normalnie -> DELETE musi nadpisać tożsamość na SWOJĄ (2000), nie
    // zachować starą 1000 — tym razem źródłem jest payload AKTYWNEJ sesji S2 (gałąź 1
    // tabeli 15.2), nie gałąź "już tombstone" (gałąź 2).
    const delS2 = await deleteReq({ revision: putS2Body.revision });
    expect(delS2.status).toBe(200);
    expect(await readStoredClearedId()).toBe(2000);
  });
});

/**
 * 005, naprawa N-P13-8 (ADR 0004 p.17) — CAS na `UPDATE`/`INSERT`, zamiast SELECT-then-UPDATE.
 * Replika sond testera P2-P5 (`docs/testy/005-koniec-treningu-przeplyw.md` sekcja 14.1):
 * wstrzyknięcie współbieżnego, "wygrywającego" żądania DOKŁADNIE między SELECT a UPDATE/INSERT
 * testowanego handlera. Mechanizm: opakowanie `client.execute` tak, że przy PIERWSZYM
 * wywołaniu zapisu (UPDATE/INSERT) na `active_workout_sessions` w ramach testowanego żądania,
 * PRZED jego faktycznym wykonaniem, uruchamiane i doczekiwane jest całe, osobne, konkurencyjne
 * żądanie — dokładnie ta metoda, którą tester opisał w 14.1.
 */
describe("CAS / wyścig między SELECT i UPDATE (005, N-P13-8, ADR 0004 p.17)", () => {
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

  /**
   * Wstrzykuje wyścig: owija `client.execute` tak, by PRZED pierwszym wywołaniem zapisu
   * (UPDATE/INSERT) na `active_workout_sessions` wykonać i doczekać `onFirstWrite`
   * (konkurencyjne żądanie), a potem przepuścić oryginalne wywołanie. Zwraca funkcję
   * przywracającą oryginalny `execute` — wołana zawsze po teście (nawet przy błędzie),
   * żeby nie przeciekło do kolejnych testów w tym pliku.
   */
  function injectRaceBeforeFirstWrite(onFirstWrite: () => Promise<void>): () => void {
    const original = client.execute.bind(client);
    let intercepted = false;
    const wrapped = (async (...args: [unknown, unknown?]) => {
      const stmt = args[0];
      const sql =
        typeof stmt === "string" ? stmt : (stmt as { sql: string }).sql;
      const upper = sql.toUpperCase();
      const isWrite =
        upper.includes("ACTIVE_WORKOUT_SESSIONS") &&
        (upper.includes("UPDATE") || upper.includes("INSERT INTO"));
      if (!intercepted && isWrite) {
        intercepted = true;
        await onFirstWrite();
      }
      return (original as (...a: unknown[]) => unknown)(...args);
    }) as Client["execute"];
    client.execute = wrapped;
    return () => {
      client.execute = original;
    };
  }

  it("replika P3: DELETE A kontra współbieżny PUT B między SELECT i UPDATE w clearRow -> A dostaje świeży 409, B nietknięty", async () => {
    const deviceA = "device-a-00000000";
    const deviceB = "device-b-00000000";

    const putA = await putReq({
      payload: buildPayload({ workoutStartedAtMs: 1000, operationId: "session-1" }),
      revision: 0,
      deviceId: deviceA,
    });
    expect(putA.status).toBe(200);
    expect(((await putA.json()) as { revision: number }).revision).toBe(1);

    const restore = injectRaceBeforeFirstWrite(async () => {
      // Tuż przed UPDATE w `clearRow` A: B wygrywa wyścig, zapisuje S3 jako PIERWSZY.
      const putB = await putReq({
        payload: buildPayload({ workoutStartedAtMs: 3000, operationId: "session-3" }),
        revision: 1,
        deviceId: deviceB,
      });
      expect(putB.status).toBe(200);
      expect(((await putB.json()) as { revision: number }).revision).toBe(2);
    });

    const delA = await deleteReq({ revision: 1 });
    restore();

    expect(delA.status).toBe(409);
    const delABody = (await delA.json()) as {
      ok: boolean;
      conflict: boolean;
      session: { revision: number; deviceId: string; payload: { operationId: string } } | null;
    };
    expect(delABody.ok).toBe(false);
    expect(delABody.conflict).toBe(true);
    expect(delABody.session?.revision).toBe(2);
    expect(delABody.session?.deviceId).toBe(deviceB);
    expect(delABody.session?.payload.operationId).toBe("session-3");

    // Dowód bezpośredni z bazy: wiersz S3 NIETKNIĘTY przez przegraną próbę DELETE A.
    const row = await client.execute({
      sql: `SELECT revision, payload_json FROM active_workout_sessions WHERE user_id = ?`,
      args: [userId],
    });
    expect(Number(row.rows[0]!.revision)).toBe(2);
    const storedPayload = JSON.parse(String(row.rows[0]!.payload_json)) as {
      operationId: string;
      workoutStartedAtMs: number;
    };
    expect(storedPayload.operationId).toBe("session-3");
    expect(storedPayload.workoutStartedAtMs).toBe(3000);
  });

  it("replika P4: GET-ghost kontra współbieżny PUT wstawiający świeżą sesję między odczytem i UPDATE w clearRow -> świeża sesja PRZETRWA, GET ją zwraca", async () => {
    const deviceA = "device-a-00000000";

    const putOld = await putReq({
      payload: buildPayload({ workoutStartedAtMs: 9000, operationId: "session-old" }),
      revision: 0,
      deviceId: deviceA,
    });
    expect(putOld.status).toBe(200);
    expect(((await putOld.json()) as { revision: number }).revision).toBe(1);

    // Przeterminuj wiersz, żeby GET wszedł w gałąź ghost (próba opportunistycznego czyszczenia).
    await client.execute({
      sql: `UPDATE active_workout_sessions SET updated_at = ? WHERE user_id = ?`,
      args: [Date.now() - 48 * 60 * 60 * 1000, userId],
    });

    const restore = injectRaceBeforeFirstWrite(async () => {
      // Tuż przed UPDATE w `clearRow` GET-a: A wstawia ŚWIEŻĄ, aktywną sesję S-new.
      const putNew = await putReq({
        payload: buildPayload({ workoutStartedAtMs: 9500, operationId: "session-new" }),
        revision: 1,
        deviceId: deviceA,
      });
      expect(putNew.status).toBe(200);
      expect(((await putNew.json()) as { revision: number }).revision).toBe(2);
    });

    const get = await getReq();
    restore();

    expect(get.status).toBe(200);
    const getBody = (await get.json()) as {
      ok: boolean;
      session: { revision: number; payload: { operationId: string; workoutStartedAtMs: number } } | null;
    };
    // KLUCZOWA asercja (dotąd defekt N-P13-8): świeża sesja PRZETRWA, GET NIE zwraca `null`.
    expect(getBody.session).not.toBeNull();
    expect(getBody.session?.revision).toBe(2);
    expect(getBody.session?.payload.operationId).toBe("session-new");
    expect(getBody.session?.payload.workoutStartedAtMs).toBe(9500);

    const row = await client.execute({
      sql: `SELECT revision, payload_json FROM active_workout_sessions WHERE user_id = ?`,
      args: [userId],
    });
    expect(Number(row.rows[0]!.revision)).toBe(2);
    const storedPayload = JSON.parse(String(row.rows[0]!.payload_json)) as { operationId: string };
    expect(storedPayload.operationId).toBe("session-new");
  });

  it("replika P5: PUT A kontra współbieżny PUT B między SELECT i UPDATE -> jedna strona wygrywa CAS, druga dostaje świeży 409, brak cichego nadpisania", async () => {
    const deviceA = "device-a-00000000";
    const deviceB = "device-b-00000000";

    const putInitial = await putReq({
      payload: buildPayload({ workoutStartedAtMs: 1000, operationId: "session-1", title: "Initial" }),
      revision: 0,
      deviceId: deviceA,
    });
    expect(putInitial.status).toBe(200);
    expect(((await putInitial.json()) as { revision: number }).revision).toBe(1);

    const restore = injectRaceBeforeFirstWrite(async () => {
      // Tuż przed UPDATE A (A-edit): B wygrywa wyścig jako pierwszy, zapisuje B-edit.
      const putB = await putReq({
        payload: buildPayload({ workoutStartedAtMs: 1000, operationId: "session-1", title: "B-edit" }),
        revision: 1,
        deviceId: deviceB,
      });
      expect(putB.status).toBe(200);
      expect(((await putB.json()) as { revision: number }).revision).toBe(2);
    });

    const putA = await putReq({
      payload: buildPayload({ workoutStartedAtMs: 1000, operationId: "session-1", title: "A-edit" }),
      revision: 1,
      deviceId: deviceA,
    });
    restore();

    expect(putA.status).toBe(409);
    const putABody = (await putA.json()) as {
      conflict: boolean;
      session: { revision: number; payload: { title: string } } | null;
    };
    expect(putABody.conflict).toBe(true);
    expect(putABody.session?.revision).toBe(2);
    expect(putABody.session?.payload.title).toBe("B-edit");

    // Dowód bezpośredni: B-edit NIETKNIĘTY — A nigdy nie napisał A-edit nad nim.
    const row = await client.execute({
      sql: `SELECT revision, payload_json FROM active_workout_sessions WHERE user_id = ?`,
      args: [userId],
    });
    expect(Number(row.rows[0]!.revision)).toBe(2);
    const storedPayload = JSON.parse(String(row.rows[0]!.payload_json)) as { title: string };
    expect(storedPayload.title).toBe("B-edit");
  });

  it("kontrola P2: DELETE z revision >> serverRevision (bez wstrzykniętego wyścigu, sekwencyjnie) zostaje zaakceptowany -- jednostronność >= NIE jest błędem i nie zmienia się przez naprawę CAS", async () => {
    const put1 = await putReq({ payload: buildPayload(), revision: 0, deviceId: "device-a-00000000" });
    expect(put1.status).toBe(200);
    const put2 = await putReq({
      payload: buildPayload({ title: "Trening 2" }),
      revision: 1,
      deviceId: "device-a-00000000",
    });
    expect(put2.status).toBe(200);
    expect(((await put2.json()) as { revision: number }).revision).toBe(2);

    // Klient z rewizją "z przyszłości" (1000000 >= 2, zamierzone zgodnie z p.1/p.16.2) ->
    // 200, wiersz wygaszony. CAS zmienia tylko ATOMOWOŚĆ zapisu, nie warunek porównania.
    const del = await deleteReq({ revision: 1000000 });
    expect(del.status).toBe(200);
    const delBody = (await del.json()) as { ok: boolean; revision: number };
    expect(delBody.revision).toBe(3);

    const row = await client.execute({
      sql: `SELECT revision FROM active_workout_sessions WHERE user_id = ?`,
      args: [userId],
    });
    expect(Number(row.rows[0]!.revision)).toBe(3);
  });

  it("dwa równoczesne PIERWSZE zapisy (INSERT) na tego samego użytkownika -> jeden sukces, drugi 409, NIGDY 500", async () => {
    const deviceA = "device-a-00000000";
    const deviceB = "device-b-00000000";

    const restore = injectRaceBeforeFirstWrite(async () => {
      // Tuż przed INSERT A: B wygrywa wyścig, wstawia wiersz jako PIERWSZY.
      const putB = await putReq({
        payload: buildPayload({ operationId: "session-b", title: "B-first" }),
        revision: 0,
        deviceId: deviceB,
      });
      expect(putB.status).toBe(200);
      expect(((await putB.json()) as { revision: number }).revision).toBe(1);
    });

    const putA = await putReq({
      payload: buildPayload({ operationId: "session-a", title: "A-first" }),
      revision: 0,
      deviceId: deviceA,
    });
    restore();

    // NIGDY 500 za przegraną wyścigu o INSERT — zawsze świeży 409.
    expect(putA.status).toBe(409);
    const putABody = (await putA.json()) as {
      conflict: boolean;
      session: { revision: number; deviceId: string; payload: { title: string } } | null;
    };
    expect(putABody.conflict).toBe(true);
    expect(putABody.session?.revision).toBe(1);
    expect(putABody.session?.deviceId).toBe(deviceB);
    expect(putABody.session?.payload.title).toBe("B-first");

    // Dowód bezpośredni: dokładnie jeden wiersz w bazie, należący do B.
    const rows = await client.execute(
      `SELECT COUNT(*) AS c FROM active_workout_sessions`,
    );
    expect(Number(rows.rows[0]!.c)).toBe(1);
    const row = await client.execute({
      sql: `SELECT payload_json FROM active_workout_sessions WHERE user_id = ?`,
      args: [userId],
    });
    const storedPayload = JSON.parse(String(row.rows[0]!.payload_json)) as { title: string };
    expect(storedPayload.title).toBe("B-first");
  });
});
