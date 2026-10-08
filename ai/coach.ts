import "server-only";

import { z } from "zod";
import type { FitatuDaySummary } from "@/types/fitatu";

/**
 * Heurystyki planu / analizy zdjęć — bez wbudowanego modelu LLM.
 * Jedyny zewnętrzny AI w GymBrat to Pollinations (grafiki przepisów).
 */

export type AiImage = {
  mimeType: string;
  base64: string;
};

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export type CardioPerformance = {
  recent5kTimeSec?: number;
  vo2MaxEstimate?: number;
  restingHr?: number;
  maxHr?: number;
  notes?: string;
};

export type TrainingPlanInput = {
  age: number;
  weightKg: number;
  heightCm: number;
  activityLevel: ActivityLevel;
  goals: string[];
  daysPerWeek: number;
  experienceLevel?: "beginner" | "intermediate" | "advanced";
  equipment?: string[];
  injuriesOrLimitations?: string[];
  nutritionToday?: FitatuDaySummary | null;
  /** @deprecated użyj nutritionToday */
  fitatuNutrition?: FitatuDaySummary | null;
  cardioPerformance?: CardioPerformance;
};

const TrainingPlanSchema = z.object({
  overview: z.object({
    focus: z.array(z.string()).default([]),
    weeklyScheduleSummary: z.string(),
    safetyNotes: z.array(z.string()).default([]),
  }),
  days: z
    .array(
      z.object({
        day: z.union([
          z.literal(1),
          z.literal(2),
          z.literal(3),
          z.literal(4),
          z.literal(5),
          z.literal(6),
          z.literal(7),
        ]),
        title: z.string(),
        type: z.union([
          z.literal("strength"),
          z.literal("cardio"),
          z.literal("hybrid"),
          z.literal("rest"),
        ]),
        session: z.object({
          warmup: z.array(z.string()).default([]),
          main: z.array(
            z.object({
              name: z.string(),
              sets: z.number().int().min(0),
              reps: z.string(),
              restSec: z.number().int().min(0),
              notes: z.string(),
            }),
          ),
          cardio: z
            .object({
              mode: z.string(),
              durationMin: z.number().int().min(0),
              intensity: z.string(),
              notes: z.string(),
            })
            .nullable(),
          cooldown: z.array(z.string()).default([]),
        }),
      }),
    )
    .length(7),
  nutritionGuidance: z.object({
    proteinGPerDay: z.number().int().min(0),
    calorieTargetHint: z.string(),
    habitTips: z.array(z.string()).default([]),
  }),
});

export type TrainingPlan = z.infer<typeof TrainingPlanSchema>;

type DayNum = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const BodyAnalysisSchema = z.object({
  posture: z.object({
    summary: z.string(),
    flags: z.array(z.string()).default([]),
    confidence: z.union([z.literal("low"), z.literal("medium"), z.literal("high")]),
  }),
  proportions: z.object({
    summary: z.string(),
    notes: z.array(z.string()).default([]),
  }),
  bodyFatEstimate: z.object({
    percentRange: z.tuple([z.number().min(0).max(70), z.number().min(0).max(70)]),
    confidence: z.union([z.literal("low"), z.literal("medium"), z.literal("high")]),
    disclaimer: z.string(),
  }),
  recommendations: z.object({
    strengthPriorities: z.array(z.string()).default([]),
    mobilityPriorities: z.array(z.string()).default([]),
    habits: z.array(z.string()).default([]),
    photoRetakeTips: z.array(z.string()).default([]),
  }),
});

export type BodyAnalysis = z.infer<typeof BodyAnalysisSchema>;

const ProgressReportSchema = z.object({
  summary: z.string(),
  observations: z.object({
    composition: z.array(z.string()).default([]),
    posture: z.array(z.string()).default([]),
    symmetry: z.array(z.string()).default([]),
    confidence: z.union([z.literal("low"), z.literal("medium"), z.literal("high")]),
  }),
  wins: z.array(z.string()).default([]),
  focusNext: z.array(z.string()).default([]),
  measurementSuggestions: z.array(z.string()).default([]),
  photoStandardizationTips: z.array(z.string()).default([]),
});

export type ProgressReport = z.infer<typeof ProgressReportSchema>;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function heuristicProteinGPerDay(weightKg: number, goals: string[]) {
  const wantsCut = goals.some((g) => /cut|fat|lean|lose/i.test(g));
  const wantsGain = goals.some((g) => /bulk|gain|muscle/i.test(g));
  const factor = wantsCut ? 2.2 : wantsGain ? 2.0 : 1.8;
  return Math.round(weightKg * factor);
}

