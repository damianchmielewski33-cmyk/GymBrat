import { describe, expect, it } from "vitest";
import {
  ACTIVE_WORKOUT_CLOUD_CLEARED_PAYLOAD,
  hasActiveLocalSession,
  isActiveWorkoutCloudPayload,
} from "@/lib/active-workout-cloud";

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
