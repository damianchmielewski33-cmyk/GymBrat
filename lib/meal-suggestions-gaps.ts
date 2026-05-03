import type { FitatuDaySummary } from "@/types/fitatu";

export type MacroGaps = {
  dateKey: string;
  caloriesConsumed: number;
  caloriesGoal: number | null;
  proteinConsumed: number;
  proteinGoal: number | null;
  fatConsumed: number;
  fatGoal: number | null;
  carbsConsumed: number;
  carbsGoal: number | null;
  caloriesRemaining: number | null;
  proteinRemaining: number | null;
  fatRemaining: number | null;
  carbsRemaining: number | null;
  hasAnyMacroGoal: boolean;
  hasCalorieGoal: boolean;
};

function rem(goal: number | undefined | null, consumed: number): number | null {
  if (goal == null || !Number.isFinite(goal) || goal <= 0) return null;
  return Math.max(0, Math.round(goal - consumed));
}

export function computeMacroGaps(summary: FitatuDaySummary): MacroGaps {
  const g = summary.macroGoals;
  const m = summary.macros;
  const calGoal = summary.caloriesGoal;
  const pGoal = g?.protein;
  const fGoal = g?.fat;
  const cGoal = g?.carbs;

  return {
    dateKey: summary.date,
    caloriesConsumed: summary.caloriesConsumed,
    caloriesGoal: calGoal ?? null,
    proteinConsumed: m.protein,
    proteinGoal: pGoal ?? null,
    fatConsumed: m.fat,
    fatGoal: fGoal ?? null,
    carbsConsumed: m.carbs,
    carbsGoal: cGoal ?? null,
    caloriesRemaining: rem(calGoal ?? null, summary.caloriesConsumed),
    proteinRemaining: rem(pGoal ?? null, m.protein),
    fatRemaining: rem(fGoal ?? null, m.fat),
    carbsRemaining: rem(cGoal ?? null, m.carbs),
    hasAnyMacroGoal:
      (pGoal != null && pGoal > 0) ||
      (fGoal != null && fGoal > 0) ||
      (cGoal != null && cGoal > 0) ||
      (calGoal != null && calGoal > 0),
    hasCalorieGoal: calGoal != null && calGoal > 0,
  };
}

/** Ilustracja poglądowa (zewnętrzny generator na podstawie bezpiecznego promptu). */
export function mealIllustrationUrl(title: string, imagePromptEn?: string | null): string {
  const dish = (title || "healthy meal").trim().slice(0, 80);
  const extra = (imagePromptEn ?? "").trim().slice(0, 120);
  const prompt = [
    "Professional food photography, single plate, appetizing, natural light, restaurant quality, no text, no logo",
    dish,
    extra,
  ]
    .filter(Boolean)
    .join(", ");
  const q = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${q}?width=640&height=400&nologo=true`;
}
