import type { Client } from "@libsql/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import * as schema from "@/db/schema";
import { createMemoryDb } from "@/db/test-memory-db";

let db: Database;
let currentUserId = "u1";

vi.mock("@/db", () => ({ getDb: () => db }));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: currentUserId } }) }));
vi.mock("@/lib/csrf", () => ({ assertCsrf: () => null }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { PATCH } = await import("@/app/api/workouts/[workoutId]/cardio/route");

function patchReq(workoutId: string, body: Record<string, unknown>) {
  return PATCH(
    new Request(`http://localhost/api/workouts/${workoutId}/cardio`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ workoutId }) },
  );
}

async function seedWorkout(id: string, userId: string, exercisesObj: Record<string, unknown>) {
  await db.insert(schema.workouts).values({
    id,
    userId,
    workoutPlanId: null,
    date: "2026-10-20",
    cardioMinutes: 0,
    exercises: JSON.stringify(exercisesObj),
  });
}

describe("PATCH /api/workouts/[workoutId]/cardio (ADR 0004 p. 2, LR-4)", () => {
  let client: Client;

  beforeAll(async () => {
    ({ client, db } = await createMemoryDb());
  });

  afterAll(() => {
    client.close();
  });

  beforeEach(async () => {
    await client.execute("DELETE FROM workouts");
    currentUserId = "u1";
  });

  it("zapisuje minuty i obiekt cardio jako wartości absolutne", async () => {
    await seedWorkout("w1", "u1", {
      kind: "completed_session",
      title: "Trening",
      startedAt: 1,
      endedAt: 2,
      exercises: [],
    });

    const res = await patchReq("w1", {
      cardioMinutes: 25,
      cardio: { distanceKm: 4, avgHr: 130, steps: 3000 },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; cardioMinutes: number };
    expect(body.ok).toBe(true);
    expect(body.cardioMinutes).toBe(25);

    const rs = await client.execute("SELECT cardio_minutes, exercises FROM workouts WHERE id = 'w1'");
    expect(Number(rs.rows[0]!.cardio_minutes)).toBe(25);
    const exercisesJson = JSON.parse(String(rs.rows[0]!.exercises)) as Record<string, unknown>;
    expect(exercisesJson.cardioMinutes).toBe(25);
    expect((exercisesJson.cardio as Record<string, unknown>).distanceKm).toBe(4);
  });

  it("0 minut usuwa cały obiekt cardio z tętnem, kaloriami i krokami", async () => {
    await seedWorkout("w2", "u1", {
      kind: "completed_session",
      title: "Trening",
      startedAt: 1,
      endedAt: 2,
      exercises: [],
      cardioMinutes: 20,
      cardio: { avgHr: 140, calories: 300, steps: 4000 },
    });

    const res = await patchReq("w2", { cardioMinutes: 0 });
    expect(res.status).toBe(200);

    const rs = await client.execute("SELECT cardio_minutes, exercises FROM workouts WHERE id = 'w2'");
    expect(Number(rs.rows[0]!.cardio_minutes)).toBe(0);
    const exercisesJson = JSON.parse(String(rs.rows[0]!.exercises)) as Record<string, unknown>;
    expect(exercisesJson.cardioMinutes).toBeUndefined();
    expect(exercisesJson.cardio).toBeUndefined();
  });

  it("zwraca 404 (nie 403) dla treningu innego użytkownika", async () => {
    await seedWorkout("w3", "owner", {
      kind: "completed_session",
      title: "Trening",
      startedAt: 1,
      endedAt: 2,
      exercises: [],
    });
    currentUserId = "intruder";

    const res = await patchReq("w3", { cardioMinutes: 10 });
    expect(res.status).toBe(404);

    const rs = await client.execute("SELECT cardio_minutes FROM workouts WHERE id = 'w3'");
    expect(Number(rs.rows[0]!.cardio_minutes)).toBe(0);
  });

  it("zwraca 404 dla nieistniejącego treningu", async () => {
    const res = await patchReq("brak-takiego", { cardioMinutes: 10 });
    expect(res.status).toBe(404);
  });

  it("odrzuca nieprawidłowe dane (ujemne minuty)", async () => {
    await seedWorkout("w4", "u1", {
      kind: "completed_session",
      title: "Trening",
      startedAt: 1,
      endedAt: 2,
      exercises: [],
    });

    const res = await patchReq("w4", { cardioMinutes: -5 });
    expect(res.status).toBe(400);
  });
});
