import { beforeEach, describe, expect, it } from "vitest";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import type { WorkoutExerciseState } from "@/components/workout/types";

function seedTwoExercises(): WorkoutExerciseState[] {
  return [
    {
      id: "ex-a",
      name: "Przysiady",
      sets: [
        { reps: 8, weight: 60, done: true },
        { reps: 8, weight: 60, done: false },
        { reps: 8, weight: 60, done: false },
      ],
      targetReps: 8,
    },
    {
      id: "ex-b",
      name: "Martwy",
      sets: [
        { reps: 5, weight: 100, done: false },
        { reps: 5, weight: 100, done: false },
      ],
      targetReps: 5,
    },
  ];
}

function countDone(exercises: WorkoutExerciseState[]) {
  let done = 0;
  let total = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      total += 1;
      if (s.done) done += 1;
    }
  }
  return { done, total };
}

describe("active workout addSet + rest gate", () => {
  beforeEach(() => {
    useActiveWorkoutStore.getState().reset();
  });

  it("addSet appends incomplete set without wiping other progress", () => {
    const store = useActiveWorkoutStore.getState();
    store.setExercises(seedTwoExercises());
    store.patchSet("ex-a", 1, { done: true, weight: 62.5, reps: 8 });
    // Dokańczamy „ostatnią” przed dodaniem — nowa seria kopiuje ciężar z końca listy.
    store.patchSet("ex-a", 2, { done: true, weight: 65, reps: 8 });

    const newIndex = store.addSet("ex-a");
    expect(newIndex).toBe(3);

    const ex = useActiveWorkoutStore.getState().exercises.find((e) => e.id === "ex-a");
    expect(ex?.sets).toHaveLength(4);
    expect(ex?.sets[0]?.done).toBe(true);
    expect(ex?.sets[1]?.done).toBe(true);
    expect(ex?.sets[2]?.done).toBe(true);
    expect(ex?.sets[3]?.done).toBe(false);
    expect(ex?.sets[3]?.weight).toBe(65);
  });

  it("after addSet, completing a set is not treated as workout finished", () => {
    const store = useActiveWorkoutStore.getState();
    store.setExercises(seedTwoExercises());

    store.addSet("ex-a");
    store.patchSet("ex-a", 1, { done: true, weight: 60, reps: 8 });

    const { done, total } = countDone(useActiveWorkoutStore.getState().exercises);
    expect(total).toBe(6); // 4 + 2
    expect(done).toBe(2); // first set was already done + freshly completed
    expect(done >= total).toBe(false);
  });

  it("patchSet no-ops when index is out of range (missing added set would block rest)", () => {
    const store = useActiveWorkoutStore.getState();
    store.setExercises(seedTwoExercises());
    store.patchSet("ex-a", 99, { done: true, weight: 60, reps: 8 });
    const ex = useActiveWorkoutStore.getState().exercises.find((e) => e.id === "ex-a");
    expect(ex?.sets.every((s, i) => (i === 0 ? s.done : !s.done))).toBe(true);
  });
});
