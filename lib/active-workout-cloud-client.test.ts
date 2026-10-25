import { beforeEach, describe, expect, it, vi } from "vitest";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import type { ActiveWorkoutCloudPayload } from "@/lib/active-workout-cloud";
import {
  ACTIVE_SESSION_REVISION_KEY,
  applyCloudPayload,
  deleteCloud,
  putCloud,
  readRevision,
  shouldApplyConflictPayload,
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
    it("ustawia stan sesji w store z payloadu chmury", () => {
      applyCloudPayload({
        startedAt: 1000,
        pausedElapsedSeconds: 5,
        workoutStartedAtMs: 1000,
        title: "Trening A",
        workoutPlanId: "plan-1",
        cardioMinutes: 0,
        exercises: [{ id: "a", name: "Przysiad", sets: [] }],
        selectedExerciseId: null,
      });

      const s = useActiveWorkoutStore.getState();
      expect(s.title).toBe("Trening A");
      expect(s.workoutPlanId).toBe("plan-1");
      expect(s.exercises).toHaveLength(1);
    });

    it("payload wygaszony zeruje stan sesji w store", () => {
      applyCloudPayload({
        startedAt: null,
        pausedElapsedSeconds: 0,
        workoutStartedAtMs: null,
        title: "",
        workoutPlanId: null,
        cardioMinutes: 0,
        exercises: [],
        selectedExerciseId: null,
      });

      const s = useActiveWorkoutStore.getState();
      expect(s.workoutPlanId).toBeNull();
      expect(s.exercises).toHaveLength(0);
    });
  });

  describe("shouldApplyConflictPayload (005, B-1d)", () => {
    function payload(overrides: Partial<ActiveWorkoutCloudPayload>): ActiveWorkoutCloudPayload {
      return {
        startedAt: null,
        pausedElapsedSeconds: 0,
        workoutStartedAtMs: null,
        title: "",
        workoutPlanId: null,
        cardioMinutes: 0,
        exercises: [],
        selectedExerciseId: null,
        ...overrides,
      };
    }

    const activeLocal = payload({
      workoutPlanId: "plan-1",
      workoutStartedAtMs: 1000,
      exercises: [{ id: "a", name: "Przysiad", sets: [] }],
    });
    const emptyConflict = payload({});

    it("false, gdy lokalna sesja jest aktywna, a payload konfliktu jest pusty/wygaszony bez tożsamości", () => {
      expect(shouldApplyConflictPayload(activeLocal, emptyConflict)).toBe(false);
    });

    it("true, gdy obie sesje są puste", () => {
      expect(shouldApplyConflictPayload(emptyConflict, emptyConflict)).toBe(true);
    });

    it("true, gdy payload konfliktu jest również aktywny (prawdziwy konflikt do rozwiązania)", () => {
      const otherActive = payload({
        workoutPlanId: "plan-2",
        workoutStartedAtMs: 2000,
        exercises: [{ id: "b", name: "Wyciskanie", sets: [] }],
      });
      expect(shouldApplyConflictPayload(activeLocal, otherActive)).toBe(true);
    });

    it("true, gdy lokalna sesja jest pusta (nic do stracenia)", () => {
      expect(shouldApplyConflictPayload(emptyConflict, activeLocal)).toBe(true);
    });

    it("N-P13-1 scenariusz 1: A kończy sesję S1, B ma lokalnie aktywną tę samą sesję S1 → true (przyjmij wygaszenie)", () => {
      const localActiveS1 = payload({
        workoutPlanId: "plan-1",
        workoutStartedAtMs: 1000,
        exercises: [{ id: "a", name: "Przysiad", sets: [] }],
      });
      const clearedS1 = payload({ clearedSessionStartedAtMs: 1000 });
      expect(shouldApplyConflictPayload(localActiveS1, clearedS1)).toBe(true);
    });

    it("N-P13-1 scenariusz 2: B ma lokalnie aktywną inną sesję S2, tombstone niesie S1 → false (lokalna wygrywa, bez regresji do B-1d)", () => {
      const localActiveS2 = payload({
        workoutPlanId: "plan-2",
        workoutStartedAtMs: 2000,
        exercises: [{ id: "b", name: "Wyciskanie", sets: [] }],
      });
      const clearedS1 = payload({ clearedSessionStartedAtMs: 1000 });
      expect(shouldApplyConflictPayload(localActiveS2, clearedS1)).toBe(false);
    });

    it("tombstone bez tożsamości (clearedSessionStartedAtMs: null, np. wygaszenie wiersza uszkodzonego) → false", () => {
      const clearedWithoutIdentity = payload({ clearedSessionStartedAtMs: null });
      expect(shouldApplyConflictPayload(activeLocal, clearedWithoutIdentity)).toBe(false);
    });

    it("005, N-P13-6, ADR 0004 p.15.5 scenariusz (d): C (zaległy, wciąż S1) przyjmuje tombstone S1 nawet po idempotentnym DELETE innego urządzenia (tożsamość zachowana, nie null)", () => {
      const localS1 = payload({
        workoutPlanId: "plan-1",
        workoutStartedAtMs: 1000,
        exercises: [{ id: "a", name: "Przysiad", sets: [] }],
      });
      const tombstoneAfterRepeatedDelete = payload({ clearedSessionStartedAtMs: 1000 });
      expect(shouldApplyConflictPayload(localS1, tombstoneAfterRepeatedDelete)).toBe(true);
    });
  });

  describe("deleteCloud (005, N-P13-7, ADR 0004 p.16)", () => {
    it("wysyła revision w ciele żądania DELETE", async () => {
      let capturedUrl = "";
      let capturedInit: RequestInit | undefined;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
          capturedUrl = url;
          capturedInit = init;
          return {
            ok: true,
            status: 200,
            headers: { get: () => null },
            json: async () => ({ ok: true, revision: 6 }),
          };
        }),
      );

      const result = await deleteCloud(5);

      expect(result).toEqual({ ok: true, revision: 6 });
      expect(capturedUrl).toBe("/api/active-workout-session");
      expect(capturedInit?.method).toBe("DELETE");
      expect(JSON.parse(capturedInit?.body as string)).toEqual({ revision: 5 });
    });

    it("zwraca conflict z sesją serwera przy 409", async () => {
      const serverSession = {
        payload: {
          startedAt: null,
          pausedElapsedSeconds: 0,
          workoutStartedAtMs: null,
          title: "",
          workoutPlanId: null,
          cardioMinutes: 0,
          exercises: [],
          selectedExerciseId: null,
        },
        revision: 3,
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

      const result = await deleteCloud(0);

      expect(result.ok).toBe(false);
      expect(result.conflict).toEqual(serverSession);
    });

    it("zwraca ok + revision przy sukcesie (200)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          status: 200,
          json: async () => ({ ok: true, revision: 0 }),
        })),
      );

      const result = await deleteCloud(0);

      expect(result).toEqual({ ok: true, revision: 0 });
    });

    it("zwraca { ok: false, status }, gdy serwer odpowiada błędem innym niż 409", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: false,
          status: 400,
          headers: { get: () => null },
          json: async () => ({}),
        })),
      );

      const result = await deleteCloud(0);

      expect(result).toEqual({ ok: false, status: 400 });
    });

    it("005 P1: niesie status 401, żeby wołający nie ponawiał automatycznie (brak sesji)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: false,
          status: 401,
          headers: { get: () => null },
          json: async () => ({ ok: false, error: "Brak sesji." }),
        })),
      );

      const result = await deleteCloud(0);

      expect(result).toEqual({ ok: false, status: 401 });
    });

    it("005 P2: niesie retryAfterSec z nagłówka Retry-After przy 429", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: false,
          status: 429,
          headers: { get: (name: string) => (name === "Retry-After" ? "20" : null) },
          json: async () => ({ ok: false, error: "Za dużo żądań." }),
        })),
      );

      const result = await deleteCloud(0);

      expect(result).toEqual({ ok: false, status: 429, retryAfterSec: 20 });
    });
  });

  describe("putCloud", () => {
    const payload = {
      startedAt: 1000,
      pausedElapsedSeconds: 0,
      workoutStartedAtMs: 1000,
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

    it("005 P2: niesie status i retryAfterSec przy 429, żeby wołający zastosował backoff z Retry-After", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: false,
          status: 429,
          headers: { get: (name: string) => (name === "Retry-After" ? "15" : null) },
          json: async () => ({ ok: false, error: "Za dużo żądań." }),
        })),
      );

      const result = await putCloud(payload, 1, "dev-1");

      expect(result).toEqual({ ok: false, status: 429, retryAfterSec: 15 });
    });

    it("005 P1: niesie status 401, żeby wołający nie ponawiał automatycznie (brak sesji)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: false,
          status: 401,
          headers: { get: () => null },
          json: async () => ({ ok: false, error: "Brak sesji." }),
        })),
      );

      const result = await putCloud(payload, 1, "dev-1");

      expect(result).toEqual({ ok: false, status: 401 });
    });
  });
});
