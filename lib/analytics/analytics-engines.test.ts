import { describe, expect, it } from "vitest";
import { computeFatigueScore, fatigueBandOf } from "@/lib/analytics/fatigue-score";
import { computeRecoveryScore } from "@/lib/analytics/recovery-score";
import { computeMuscleBalance, contributionFromExercise } from "@/lib/analytics/muscle-volume";
import { classifyExerciseStagnation } from "@/lib/analytics/stagnation";
import { computeConsistencyScore } from "@/lib/analytics/consistency-score";
import { computeAdherenceScore } from "@/lib/analytics/adherence-score";
import { predictExercise } from "@/lib/analytics/prediction";
import { computeZoneMinutes } from "@/lib/analytics/cardio-hr-zones";
import { computeCardioLoad } from "@/lib/analytics/cardio-load";
import { estimateCardioCaloriesKeytel } from "@/lib/analytics/cardio-calories";
import { buildProgressIntelligence } from "@/lib/analytics/build-intelligence";
import type {
  AnalyticsStrengthSession,
  ExerciseSessionPoint,
} from "@/lib/analytics/types";

function session(
  date: string,
  tonnageKg: number,
  extra?: Partial<AnalyticsStrengthSession>,
): AnalyticsStrengthSession {
  return {
    id: date,
    date,
    tonnageKg,
    hardSetPct: 30,
    avgRpe: 7.5,
    avgRir: 2,
    setCount: 20,
    ...extra,
  };
}

describe("fatigue-score", () => {
  it("mapuje paski Fresh / Normal / Fatigued / Overreached", () => {
    expect(fatigueBandOf(20)).toBe("fresh");
    expect(fatigueBandOf(45)).toBe("normal");
    expect(fatigueBandOf(70)).toBe("fatigued");
    expect(fatigueBandOf(90)).toBe("overreached");
  });

  it("rośnie przy wysokim tonażu, hard sets i braku odpoczynku", () => {
    const today = "2026-10-19";
    const sessions = [
      session("2026-10-13", 12000, { hardSetPct: 55, avgRpe: 8.5 }),
      session("2026-10-14", 11000, { hardSetPct: 50, avgRpe: 8.2 }),
      session("2026-10-15", 13000, { hardSetPct: 60, avgRpe: 9 }),
      session("2026-10-16", 12500, { hardSetPct: 55, avgRpe: 8.8 }),
      session("2026-10-17", 14000, { hardSetPct: 65, avgRpe: 9 }),
      session("2026-10-18", 13500, { hardSetPct: 60, avgRpe: 8.7 }),
      session("2026-10-19", 15000, { hardSetPct: 70, avgRpe: 9.2 }),
    ];
    const low = computeFatigueScore({
      sessions: [session("2026-10-18", 2000, { hardSetPct: 10, avgRpe: 5 })],
      cardioLoadByEndDate: () => 0,
      consecutiveTrainingDays: 0,
      today,
    });
    const high = computeFatigueScore({
      sessions,
      cardioLoadByEndDate: () => 320,
      consecutiveTrainingDays: 5,
      today,
    });
    expect(high.score).toBeGreaterThan(low.score);
    expect(high.score).toBeGreaterThanOrEqual(50);
    expect(high.recommendation.length).toBeGreaterThan(10);
  });
});

describe("recovery-score", () => {
  it("fallback = 100 − fatigue gdy brak danych subiektywnych", () => {
    const r = computeRecoveryScore({
      fatigueScore: 74,
      subjective: null,
      cardioLoadWeek: 100,
    });
    expect(r.score).toBe(26);
    expect(r.source).toBe("inverse_fatigue");
  });

  it("używa snu / energii gdy dostępne", () => {
    const r = computeRecoveryScore({
      fatigueScore: 50,
      subjective: {
        sleepQuality: 9,
        dayEnergy: 8,
        stress: 2,
        weightDeltaKg7d: 0,
      },
      cardioLoadWeek: 50,
    });
    expect(r.source).toBe("subjective");
    expect(r.score).toBeGreaterThan(60);
    expect(r.readinessLine.length).toBeGreaterThan(5);
  });
});

describe("muscle-volume", () => {
  it("liczy serie i wykrywa dysproporcję plecy vs biceps", () => {
    const contributions = [];
    for (let i = 0; i < 12; i++) {
      contributions.push(
        contributionFromExercise({
          date: "2026-10-10",
          primaryRegion: "back_mid",
          secondaryRegions: ["biceps"],
          sets: 4,
          reps: 40,
          tonnageKg: 2000,
        }),
      );
    }
    contributions.push(
      contributionFromExercise({
        date: "2026-10-12",
        primaryRegion: "biceps",
        secondaryRegions: [],
        sets: 2,
        reps: 20,
        tonnageKg: 200,
      }),
    );
    const bal = computeMuscleBalance({
      contributions,
      today: "2026-10-19",
    });
    const plecy = bal.groups.find((g) => g.id === "plecy")!;
    const biceps = bal.groups.find((g) => g.id === "biceps")!;
    expect(plecy.days30.sets).toBeGreaterThan(biceps.days30.sets);
    expect(bal.alerts.some((a) => a.lowerId === "biceps")).toBe(true);
  });
});

