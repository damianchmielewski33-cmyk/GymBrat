export const RECIPE_IMAGE_FALLBACK =
  "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200";

/** Stałe fallbacki Unsplash — 1:1 z meal_00N, zawsze te same. */
const FALLBACK_BY_INDEX = [
  "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=1200", // oatmeal
  "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=1200", // eggs
  "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=1200", // chicken rice
  "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=1200", // plated protein
  "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=1200", // pasta
  "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=1200", // wrap
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1200", // salad
  "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=1200", // cottage/fruit
  "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=1200", // smoothie
  "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=1200", // salmon
] as const;

export type RecipeImageSource = {
  id?: string | null;
  title?: string | null;
  imagePrompt?: string | null;
  imagePromptEn?: string | null;
};

/** Stabilny seed z id — ten sam przepis = ten sam wariant Pollinations. */
export function recipeImageSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h % 1_000_000_000) || 1;
}

/** Klucz cache — ten sam przepis zawsze ten sam slot. */
export function recipeImageCacheKey(recipe: RecipeImageSource): string {
  const id = (recipe.id ?? "").trim();
  if (id) return `id:${id}`;
  const title = (recipe.title ?? "").trim().toLowerCase();
  const prompt = (recipe.imagePrompt ?? recipe.imagePromptEn ?? "").trim().toLowerCase();
  const raw = `${title}|${prompt}` || "unknown";
  return `h:${recipeImageSeed(raw)}`;
}

export function getRecipeImageFallback(recipe: RecipeImageSource): string {
  const id = (recipe.id ?? "").trim();
  if (id) {
    const m = /^meal_(\d+)$/i.exec(id);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 1) {
        return FALLBACK_BY_INDEX[(n - 1) % FALLBACK_BY_INDEX.length] ?? RECIPE_IMAGE_FALLBACK;
      }
    }
    return FALLBACK_BY_INDEX[recipeImageSeed(id) % FALLBACK_BY_INDEX.length] ?? RECIPE_IMAGE_FALLBACK;
  }
  const key = recipeImageCacheKey(recipe);
  const n = Number(key.replace(/\D/g, "")) || 0;
  return FALLBACK_BY_INDEX[n % FALLBACK_BY_INDEX.length] ?? RECIPE_IMAGE_FALLBACK;
}

/**
 * URL Pollinations AI (bez zapisu pliku).
 * Seed + stały prompt → ten sam adres; treść obrazu blokujemy w cache przeglądarki.
 */
export function getRecipeImage(recipe: RecipeImageSource): string {
  const dish =
    (recipe.imagePrompt ?? "").trim() ||
    (recipe.imagePromptEn ?? "").trim() ||
    (recipe.title ?? "").trim() ||
    "healthy fitness meal";

  const id = (recipe.id ?? "").trim();
  const prompt = `${dish}, healthy fitness meal, professional food photography, realistic, 4k`;

  const params = new URLSearchParams({
    width: "640",
    height: "400",
    nologo: "true",
  });
  params.set("seed", String(recipeImageSeed(id || recipeImageCacheKey(recipe))));

  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
}
