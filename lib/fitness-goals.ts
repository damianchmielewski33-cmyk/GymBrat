import { z } from "zod";

export const fitnessGoalsSchema = z.object({
  weeklySessionsTarget: z.number().int().min(1).max(14).optional(),
  exerciseTargets: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        targetKg: z.number().positive().max(1000).optional(),
      }),
    )
    .max(12)
    .optional(),
});

export type FitnessGoals = z.infer<typeof fitnessGoalsSchema>;

export function parseFitnessGoalsJson(raw: string | null | undefined): FitnessGoals {
  if (!raw?.trim()) return {};
  try {
    const j = JSON.parse(raw) as unknown;
    const p = fitnessGoalsSchema.safeParse(j);
    return p.success ? p.data : {};
  } catch {
    return {};
  }
}

export function fitnessGoalsToJson(goals: FitnessGoals): string | null {
  const p = fitnessGoalsSchema.safeParse(goals);
  if (!p.success) return null;
  const v = p.data;
  if (!v.weeklySessionsTarget && !v.exerciseTargets?.length) return null;
  return JSON.stringify(v);
}
