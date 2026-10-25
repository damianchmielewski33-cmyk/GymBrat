import { describe, expect, it } from "vitest";
import {
  buildActiveWorkoutClearedPayload,
  hasActiveLocalSession,
  isActiveWorkoutCloudPayload,
  resolveClearedSessionIdentity,
  type ActiveWorkoutCloudPayload,
} from "@/lib/active-workout-cloud";

/**
 * 005, defekt B-1b: wygaszony payload zapisywany w miejsce fizycznego DELETE
 * nigdy nie może wyglądać jak aktywna sesja do wznowienia.
 */
describe("buildActiveWorkoutClearedPayload (005, B-1b)", () => {
  it("jest poprawnym ActiveWorkoutCloudPayload", () => {
    expect(isActiveWorkoutCloudPayload(buildActiveWorkoutClearedPayload(null))).toBe(true);
  });

  it("hasActiveLocalSession zwraca false dla wygaszonego payloadu", () => {
    expect(hasActiveLocalSession(buildActiveWorkoutClearedPayload(null))).toBe(false);
  });

  it("niesie tożsamość wygaszonej sesji (005, N-P13-1, ADR 0004 p.14)", () => {
    expect(buildActiveWorkoutClearedPayload(12345).clearedSessionStartedAtMs).toBe(12345);
    expect(buildActiveWorkoutClearedPayload(null).clearedSessionStartedAtMs).toBeNull();
    expect(hasActiveLocalSession(buildActiveWorkoutClearedPayload(12345))).toBe(false);
  });
});

describe("isActiveWorkoutCloudPayload — pole clearedSessionStartedAtMs (005, N-P13-1)", () => {
  function basePayload(overrides: Record<string, unknown> = {}) {
    return {
      startedAt: null,
      pausedElapsedSeconds: 0,
      workoutStartedAtMs: 1000,
      title: "Trening",
      workoutPlanId: "plan-1",
      cardioMinutes: 0,
      exercises: [],
      selectedExerciseId: null,
      ...overrides,
    };
  }

  it("akceptuje payload bez pola clearedSessionStartedAtMs", () => {
    expect(isActiveWorkoutCloudPayload(basePayload())).toBe(true);
  });

  it("akceptuje clearedSessionStartedAtMs jako number", () => {
    expect(
      isActiveWorkoutCloudPayload(basePayload({ clearedSessionStartedAtMs: 1000 })),
    ).toBe(true);
  });

  it("akceptuje clearedSessionStartedAtMs jako null", () => {
    expect(
      isActiveWorkoutCloudPayload(basePayload({ clearedSessionStartedAtMs: null })),
    ).toBe(true);
  });

  it("odrzuca clearedSessionStartedAtMs o nieprawidłowym typie", () => {
    expect(
      isActiveWorkoutCloudPayload(basePayload({ clearedSessionStartedAtMs: "1000" })),
    ).toBe(false);
  });
});

/**
 * 005, naprawa N-P13-6 (ADR 0004 p.15): tożsamość do zapisania w NOWYM tombstonie
 * zależy od tego, co jest w wierszu AKTUALNIE — aktywna sesja niesie SWOJĄ tożsamość,
 * ale wiersz, który jest JUŻ tombstone'em, musi zachować istniejącą tożsamość
 * (`clearedSessionStartedAtMs`), nie czytać `workoutStartedAtMs` (zawsze `null` na
 * tombstonie) jako nową.
 */
describe("resolveClearedSessionIdentity (005, N-P13-6, ADR 0004 p.15.2)", () => {
  function activePayload(workoutStartedAtMs: number | null): ActiveWorkoutCloudPayload {
    return {
      startedAt: workoutStartedAtMs,
      pausedElapsedSeconds: 0,
      workoutStartedAtMs,
      title: "Trening",
      workoutPlanId: "plan-1",
      cardioMinutes: 0,
      exercises: [{ id: "1", name: "Przysiad", sets: [] }] as never,
      selectedExerciseId: null,
    };
  }

  it("payload nieparsowalny (null) -> null", () => {
    expect(resolveClearedSessionIdentity(null)).toBeNull();
  });

  it("aktywna sesja -> jej workoutStartedAtMs", () => {
    expect(resolveClearedSessionIdentity(activePayload(500))).toBe(500);
  });

  it("już tombstone z tożsamością -> zachowuje clearedSessionStartedAtMs (NIE null, choćby workoutStartedAtMs tombstone'u jest null)", () => {
    const tombstone = buildActiveWorkoutClearedPayload(777);
    expect(tombstone.workoutStartedAtMs).toBeNull();
    expect(resolveClearedSessionIdentity(tombstone)).toBe(777);
  });

  it("już tombstone bez tożsamości (nigdy nie miał realnej sesji) -> null", () => {
    const tombstone = buildActiveWorkoutClearedPayload(null);
    expect(resolveClearedSessionIdentity(tombstone)).toBeNull();
  });
});