describe("stagnation", () => {
  it("oznacza stagnację przy płaskim e1RM przez wiele dni", () => {
    const points: ExerciseSessionPoint[] = [];
    for (let i = 0; i < 10; i++) {
      const day = 1 + i * 3;
      points.push({
        date: `2026-09-${String(day).padStart(2, "0")}`,
        volumeKg: 3000,
        totalReps: 30,
        bestE1rm: 100,
        bestWeight: 80,
        bestReps: 8,
        hardSets: 1,
        scoredSets: 4,
        avgRpe: 7,
        avgRir: 2,
        setsCount: 4,
      });
    }
    const item = classifyExerciseStagnation({
      exerciseKey: "bench",
      name: "Bench Press",
      points,
      today: "2026-10-19",
    });
    expect(item).not.toBeNull();
    expect(item!.daysWithoutProgress).toBeGreaterThan(20);
    expect(["stagnating", "stable", "regressing"]).toContain(item!.status);
  });
});

describe("consistency + adherence", () => {
  it("liczy planned vs done i overall adherence", () => {
    const consistency = computeConsistencyScore({
      weeklySessionsTarget: 4,
      strengthDates: [
        "2026-10-13",
        "2026-10-15",
        "2026-10-17",
        "2026-10-19",
      ],
      today: "2026-10-19",
    });
    expect(consistency.week.planned).toBe(4);
    expect(consistency.week.done).toBe(4);
    expect(consistency.week.scorePct).toBe(100);

    const adherence = computeAdherenceScore({
      consistency,
      dietAdherencePct: 88,
      cardioAdherencePct: 71,
    });
    expect(adherence.trainingPct).toBe(100);
    expect(adherence.dietPct).toBe(88);
    expect(adherence.cardioPct).toBe(71);
    expect(adherence.overallPct).toBeGreaterThan(80);
  });
});

describe("prediction", () => {
  it("wymaga ≥8 punktów i zwraca e1RM 30/90d", () => {
    const points: ExerciseSessionPoint[] = [];
    for (let i = 0; i < 10; i++) {
      points.push({
        date: `2026-09-${String(i + 1).padStart(2, "0")}`,
        volumeKg: 2000 + i * 50,
        totalReps: 25,
        bestE1rm: 90 + i * 1.5,
        bestWeight: 70,
        bestReps: 8,
        hardSets: 1,
        scoredSets: 4,
        avgRpe: 7,
        avgRir: 2,
        setsCount: 4,
      });
    }
    const p = predictExercise({
      exerciseKey: "sq",
      name: "Squat",
      points,
    });
    expect(p).not.toBeNull();
    expect(p!.e1rm30d).toBeGreaterThan(p!.e1rmNow - 1);
    expect(["low", "medium", "high"]).toContain(p!.confidence);
  });
});

describe("cardio zones + load + kcal", () => {
  it("liczy strefy HR i load", () => {
    const samples = [
      {
        id: "1",
        date: "2026-10-18",
        minutes: 40,
        avgHr: 130,
        maxHr: 150,
        calories: null,
        distanceKm: 5,
        cardioType: "run",
        effortScore: 6,
        heartRateZone: null,
        title: "Bieg",
      },
      {
        id: "2",
        date: "2026-10-17",
        minutes: 30,
        avgHr: 155,
        maxHr: 170,
        calories: 320,
        distanceKm: null,
        cardioType: "bike",
        effortScore: 7,
        heartRateZone: 3,
        title: "Rower",
      },
    ];
    const zones = computeZoneMinutes({
      samples,
      ageYears: 30,
      today: "2026-10-19",
    });
    expect(zones.hrMax).toBe(190);
    expect(zones.zones.reduce((a, z) => a + z.minutes, 0)).toBeGreaterThan(0);

    const load = computeCardioLoad({
      samples,
      ageYears: 30,
      today: "2026-10-19",
    });
    expect(load.load).toBeGreaterThan(50);

    const kcal = estimateCardioCaloriesKeytel({
      minutes: 30,
      avgHr: 140,
      weightKg: 80,
      ageYears: 30,
      sex: "male",
    });
    expect(kcal).toBeGreaterThan(100);
  });
});

describe("buildProgressIntelligence", () => {
  it("składa pełny snapshot bez crashy", () => {
    const intel = buildProgressIntelligence({
      today: "2026-10-19",
      weeklySessionsTarget: 4,
      weeklyCardioGoalMinutes: 150,
      ageYears: 28,
      weightKg: 75,
      sex: "male",
      strengthSessions: [
        session("2026-10-17", 8000),
        session("2026-10-19", 8500),
      ],
      strengthDates: ["2026-10-17", "2026-10-19"],
      consecutiveTrainingDays: 1,
      exercises: [],
      muscleContributions: [],
      cardioSamples: [],
      subjective: null,
      dietAdherencePct: 90,
    });
    expect(intel.algorithmVersion).toBe("analytics_v1");
    expect(intel.fatigue.score).toBeGreaterThanOrEqual(0);
    expect(intel.recovery.score).toBeGreaterThanOrEqual(0);
    expect(intel.muscle.groups).toHaveLength(9);
    expect(intel.insights.length).toBeGreaterThanOrEqual(0);
  });
});
