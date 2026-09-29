export const RECIPE_IMAGE_FALLBACK =
  "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200";

export type RecipeImageSource = {
  id?: string | null;
  title?: string | null;
  /** Preferowane pole promptu (spec Pollinations). */
  imagePrompt?: string | null;
  /** Istniejące pole katalogu / AI (EN). */
  imagePromptEn?: string | null;
};

/** Stabilny seed z id — ten sam przepis = ten sam wariant obrazu. */
export function recipeImageSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h % 1_000_000_000);
}

/**
 * Dynamiczny URL obrazu posiłku z Pollinations AI.
 * Nie generuje plików lokalnie — tylko buduje URL do wyświetlenia.
 */
export function getRecipeImage(recipe: RecipeImageSource): string {
  const dish =
    (recipe.imagePrompt ?? "").trim() ||
    (recipe.imagePromptEn ?? "").trim() ||
    (recipe.title ?? "").trim() ||
    "healthy fitness meal";

  const title = (recipe.title ?? "").trim();

  // Tytuł + konkretny opis dania na początku — model rzadziej podmienia składniki.
  const fullPrompt = [
    title ? `Meal name: ${title}` : null,
    `Exact plated dish: ${dish}`,
    "show only these listed ingredients, accurate food identity",
    "do not replace the dish with a different meal",
    "no unrelated salad, no avocado unless listed, no cucumber salad unless listed",
    "single serving, centered on plate or bowl, appetizing",
    "professional food photography, realistic food, natural lighting, high detail, 4k",
    "no people, no hands, no text, no logo, no watermark",
  ]
    .filter(Boolean)
    .join(", ");

  const params = new URLSearchParams({
    width: "640",
    height: "400",
    nologo: "true",
  });
  const id = (recipe.id ?? "").trim();
  if (id) params.set("seed", String(recipeImageSeed(id)));

  return `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?${params.toString()}`;
}
