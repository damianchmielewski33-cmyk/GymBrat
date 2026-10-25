import { beforeEach, describe, expect, it, vi } from "vitest";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import {
  ACTIVE_SESSION_REVISION_KEY,
  applyCloudPayload,
  deleteCloud,
  putCloud,
  readRevision,
  writeRevision,
} from "@/lib/active-workout-cloud-client";

/**
 * Testy logiki klienta chmury aktywnej sesji bez DOM (ADR 0004 p.12, zalecenie
 * testera sekcja 9.8 "B-1 (test)") — wydzielone z komponentu `"use client"`
 * `ActiveWorkoutCloudSync`, żeby `fetch`/`localStorage` dało się testować atrapami.
 */
describe("active-workout-cloud-client", () => {
  beforeEach(() => {
    useActiveWorkoutStore.getState().reset();
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
      key: () => null,
      length: 0,
    };
    vi.stubGlobal("localStorage", storage);
  });

  describe("readRevision/writeRevision", () => {
    it("domyślnie zwraca 0, gdy nic nie zapisano", () => {
      expect(readRevision()).toBe(0);
    });

    it("zapisuje i odczytuje rewizję", () => {
      writeRevision(6);
      expect(readRevision()).toBe(6);
      expect(localStorage.getItem(ACTIVE_SESSION_REVISION_KEY)).toBe("6");
    });

    it("ignoruje wartości ujemne / nieliczbowe, zwraca 0", () => {
      localStorage.setItem(ACTIVE_SESSION_REVISION_KEY, "-3");
      expect(readRevision()).toBe(0);
    });
  });

  describe("applyCloudPayload", () => {
    it("ustawia stan sesji w store z payloadu chmury, zachowując operationId", () => {
      applyCloudPayload({
        startedAt: 1000,
        pausedElapsedSeconds: 5,
        workoutStartedAtMs: 1000,
        operationId: "op-abc",
        title: "Trening A",
        workoutPlanId: "plan-1",
        cardioMinutes: 0,
        exercises: [{ id: "a", name: "Przysiad", sets: [] }],
        selectedExerciseId: null,
      });

      const s = useActiveWorkoutStore.getState();
      expect(s.title).toBe("Trening A");
      expect(s.operationId).toBe("op-abc");
      expect(s.workoutPlanId).toBe("plan-1");
      expect(s.exercises).toHaveLength(1);
    });

    it("payload wygaszony (operationId: null) czyści operationId w store", () => {
      useActiveWorkoutStore.setState({ operationId: "stary-op" });

      applyCloudPayload({
        startedAt: null,
        pausedElapsedSeconds: 0,
        workoutStartedAtMs: null,
        operationId: null,
        title: "",
        workoutPlanId: null,
        cardioMinutes: 0,
        exercises: [],
        selectedExerciseId: null,
      });

      expect(useActiveWorkoutStore.getState().operationId).toBeNull();
    });
  });

  describe("deleteCloud (005, B-1b)", () => {
    it("zapisuje rewizję zwróconą przez serwer (nigdy sztywne 0)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          json: async () => ({ ok: true, revision: 6 }),
        })),
      );

      const ok = await deleteCloud();

      expect(ok).toBe(true);
      expect(readRevision()).toBe(6);
    });

    it("gdy odpowiedź nie zawiera revision, nie nadpisuje lokalnej wartości", async () => {
      writeRevision(3);
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          json: async () => ({ ok: true }),
        })),
      );

      await deleteCloud();

      expect(readRevision()).toBe(3);
    });

    it("zwraca false, gdy serwer odpowiada błędem", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));

      const ok = await deleteCloud();

      expect(ok).toBe(false);
    });
  });

  describe("putCloud", () => {
    const payload = {
      startedAt: 1000,
      pausedElapsedSeconds: 0,
      workoutStartedAtMs: 1000,
      operationId: "op-1",
      title: "Trening",
      workoutPlanId: "plan-1",
      cardioMinutes: 0,
      exercises: [],
      selectedExerciseId: null,
    };

    it("zwraca ok + revision przy sukcesie", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          status: 200,
          json: async () => ({ ok: true, revision: 2 }),
        })),
      );

      const result = await putCloud(payload, 1, "dev-1");

      expect(result).toEqual({ ok: true, revision: 2 });
    });

    it("zwraca conflict z sesją serwera przy 409", async () => {
      const serverSession = {
        payload: { ...payload, title: "Sesja B" },
        revision: 7,
        deviceId: "dev-2",
        updatedAt: Date.now(),
      };
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: false,
          status: 409,
          json: async () => ({ ok: false, conflict: true, session: serverSession }),
        })),
      );

      const result = await putCloud(payload, 1, "dev-1");

      expect(result.ok).toBe(false);
      expect(result.conflict).toEqual(serverSession);
    });
  });
});
