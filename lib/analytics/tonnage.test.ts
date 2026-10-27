import { describe, expect, it } from "vitest";
import { computeSessionTonnageKg } from "@/lib/analytics/tonnage";

describe("computeSessionTonnageKg", () => {
  it("sums performed external-load sets and excludes skipped and incomplete sets", () => {
    expect(computeSessionTonnageKg([
      { sets: [
        { reps: 8, weight: 50, done: true },
        { reps: 5, weight: 60, done: true, skipped: true },
        { reps: 10, weight: 40, done: false },
        { reps: 12, weight: 0, done: true },
      ] },
    ])).toBe(400);
  });

  it("accepts completed-session JSON and rounds to one decimal", () => {
    expect(computeSessionTonnageKg(JSON.stringify({ kind: "completed_session", exercises: [
      { sets: [{ reps: 3, weight: 12.35, done: true }] },
    ] }))).toBe(37.1);
  });
});
