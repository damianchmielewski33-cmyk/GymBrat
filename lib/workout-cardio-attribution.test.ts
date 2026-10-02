import { describe, expect, it } from "vitest";
import {
  countableCardioMinutes,
  isCompletedStrengthSession,
  isStandaloneCardioLog,
} from "@/lib/workout-cardio-attribution";

describe("workout-cardio-attribution", () => {
  it("traktuje cardio_log jako samodzielne cardio", () => {
    const parsed = { kind: "cardio_log", title: "Bieżnia" };
    expect(isStandaloneCardioLog(parsed, 25)).toBe(true);
    expect(countableCardioMinutes(parsed, 25)).toBe(25);
  });

  it("liczy minuty z popupu przy completed_session z ćwiczeniami", () => {
    const parsed = {
      kind: "completed_session",
      exercises: [{ id: "1", name: "Przysiad", sets: [] }],
    };
    expect(isCompletedStrengthSession(parsed)).toBe(true);
    expect(isStandaloneCardioLog(parsed, 20)).toBe(false);
    expect(countableCardioMinutes(parsed, 20)).toBe(20);
  });

  it("zwraca 0 gdy brak minut", () => {
    const parsed = {
      kind: "completed_session",
      exercises: [{ id: "1", name: "Przysiad", sets: [] }],
    };
    expect(countableCardioMinutes(parsed, 0)).toBe(0);
  });
});
