import { describe, expect, it } from "vitest";
import {
  formatExercisePreview,
  pickQueuedPlan,
  polishCwAbbreviation,
  startWorkoutHref,
} from "@/lib/workout-days";

describe("pickQueuedPlan", () => {
  it("wybiera plan nigdy nie trenowany przed trenowanymi", () => {
    const next = pickQueuedPlan([
      { id: "a", lastWorkoutDate: "2026-09-20", updatedAt: "2026-09-01" },
      { id: "b", lastWorkoutDate: null, updatedAt: "2026-09-02" },
    ]);
    expect(next?.id).toBe("b");
  });

  it("wybiera najdawniej trenowany", () => {
    const next = pickQueuedPlan([
      { id: "a", lastWorkoutDate: "2026-09-21", updatedAt: "2026-09-01" },
      { id: "b", lastWorkoutDate: "2026-09-18", updatedAt: "2026-09-02" },
    ]);
    expect(next?.id).toBe("b");
  });

  it("zwraca null dla pustej listy", () => {
    expect(pickQueuedPlan([])).toBeNull();
  });
});

describe("formatExercisePreview", () => {
  it("łączy nazwy kropką i skraca", () => {
    expect(formatExercisePreview(["A", "B", "C", "D", "E"])).toBe("A · B · C · D · …");
  });

  it("obsługuje pustą listę", () => {
    expect(formatExercisePreview([])).toBe("Brak ćwiczeń");
  });
});

describe("startWorkoutHref", () => {
  it("uruchamia plan od razu", () => {
    expect(startWorkoutHref("abc")).toBe("/start-workout?planId=abc&autostart=1");
  });
});

describe("polishCwAbbreviation", () => {
  it("skraca liczbę ćwiczeń", () => {
    expect(polishCwAbbreviation(7)).toBe("7 ćw.");
  });
});
