import "server-only";

import { completeChat } from "@/ai/client";
import { isAiConfigured } from "@/ai/client";
import {
  mealSuggestionsSystemPrompt,
  mealSuggestionsUserPrompt,
  type MealSuggestionsPromptInput,
} from "@/ai/prompts/mealSuggestions";
import {
  MealSuggestionsResponseSchema,
  staticFallbackMeals,
  type MealSuggestionItem,
} from "@/lib/meal-suggestions-schema";

export type { MealSuggestionItem } from "@/lib/meal-suggestions-schema";
export { staticFallbackMeals } from "@/lib/meal-suggestions-schema";
export { MealSuggestionsResponseSchema } from "@/lib/meal-suggestions-schema";

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function generateMealSuggestionsFromModel(
  input: MealSuggestionsPromptInput,
): Promise<MealSuggestionItem[]> {
  if (!isAiConfigured()) {
    return staticFallbackMeals();
  }

  const messages = [
    { role: "system" as const, content: mealSuggestionsSystemPrompt() },
    { role: "user" as const, content: mealSuggestionsUserPrompt(input) },
  ];

  const raw = await completeChat(messages, { model: process.env.AI_MODEL });
  const parsed = safeJsonParse(raw.trim());
  const result = MealSuggestionsResponseSchema.safeParse(parsed);
  if (result.success) return result.data.meals;
  return staticFallbackMeals();
}
