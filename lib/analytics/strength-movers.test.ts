import { describe, expect, it } from "vitest";
import {
  buildPredictionAggregate,
  buildStrengthMovers,
} from "@/lib/analytics/strength-movers";
import type {
  PredictionItem,
  StrengthVelocitySnapshot,
} from "@/lib/analytics/types";

function win(days7: number | null, days30: number | null, days90: number | null) {
  return { days7, days30, days90 };
}

describe("strength-movers", () => {
  it("ranks rising and falling by 30d volume", () => {
    const velocity: StrengthVelocitySnapshot = {
      overall: {
        e1rmPct: win(null, 2, null),
        volumePct: win(null, 4, null),
      },
      exercises: [
        {
          exerciseKey: "a",
          name: "Przysiad",
          e1rmPct: win(null, 8, null),
          volumePct: win(null, 12, null),
        },
        {
          exerciseKey: "b",
          name: "Martwy",
          e1rmPct: win(null, -2, null),
          volumePct: win(null, -9, null),
        },
        {
          exerciseKey: "c",
          name: "Wyciskanie",
          e1rmPct: win(null, 1, null),
          volumePct: win(null, 1, null),
        },
      ],
      byMuscle: [],
    };

    const movers = buildStrengthMovers(velocity, 5);
    expect(movers.rising.map((m) => m.name)).toEqual(["Przysiad"]);
    expect(movers.falling.map((m) => m.name)).toEqual(["Martwy"]);
  });

  it("aggregates prediction deltas", () => {
    const predictions: PredictionItem[] = [
      {
        exerciseKey: "a",
        name: "Przysiad",
        sampleCount: 12,
        confidence: "medium",
        e1rmNow: 100,
        e1rm30d: 110,
        e1rm90d: 120,
        tonnageNow: 1000,
        tonnage30d: 1100,
        tonnage90d: 1200,
      },
      {
        exerciseKey: "b",
        name: "Martwy",
        sampleCount: 10,
        confidence: "low",
        e1rmNow: 140,
        e1rm30d: 147,
        e1rm90d: 154,
        tonnageNow: 2000,
        tonnage30d: 1900,
        tonnage90d: 1800,
      },
    ];

    const agg = buildPredictionAggregate(predictions);
    expect(agg.count).toBe(2);
    expect(agg.avgE1rmDeltaPct30).toBe(7.5); // (10 + 5) / 2
    expect(agg.items[0]!.name).toBe("Przysiad");
  });
});
