import { describe, expect, it } from "vitest";
import type {
  WorkoutExerciseState,
  WorkoutSetState,
} from "@/components/workout/types";
import {
  buildSessionProgress,
  countSetsDone,
  isExerciseCompleted,
} from "@/lib/workout-session-progress";

const saved: WorkoutSetState = { reps: 8, weight: 50, done: true };
const skippedFlag: WorkoutSetState = {
  reps: 8,
  weight: 50,
  done: true,
  skipped: true,
};
/** 0 kg + powtórzenia = masa ciała, ZALICZONA (decyzja właściciela 005 p.7, ADR 0004 p.6). */
const bodyweightSaved: WorkoutSetState = { reps: 8, weight: 0, done: true };
const todo: WorkoutSetState = { reps: 8, weight: 0, done: false };

function ex(id: string, sets: WorkoutSetState[]): WorkoutExerciseState {
  return { id, name: id, sets };
}

describe("buildSessionProgress", () => {
  it("pusta lista", () => {
    expect(buildSessionProgress([], null)).toEqual({
      groups: [],
      savedSets: 0,
      skippedSets: 0,
      totalSets: 0,
      exercisesCompleted: 0,
      exercisesTotal: 0,
      currentOrdinal: null,
    });
  });

  it("grupy per ćwiczenie i stany: zapisana / pominięta (flaga) / masa ciała (0 kg, zaliczona) / bieżąca / do zrobienia", () => {
    const p = buildSessionProgress(
      [ex("a", [saved, skippedFlag, bodyweightSaved]), ex("b", [todo, todo])],
      { exerciseId: "b", setIndex: 0 },
    );
    expect(p.groups.map((g) => g.segments.map((s) => s.state))).toEqual([
      ["saved", "skipped", "saved"],
      ["current", "todo"],
    ]);
    expect(p.groups[1]!.exerciseIndex).toBe(1);
    expect(p.groups[1]!.segments[0]).toEqual({
      exerciseId: "b",
      setIndex: 0,
      state: "current",
      isCurrent: true,
    });
    expect(p.savedSets).toBe(2);
    expect(p.skippedSets).toBe(1);
    expect(p.totalSets).toBe(5);
    expect(p.exercisesTotal).toBe(2);
  });

  it("bieżąca zapisana = saved + isCurrent (BR-1)", () => {
    const p = buildSessionProgress([ex("a", [saved, todo])], {
      exerciseId: "a",
      setIndex: 0,
    });
    expect(p.groups[0]!.segments[0]).toMatchObject({
      state: "saved",
      isCurrent: true,
    });
    expect(p.groups[0]!.segments[1]).toMatchObject({
      state: "todo",
      isCurrent: false,
    });
    expect(p.currentOrdinal).toBe(1);
  });

  it("bieżąca pominięta = skipped + isCurrent", () => {
    const p = buildSessionProgress([ex("a", [skippedFlag])], {
      exerciseId: "a",
      setIndex: 0,
    });
    expect(p.groups[0]!.segments[0]).toMatchObject({
      state: "skipped",
      isCurrent: true,
    });
  });

  it("completed tylko bez pominięć; finished przy wszystkich done (BR-3)", () => {
    const p = buildSessionProgress(
      [
        ex("a", [saved, saved]),
        ex("b", [saved, skippedFlag]),
        ex("c", [saved, todo]),
      ],
      null,
    );
    expect(p.groups.map((g) => [g.completed, g.finished])).toEqual([
      [true, true],
      [false, true],
      [false, false],
    ]);
    expect(p.exercisesCompleted).toBe(1);
  });

  it("currentOrdinal po pominięciu: seria 4/Y (US-1)", () => {
    const p = buildSessionProgress(
      [ex("a", [saved, skippedFlag]), ex("b", [saved, todo, todo])],
      { exerciseId: "b", setIndex: 1 },
    );
    expect(p.currentOrdinal).toBe(4);
    expect(p.totalSets).toBe(5);
    expect(p.savedSets).toBe(2);
  });

  it("brak bieżącej albo nieznany cel -> currentOrdinal null, brak isCurrent", () => {
    const list = [ex("a", [todo])];
    expect(buildSessionProgress(list, null).currentOrdinal).toBeNull();
    const p = buildSessionProgress(list, { exerciseId: "x", setIndex: 0 });
    expect(p.currentOrdinal).toBeNull();
    expect(p.groups[0]!.segments[0]!.state).toBe("todo");
  });

  it("1 seria i 10 serii", () => {
    expect(
      buildSessionProgress([ex("a", [saved])], null).exercisesCompleted,
    ).toBe(1);
    const ten = Array.from({ length: 10 }, (_, i) => (i < 9 ? saved : todo));
    const p = buildSessionProgress([ex("a", ten)], {
      exerciseId: "a",
      setIndex: 9,
    });
    expect(p.savedSets).toBe(9);
    expect(p.currentOrdinal).toBe(10);
    expect(p.groups[0]!.completed).toBe(false);
  });

  it("ćwiczenie bez serii nie jest zaliczone ani zakończone", () => {
    const p = buildSessionProgress([ex("a", [])], null);
    expect(p.groups[0]).toMatchObject({ completed: false, finished: false });
    expect(isExerciseCompleted(ex("a", []))).toBe(false);
  });
});

