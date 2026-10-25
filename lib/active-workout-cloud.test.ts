import { describe, expect, it } from "vitest";
import {
  ACTIVE_WORKOUT_CLOUD_CLEARED_PAYLOAD,
  hasActiveLocalSession,
  isActiveWorkoutCloudPayload,
} from "@/lib/active-workout-cloud";

/**
 * 005, defekt B-1: `operationId` musi podróżować w payloadzie chmury, inaczej
 * wznowienie sesji na innym urządzeniu generuje nowy klucz idempotencji i albo
 * duplikuje zapis, albo cicho pomija zapis nowej sesji (traktując ją jako
 * duplikat innej, starszej sesji z tym samym kluczem).
 */
function basePayload() {
  return {
    startedAt: 1000,
    pausedElapsedSeconds: 0,
    workoutStartedAtMs: 1000,
    title: "Trening",
    workoutPlanId: "plan-1",
    cardioMinutes: 0,
    exercises: [],
    selectedExerciseId: null,
  };
}

describe("isActiveWorkoutCloudPayload: operationId (005, B-1)", () => {
  it("akceptuje payload z operationId jako string", () => {
    expect(isActiveWorkoutCloudPayload({ ...basePayload(), operationId: "op-1" })).toBe(true);
  });

  it("akceptuje payload z operationId: null", () => {
    expect(isActiveWorkoutCloudPayload({ ...basePayload(), operationId: null })).toBe(true);
  });

  it("akceptuje payload bez pola operationId (rekordy sprzed tej zmiany)", () => {
    expect(isActiveWorkoutCloudPayload(basePayload())).toBe(true);
  });

  it("odrzuca payload z operationId innego typu niż string/null", () => {
    expect(isActiveWorkoutCloudPayload({ ...basePayload(), operationId: 123 })).toBe(false);
  });
});

/**
 * 005, defekt B-1b: wygaszony payload zapisywany w miejsce fizycznego DELETE
 * nigdy nie może wyglądać jak aktywna sesja do wznowienia.
 */
describe("ACTIVE_WORKOUT_CLOUD_CLEARED_PAYLOAD (005, B-1b)", () => {
  it("jest poprawnym ActiveWorkoutCloudPayload", () => {
    expect(isActiveWorkoutCloudPayload(ACTIVE_WORKOUT_CLOUD_CLEARED_PAYLOAD)).toBe(true);
  });

  it("hasActiveLocalSession zwraca false dla wygaszonego payloadu", () => {
    expect(hasActiveLocalSession(ACTIVE_WORKOUT_CLOUD_CLEARED_PAYLOAD)).toBe(false);
  });
});
