import type { Client } from "@libsql/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import { createMemoryDb } from "@/db/test-memory-db";

let db: Database;
const userId = "u1";

vi.mock("@/db", () => ({ getDb: () => db }));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: userId } }) }));
vi.mock("@/lib/csrf", () => ({ assertCsrf: () => null }));
vi.mock("@/lib/java-api", () => ({
  isJavaApiEnabled: () => false,
  fetchJavaApi: async () => null,
  passThroughJavaResponse: (res: Response) => res,
}));

const publishTeamFeedAfterWorkout = vi.fn(async () => undefined);
vi.mock("@/lib/community/team-feed-auto", () => ({ publishTeamFeedAfterWorkout }));
// `revalidatePath` wymaga kontekstu żądania Next (static generation store), którego nie ma
// przy wywołaniu handlera wprost z Vitest — zastępujemy no-opem jak w testach innych tras.
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { POST } = await import("@/app/api/workouts/complete/route");

function completeReq(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/workouts/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function basePayload(operationId: string): Record<string, unknown> {
  return {
    title: "Trening nóg",
    startedAt: Date.parse("2026-10-20T10:00:00Z"),
    endedAt: Date.parse("2026-10-20T11:00:00Z"),
    cardioMinutes: 0,
    exercises: [
      {
        id: "1",
        name: "Przysiad",
        sets: [{ reps: 5, weight: 100, done: true }],
      },
    ],
    operationId,
  };
}

describe("POST /api/workouts/complete — idempotencja zapisu (ADR 0004 p. 1, LR-3)", () => {
  let client: Client;

  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
  });

  afterAll(() => {
    client.close();
  });

  beforeEach(async () => {
    await client.execute("DELETE FROM workouts");
    publishTeamFeedAfterWorkout.mockClear();
  });

  it("ponowienie z tym samym operationId zwraca ten sam workoutId, bez drugiego wiersza i bez drugiej publikacji w feedzie", async () => {
    const operationId = "11111111-1111-4111-8111-111111111111";
    const payload = basePayload(operationId);

    const res1 = await completeReq(payload);
    expect(res1.status).toBe(200);
    const body1 = (await res1.json()) as { ok: boolean; workoutId: string; duplicate: boolean };
    expect(body1.ok).toBe(true);
    expect(body1.duplicate).toBe(false);
    expect(typeof body1.workoutId).toBe("string");

    const res2 = await completeReq(payload);
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as { ok: boolean; workoutId: string; duplicate: boolean };
    expect(body2.ok).toBe(true);
    expect(body2.duplicate).toBe(true);
    expect(body2.workoutId).toBe(body1.workoutId);

    const rows = await client.execute("SELECT COUNT(*) AS c FROM workouts");
    expect(Number(rows.rows[0]!.c)).toBe(1);
    expect(publishTeamFeedAfterWorkout).toHaveBeenCalledTimes(1);
  });

  it("dwa różne operationId dla tego samego użytkownika tworzą dwa odrębne wiersze", async () => {
    await completeReq(basePayload("11111111-1111-4111-8111-111111111111"));
    await completeReq(basePayload("22222222-2222-4222-8222-222222222222"));

    const rows = await client.execute("SELECT COUNT(*) AS c FROM workouts");
    expect(Number(rows.rows[0]!.c)).toBe(2);
    expect(publishTeamFeedAfterWorkout).toHaveBeenCalledTimes(2);
  });

  it("odrzuca żądanie bez operationId (pole wymagane)", async () => {
    const payload = basePayload("33333333-3333-4333-8333-333333333333");
    delete payload.operationId;

    const res = await completeReq(payload);
    expect(res.status).toBe(400);

    const rows = await client.execute("SELECT COUNT(*) AS c FROM workouts");
    expect(Number(rows.rows[0]!.c)).toBe(0);
  });

  it("odrzuca operationId, który nie jest UUID", async () => {
    const res = await completeReq(basePayload("nie-uuid"));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/workouts/complete — defense in depth: kolizja operationId między różnymi sesjami (005, B-1b, ADR 0004 p.12)", () => {
  let client: Client;

  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
  });

  afterAll(() => {
    client.close();
  });

  beforeEach(async () => {
    await client.execute("DELETE FROM workouts");
    publishTeamFeedAfterWorkout.mockClear();
  });

  it("żądanie z operationId istniejącego wiersza, ale startedAt różnym o > 2s, zwraca 409 conflict zamiast fałszywego sukcesu", async () => {
    const operationId = "44444444-4444-4444-8444-444444444444";
    const first = basePayload(operationId);
    const res1 = await completeReq(first);
    expect(res1.status).toBe(200);
    const body1 = (await res1.json()) as { workoutId: string };

    const collidingPayload = {
      ...basePayload(operationId),
      // startedAt różni się o więcej niż tolerancja 2000 ms od zapisanego wiersza —
      // to jest inna sesja, nie retry tego samego zapisu.
      startedAt: Date.parse("2026-10-20T10:00:05Z"),
    };
    const res2 = await completeReq(collidingPayload);
    expect(res2.status).toBe(409);
    const body2 = (await res2.json()) as { ok: boolean; conflict: boolean; error: string };
    expect(body2.ok).toBe(false);
    expect(body2.conflict).toBe(true);
    expect(typeof body2.error).toBe("string");

    // Nie powstał drugi wiersz, oryginalny trening jest nienaruszony.
    const rows = await client.execute("SELECT COUNT(*) AS c FROM workouts");
    expect(Number(rows.rows[0]!.c)).toBe(1);
    expect(publishTeamFeedAfterWorkout).toHaveBeenCalledTimes(1);
    void body1;
  });

  it("ponowienie z tym samym operationId i startedAt w granicy tolerancji (<=2s) wciąż traktowane jako duplikat", async () => {
    const operationId = "55555555-5555-4555-8555-555555555555";
    const first = basePayload(operationId);
    const res1 = await completeReq(first);
    expect(res1.status).toBe(200);
    const body1 = (await res1.json()) as { workoutId: string };

    const retry = {
      ...basePayload(operationId),
      startedAt: Date.parse("2026-10-20T10:00:01.500Z"),
    };
    const res2 = await completeReq(retry);
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as { ok: boolean; duplicate: boolean; workoutId: string };
    expect(body2.ok).toBe(true);
    expect(body2.duplicate).toBe(true);
    expect(body2.workoutId).toBe(body1.workoutId);
  });
});
