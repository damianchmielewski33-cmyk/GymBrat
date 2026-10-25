import { describe, expect, it } from "vitest";
import { deriveWorkoutOperationId } from "@/lib/workout-operation-id";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ADR 0004 p.13 (pivot): `operationId` wyliczany deterministycznie z
 * (workoutPlanId, startedAtMs) — nie generowany losowo, nie synchronizowany jako
 * stan przez chmurę. Testy regresji wymagane w p.13.4.
 */
describe("deriveWorkoutOperationId", () => {
  it("jest deterministyczny: te same argumenty dają identyczny wynik", async () => {
    const a = await deriveWorkoutOperationId("plan-1", 1_700_000_000_000);
    const b = await deriveWorkoutOperationId("plan-1", 1_700_000_000_000);
    expect(a).toBe(b);
  });

  it("różny startedAtMs daje różny wynik", async () => {
    const a = await deriveWorkoutOperationId("plan-1", 1_700_000_000_000);
    const b = await deriveWorkoutOperationId("plan-1", 1_700_000_000_001);
    expect(a).not.toBe(b);
  });

  it("różny workoutPlanId (w tym null) daje różny wynik", async () => {
    const a = await deriveWorkoutOperationId("plan-1", 1_700_000_000_000);
    const b = await deriveWorkoutOperationId("plan-2", 1_700_000_000_000);
    const c = await deriveWorkoutOperationId(null, 1_700_000_000_000);
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(b).not.toBe(c);
  });

  it("zwraca format UUID (v5) — zgodny z z.string().uuid() w /api/workouts/complete", async () => {
    const id = await deriveWorkoutOperationId("plan-1", 1_700_000_000_000);
    expect(id).toMatch(UUID_RE);
    // Wersja 5 w czwartej grupie, wariant RFC 4122 w piątej.
    expect(id[14]).toBe("5");
    expect(["8", "9", "a", "b"]).toContain(id[19]!.toLowerCase());
  });

  it("dwa urządzenia liczą ten sam operationId bez komunikacji między sobą", async () => {
    const planId = "plan-1";
    const startedAtMs = 1_700_000_000_000;
    const deviceA = await deriveWorkoutOperationId(planId, startedAtMs);
    const deviceB = await deriveWorkoutOperationId(planId, startedAtMs); // osobne wywołanie, zero stanu współdzielonego
    expect(deviceA).toBe(deviceB);
  });
});
