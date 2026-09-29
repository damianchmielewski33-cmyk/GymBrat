export const RECIPE_IMAGE_FALLBACK =
  "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200";

export type RecipeImageSource = {
  title?: string | null;
  /** Preferowane pole promptu (spec Pollinations). */
  imagePrompt?: string | null;
  /** Istniejące pole katalogu / AI (EN). */
  imagePromptEn?: string | null;
};

/**
 * Dynamiczny URL obrazu posiłku z Pollinations AI.
 * Nie generuje plików lokalnie — tylko buduje URL do wyświetlenia.
 */
export function getRecipeImage(recipe: RecipeImageSource): string {
  const prompt =
    (recipe.imagePrompt ?? "").trim() ||
    (recipe.imagePromptEn ?? "").trim() ||
    (recipe.title ?? "").trim() ||
    "healthy fitness meal";

  return `https://image.pollinations.ai/prompt/${encodeURIComponent(
    `${prompt}, healthy fitness meal, professional food photography, realistic food, natural lighting, high detail, 4k`,
  )}`;
}
