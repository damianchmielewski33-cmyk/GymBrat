import { beforeEach, describe, expect, it, vi } from "vitest";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import {
  persistActiveWorkoutLocalNow,
  snapshotActiveWorkoutPayload,
} from "@/lib/active-workout-persist";

describe("active workout continuous persist", () => {
  beforeEach(() => {
    useActiveWorkoutStore.getState().reset();
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
      clear: () => map.clear(),
      key: () => null,
      length: 0,
    };
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("window", { localStorage: storage });
  });

  it("writes current sets to localStorage immediately", () => {
    useActiveWorkoutStore.setState({
      workoutPlanId: "plan-1",
      title: "Push",
      exercises: [
        {
          id: "ex-1",
          name: "Wyciskanie",
          sets: [{ reps: 10, weight: 42.5, done: true }],
        },
      ],
    });

    persistActiveWorkoutLocalNow();
    const raw = localStorage.getItem("active-workout");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as {
      state: ReturnType<typeof snapshotActiveWorkoutPayload>;
    };
    expect(parsed.state.workoutPlanId).toBe("plan-1");
    expect(parsed.state.exercises[0]?.sets[0]?.weight).toBe(42.5);
    expect(parsed.state.exercises[0]?.sets[0]?.done).toBe(true);
  });
});
