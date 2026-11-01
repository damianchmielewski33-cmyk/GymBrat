import { describe, expect, it } from "vitest";
import {
  muscleRecoveryState,
  pushPullBalance,
  volumeStatus,
} from "@/lib/analytics/volume-landmarks";
import type { MuscleGroupRow } from "@/lib/analytics/types";
import { pickReferenceSet } from "@/lib/last-workout-hints";
import { applyDeload } from "@/lib/set-progression-suggestion";

const row = (id: string, eff30: number) =>
  ({
    id,
    label: id,
    lastTrainedDate: null,
    week: { sets: 0, effectiveSets: 0, reps: 0, tonnageKg: 0, sharePct: 0 },
    days30: { sets: eff30, effectiveSets: eff30, reps: 0, tonnageKg: 0, sharePct: 0 },
    days90: { sets: 0, effectiveSets: 0, reps: 0, tonnageKg: 0, sharePct: 0 },
  }) as MuscleGroupRow;

describe("volume-landmarks", () => {
  it("status objętości względem zakresu", () => {
    expect(volumeStatus("klatka", 0)).toBe("none");
    expect(volumeStatus("klatka", 6)).toBe("below");
    expect(volumeStatus("klatka", 14)).toBe("ok");
    expect(volumeStatus("klatka", 25)).toBe("above");
  });

  it("regeneracja mięśnia wg dni od treningu", () => {
    expect(muscleRecoveryState(null, "2026-10-20").state).toBe("never");
    expect(muscleRecoveryState("2026-10-19", "2026-10-20").state).toBe("recovering");
    expect(muscleRecoveryState("2026-10-17", "2026-10-20").state).toBe("ready");
    expect(muscleRecoveryState("2026-10-10", "2026-10-20").state).toBe("rested");
  });

  it("balans pchanie/ciągnięcie", () => {
    const heavyPush = [row("klatka", 30), row("barki", 15), row("triceps", 10), row("plecy", 10), row("biceps", 5)];
    expect(pushPullBalance(heavyPush).status).toBe("push_heavy");
    expect(pushPullBalance([row("klatka", 2)]).status).toBe("insufficient");
  });
});

describe("pickReferenceSet", () => {
  const range = { min: 8, max: 10 };
  it("najlepsza seria topowa, gdy poniżej góry zakresu", () => {
    const sets = [
      { weight: 60, reps: 9 },
      { weight: 60, reps: 8 },
      { weight: 60, reps: 7 },
    ];
    expect(pickReferenceSet(sets, range)).toEqual({ set: sets[0], usedBest: true });
  });

  it("ostatnia seria, gdy najlepsza jest na górze zakresu", () => {
    const sets = [
      { weight: 60, reps: 10 },
      { weight: 60, reps: 9 },
    ];
    expect(pickReferenceSet(sets, range)?.set).toBe(sets[1]);
    expect(pickReferenceSet(sets, range)?.usedBest).toBe(false);
  });
});

describe("applyDeload z procentem", () => {
  it("10% schodzi głębiej niż 5%", () => {
    expect(applyDeload(100, 2.5, 0.1)).toBe(90);
    expect(applyDeload(100, 2.5, 0.05)).toBe(95);
  });
});

import { acuteChronicOf } from "@/lib/analytics/muscle-volume";

describe("acuteChronicOf", () => {
  it("pasma obciążenia", () => {
    expect(acuteChronicOf(10, 40).band).toBe("optimal"); // chronic 10/tydz.
    expect(acuteChronicOf(20, 50).band).toBe("spike"); // chronic 10
    expect(acuteChronicOf(5, 35).band).toBe("detraining"); // chronic 10
    expect(acuteChronicOf(10, 11).ratio).toBeNull();
  });
});
