import { describe, expect, it } from "vitest";
import type { WorkoutSetState } from "@/components/workout/types";
import { countHardStreak, countWarnStreak } from "@/lib/live-coach/streaks";

function set(over: Partial<WorkoutSetState>): WorkoutSetState {
  return { reps: 8, weight: 60, done: true, ...over };
}

describe("live-coach/streaks", () => {
  it("licz kolejne twarde serie wstecz od indeksu (wyłącznie)", () => {
    const sets = [
      set({ rir: 2 }),
      set({ rir: 0 }),
      set({ rir: 0 }),
      set({ done: false, reps: null, weight: 0 }),
    ];
    expect(countHardStreak(sets, 3)).toBe(2);
    expect(countHardStreak(sets, 2)).toBe(1);
    expect(countHardStreak(sets, 1)).toBe(0);
    expect(countHardStreak(sets, 0)).toBe(0);
  });

  it("RPE 10 bez RIR liczy się jak twarda, RPE 9 jak na styk", () => {
    const sets = [set({ rpe: 10 }), set({ rpe: 9 })];
    expect(countHardStreak(sets, 2)).toBe(0);
    expect(countHardStreak(sets, 1)).toBe(1);
    expect(countWarnStreak(sets, 2)).toBe(2);
  });

  it("przerywa na pierwszej niezaliczonej lub pominiętej serii", () => {
    const sets = [
      set({ rir: 0 }),
      set({ done: false, rir: 0 }),
      set({ rir: 0 }),
    ];
    expect(countHardStreak(sets, 3)).toBe(1);
    const skipped = [
      set({ rir: 0 }),
      set({ rir: 0, skipped: true }),
      set({ rir: 0 }),
    ];
    expect(countHardStreak(skipped, 3)).toBe(1);
  });

  it("warn streak obejmuje serie na styk i twarde", () => {
    const sets = [set({ rir: 1 }), set({ rir: 0 }), set({ rir: 1 })];
    expect(countWarnStreak(sets, 3)).toBe(3);
    expect(countHardStreak(sets, 3)).toBe(0);
  });

  it("kontekst ruchu: cel RIR 0 — seria do upadku nie buduje streaka", () => {
    const sets = [set({ rir: 0 }), set({ rir: 0 }), set({ rir: 0 })];
    const curl = { targetRirMin: 0 };
    expect(countHardStreak(sets, 3)).toBe(3);
    expect(countHardStreak(sets, 3, curl)).toBe(0);
    expect(countWarnStreak(sets, 3, curl)).toBe(0);
  });

  it("kontekst ruchu: cel RIR 1 — RIR 1 nie jest ostrzeżeniem", () => {
    const sets = [set({ rir: 1 }), set({ rir: 1 })];
    expect(countWarnStreak(sets, 2)).toBe(2);
    expect(countWarnStreak(sets, 2, { targetRirMin: 1 })).toBe(0);
  });

  it("brak danych o wysiłku nie jest streakiem", () => {
    const sets = [set({}), set({})];
    expect(countHardStreak(sets, 2)).toBe(0);
    expect(countWarnStreak(sets, 2)).toBe(0);
  });
});
