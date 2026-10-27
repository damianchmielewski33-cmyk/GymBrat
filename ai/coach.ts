import "server-only";

import { z } from "zod";

/**
 * Heurystyki analizy zdjęć — bez wbudowanego modelu LLM.
 * Jedyny zewnętrzny AI w GymBrat to Pollinations (grafiki przepisów).
 * Generator planu treningowego został usunięty (zadanie 008).
 */

export type AiImage = {
  mimeType: string;
  base64: string;
};

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
