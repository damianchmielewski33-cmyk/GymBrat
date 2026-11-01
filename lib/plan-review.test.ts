import { describe, expect, it } from "vitest";
import type { ExerciseSessionPoint } from "@/lib/analytics/types";
import {
  applyPlanChanges,
  buildPlanReview,
  type PlanReviewExercise,
} from "@/lib/plan-review";

const pt = (date: string, e: number): ExerciseSessionPoint => ({
  date,
  volumeKg: 1000,
  totalReps: 30,
  bestE1rm: e,
  bestWeight: 60,
  bestReps: 8,
  hardSets: 0,
  scoredSets: 0,
  avgRpe: null,
  avgRir: null,
  setsCount: 3,
});
const hist = (vals: number[]) =>
  vals.map((v, i) => pt(`2026-09-${String(1 + i * 4).padStart(2, "0")}`, v));
const ex = (o: Partial<PlanReviewExercise>): PlanReviewExercise => ({
  id: "a",
  name: "Wyciskanie",
  sets: 3,
  reps: 8,
  muscle: "klatka",
  history: hist([100, 101, 102, 103]),
  stagnation: "progressing",
  ...o,
});
const base = {
  today: "2026-10-20",
  fatigueScore: 40,
  recentSessionCount: 20,
  weeklyEffectiveSets: {},
};

describe("buildPlanReview", () => {
  it("za mało sesji → brak propozycji", () => {
    const r = buildPlanReview({ ...base, recentSessionCount: 3, exercises: [ex({})] });
    expect(r.insufficientData).toBe(true);
    expect(r.proposals).toHaveLength(0);
  });

  it("niska objętość → +1 seria", () => {
    const r = buildPlanReview({
      ...base,
      weeklyEffectiveSets: { klatka: 5 },
      exercises: [ex({})],
    });
    expect(r.proposals[0]).toMatchObject({ kind: "add_set", change: { sets: 4 } });
  });

  it("wysokie zmęczenie → deload i brak dokładania serii", () => {
    const r = buildPlanReview({
      ...base,
      fatigueScore: 80,
      weeklyEffectiveSets: { klatka: 5 },
      exercises: [ex({})],
    });
    expect(r.proposals.map((p) => p.kind)).toEqual(["deload_week"]);
  });

  it("długa stagnacja → wymiana ćwiczenia", () => {
    const r = buildPlanReview({
      ...base,
      exercises: [
        ex({
          stagnation: "stagnating",
          history: hist([105, 100, 99, 98, 99, 98, 97]),
        }),
      ],
    });
    expect(r.proposals.some((p) => p.kind === "swap_exercise")).toBe(true);
  });

  it("nadmiar objętości + stagnacja → −1 seria", () => {
    const r = buildPlanReview({
      ...base,
      weeklyEffectiveSets: { klatka: 30 },
      exercises: [
        ex({ sets: 5, stagnation: "stagnating", history: hist([100, 100, 100]) }),
      ],
    });
    expect(r.proposals.find((p) => p.kind === "remove_set")?.change).toEqual({
      sets: 4,
    });
  });
});

describe("applyPlanChanges", () => {
  it("stosuje zmiany z limitami", () => {
    const out = applyPlanChanges(
      [
        { id: "a", sets: 3, reps: 8 },
        { id: "b", sets: 3, reps: 8 },
      ],
      [{ exerciseId: "a", sets: 99, reps: 12 }],
    );
    expect(out[0]).toEqual({ id: "a", sets: 6, reps: 12 });
    expect(out[1]).toEqual({ id: "b", sets: 3, reps: 8 });
  });
});

import { suggestAlternatives } from "@/lib/plan-alternatives";
import { computeAdherence, mesocycleAt } from "@/lib/mesocycle";
import { replaceExerciseInPlan } from "@/lib/plan-review";

describe("plan-review rozszerzenia", () => {
  it("deload dostaje gotową zmianę serii (−40%)", () => {
    const r = buildPlanReview({
      ...base,
      fatigueScore: 80,
      exercises: [ex({ sets: 5 }), ex({ id: "b", sets: 3, muscle: "plecy" })],
    });
    const d = r.proposals.find((p) => p.kind === "deload_week");
    expect(d?.bulk).toEqual([
      { exerciseId: "a", sets: 3 },
      { exerciseId: "b", sets: 2 },
    ]);
  });

  it("niska realizacja serii → −1 seria", () => {
    const r = buildPlanReview({
      ...base,
      exercises: [
        ex({
          sets: 4,
          adherence: { sessions: 5, plannedSets: 20, doneSets: 8, completion: 0.4 },
        }),
      ],
    });
    expect(r.proposals[0]).toMatchObject({ id: "adherence-a", change: { sets: 3 } });
  });

  it("skok obciążenia mięśnia blokuje dokładanie serii", () => {
    const r = buildPlanReview({
      ...base,
      weeklyEffectiveSets: { klatka: 5 },
      acuteChronicBand: { klatka: "spike" },
      exercises: [ex({})],
    });
    expect(r.proposals.some((p) => p.kind === "add_set")).toBe(false);
  });

  it("wymiana ćwiczenia dostaje nowe id", () => {
    const out = replaceExerciseInPlan(
      [{ id: "a", name: "A", categoryId: "x" }],
      "a",
      { id: "c1", name: "B", categoryId: "y" },
      "new-id",
    );
    expect(out[0]).toEqual({ id: "new-id", name: "B", categoryId: "y" });
  });

  it("zamienniki: ta sama kategoria, bez ćwiczeń z planu", () => {
    const catalog = [
      { id: "1", name: "Wyciskanie A", categoryId: "chest", equipment: ["barbell"] },
      { id: "2", name: "Wyciskanie B", categoryId: "chest", equipment: ["dumbbell"] },
      { id: "3", name: "Rozpiętki", categoryId: "chest", equipment: ["dumbbell"] },
      { id: "4", name: "Przysiad", categoryId: "legs", equipment: ["barbell"] },
    ];
    const alts = suggestAlternatives({
      name: "Wyciskanie A",
      categoryId: "chest",
      planNames: ["Wyciskanie B"],
      catalog,
    });
    expect(alts.map((a) => a.name)).toEqual(["Rozpiętki"]);
  });

  it("mezocykl liczony od rewizji + realizacja", () => {
    const m = mesocycleAt({
      revisions: [{ id: "r1", date: "2026-10-01" }],
      planStart: "2026-09-01",
      today: "2026-10-16",
    });
    expect(m).toEqual({ index: 2, revisionId: "r1", weekInBlock: 3 });
    expect(
      computeAdherence([
        { plannedSets: 4, doneSets: 4 },
        { plannedSets: 4, doneSets: 2 },
      ]).completion,
    ).toBe(0.75);
  });
});