function makeHeuristicPlan(input: TrainingPlanInput): TrainingPlan {
  const protein = heuristicProteinGPerDay(input.weightKg, input.goals);
  const nutrition = input.nutritionToday ?? input.fitatuNutrition ?? null;
  const calorieHint =
    nutrition?.caloriesGoal != null
      ? `Keep calories near the profile goal (~${Math.round(nutrition.caloriesGoal)} kcal/day), adjusting by weekly progress.`
      : "Pick a calorie target based on weekly progress (aim for slow, consistent change).";

  const strengthDays = clamp(Math.round(input.daysPerWeek * 0.6), 2, 5);
  const cardioDays = clamp(input.daysPerWeek - strengthDays, 1, 4);

  const baseStrength = [
    { name: "Squat pattern", sets: 3, reps: "6-10", restSec: 120, notes: "RPE 7-8" },
    { name: "Hinge pattern", sets: 3, reps: "6-10", restSec: 120, notes: "Keep form strict" },
    { name: "Horizontal press", sets: 3, reps: "8-12", restSec: 90, notes: "Full ROM" },
    { name: "Row / pull", sets: 3, reps: "8-12", restSec: 90, notes: "Control eccentrics" },
    { name: "Core", sets: 2, reps: "30-60s", restSec: 60, notes: "Brace" },
  ];

  const dayTemplates: TrainingPlan["days"] = Array.from({ length: 7 }).map((_, i) => {
    const day = (i + 1) as DayNum;
    return {
      day,
      title: "Rest / Recovery",
      type: "rest" as const,
      session: { warmup: [], main: [], cardio: null, cooldown: ["Easy walk 10 min (optional)"] },
    };
  });

  const strengthSlots = [1, 3, 5, 6, 7].slice(0, strengthDays);
  const cardioSlots = [2, 4, 6, 7].filter((d) => !strengthSlots.includes(d)).slice(0, cardioDays);

  for (const d of strengthSlots as DayNum[]) {
    dayTemplates[d - 1] = {
      day: d,
      title: "Full Body Strength",
      type: "strength",
      session: {
        warmup: ["5-8 min easy cardio", "Dynamic hips/shoulders", "2 ramp-up sets first lift"],
        main: baseStrength,
        cardio: null,
        cooldown: ["Light stretching 5 min", "Breathing downshift 2 min"],
      },
    };
  }

  for (const d of cardioSlots as DayNum[]) {
    const has5k = input.cardioPerformance?.recent5kTimeSec != null;
    dayTemplates[d - 1] = {
      day: d,
      title: "Cardio + Mobility",
      type: "cardio",
      session: {
        warmup: ["5 min easy warm-up"],
        main: [],
        cardio: {
          mode: "Run / Bike / Incline walk",
          durationMin: has5k ? 35 : 25,
          intensity: has5k ? "Mostly easy (Zone 2), last 5 min moderate" : "Easy conversational pace",
          notes: "If joints are cranky, pick bike/elliptical.",
        },
        cooldown: ["5 min easy cool-down", "Hips/ankles mobility 8 min"],
      },
    };
  }

  return {
    overview: {
      focus: ["Consistency", "Progressive overload", "Sustainable cardio"],
      weeklyScheduleSummary: `A balanced week with ${strengthDays} strength day(s) and ${cardioDays} cardio day(s).`,
      safetyNotes: [
        "Stop sets 1-3 reps before failure if form breaks down.",
        "If you have pain (not just effort), modify the movement and reduce load.",
      ],
    },
    days: dayTemplates,
    nutritionGuidance: {
      proteinGPerDay: protein,
      calorieTargetHint: calorieHint,
      habitTips: [
        "Hit protein first at each meal.",
        "Walk 6–10k steps/day if feasible.",
        "Sleep 7–9 hours; keep wake time consistent.",
      ],
    },
  };
}

/** Plan treningowy — wyłącznie heurystyka (bez LLM). */
export async function generateTrainingPlan(
  input: TrainingPlanInput,
  _options?: { forceHeuristic?: boolean },
): Promise<TrainingPlan> {
  return makeHeuristicPlan(input);
}

export async function analyzeBodyPhoto(_input: {
  images: AiImage[];
  context?: { sex?: string; age?: number };
  forceHeuristic?: boolean;
}): Promise<BodyAnalysis> {
  return {
    posture: {
      summary:
        "Analiza zdjęć przez model LLM została usunięta z GymBrat. Zdjęcia możesz zapisać w postępach; ocena sylwetki — u trenera lub z pomiarów.",
      flags: [],
      confidence: "low",
    },
    proportions: { summary: "Niedostępne bez modelu AI.", notes: [] },
    bodyFatEstimate: {
      percentRange: [0, 0],
      confidence: "low",
      disclaimer:
        "GymBrat nie używa wbudowanego modelu AI do analizy zdjęć. Jedyny zewnętrzny AI to generowanie grafik przepisów (Pollinations).",
    },
    recommendations: {
      strengthPriorities: ["Full-body strength 2–4x/week"],
      mobilityPriorities: ["Thoracic + hips mobility 3–5x/week"],
      habits: ["Standardize photos weekly (same lighting/pose)."],
      photoRetakeTips: ["Front/side/back, neutral posture, consistent distance."],
    },
  };
}

export async function compareProgressPhotos(_input: {
  earlier: AiImage[];
  later: AiImage[];
  context?: unknown;
  forceHeuristic?: boolean;
}): Promise<ProgressReport> {
  return {
    summary:
      "Porównanie zdjęć przez model LLM zostało usunięte. Porównuj zdjęcia wizualnie albo przez pomiary (waga, obwody).",
    observations: { composition: [], posture: [], symmetry: [], confidence: "low" },
    wins: [],
    focusNext: [],
    measurementSuggestions: ["Track scale trend (weekly average).", "Waist/hips/chest measurements."],
    photoStandardizationTips: [
      "Same lighting, same camera distance, same time of day.",
      "Relaxed posture + consistent pose.",
    ],
  };
}