describe("countSetsDone", () => {
  it("liczy done (zapisane i pominięte) oraz wszystkie serie", () => {
    expect(countSetsDone([])).toEqual({ done: 0, total: 0 });
    expect(
      countSetsDone([ex("a", [saved, skippedFlag]), ex("b", [todo])]),
    ).toEqual({ done: 2, total: 3 });
  });
});

describe("buildSessionProgress: właściwości i skala (zadanie 004, tester)", () => {
  // Deterministyczny generator (bez Math.random): powtarzalne przypadki.
  function lcg(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 2 ** 32;
    };
  }
  const variants: WorkoutSetState[] = [saved, skippedFlag, bodyweightSaved, todo];

  it("inwariant: zapisane + pominięte + niezakończone = wszystkie; bieżąca jest dokładnie jedna", () => {
    const rnd = lcg(42);
    for (let run = 0; run < 200; run++) {
      const exercises = Array.from({ length: 1 + Math.floor(rnd() * 8) }, (_, i) =>
        ex(
          `e${i}`,
          Array.from({ length: 1 + Math.floor(rnd() * 10) }, () =>
            variants[Math.floor(rnd() * variants.length)]!,
          ),
        ),
      );
      const target = exercises[Math.floor(rnd() * exercises.length)]!;
      const setIndex = Math.floor(rnd() * target.sets.length);
      const p = buildSessionProgress(exercises, { exerciseId: target.id, setIndex });
      const all = p.groups.flatMap((g) => g.segments);
      const open = all.filter((s) => s.state === "todo" || s.state === "current").length;
      expect(p.savedSets + p.skippedSets + open).toBe(p.totalSets);
      expect(all).toHaveLength(p.totalSets);
      expect(all.filter((s) => s.isCurrent)).toHaveLength(1);
      expect(p.currentOrdinal).toBeGreaterThanOrEqual(1);
      expect(p.currentOrdinal).toBeLessThanOrEqual(p.totalSets);
      for (const g of p.groups) {
        if (g.completed) expect(g.segments.every((s) => s.state === "saved")).toBe(true);
      }
    }
  });

  it("60 serii (NFR): liczniki i numer bieżącej serii", () => {
    const exercises = Array.from({ length: 6 }, (_, i) =>
      ex(`e${i}`, Array.from({ length: 10 }, (_, j) => (i < 3 ? saved : j === 0 ? skippedFlag : todo))),
    );
    const p = buildSessionProgress(exercises, { exerciseId: "e3", setIndex: 1 });
    expect(p.totalSets).toBe(60);
    expect(p.savedSets).toBe(30);
    expect(p.skippedSets).toBe(3);
    expect(p.currentOrdinal).toBe(32);
    expect(p.exercisesCompleted).toBe(3);
  });
});
