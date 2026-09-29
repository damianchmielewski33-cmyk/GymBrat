import { z } from "zod";

const ApproxMacrosSchema = z.object({
  calories: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
});

const MealItemSchema = z.object({
  title: z.string().min(1).max(160),
  tagline: z.string().max(240).optional(),
  ingredients: z.array(z.string()).min(2).max(24),
  steps: z.array(z.string()).min(2).max(18),
  approximateMacros: ApproxMacrosSchema,
  imagePromptEn: z.string().max(400).optional(),
});

export const MealSuggestionsResponseSchema = z.object({
  /** Cztery wyraźnie różne propozycje (zgodnie z promptem modelu). */
  meals: z.array(MealItemSchema).length(4),
});

export type MealSuggestionItem = z.infer<typeof MealItemSchema> & {
  /** Opcjonalny prompt opisowy (nie generuje już obrazu AI). */
  imagePrompt?: string;
  /** Stały HTTPS URL grafiki (preferowany). */
  imageUrl?: string;
};
