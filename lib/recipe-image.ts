/** Generacja cache — podbij przy błędnych grafikach, żeby unieważnić stare blob-y. */
export const RECIPE_IMAGE_CACHE_GENERATION = 3;

export const RECIPE_IMAGE_FALLBACK =
  "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200";

/** Fallback Unsplash gdy Pollinations nie załaduje się — stałe per meal_00N. */
export const STABLE_RECIPE_IMAGES: Record<string, string> = {
  meal_001:
    "https://images.unsplash.com/photo-1517673400267-0251440c45dc?auto=format&fit=crop&w=1200&q=80",
  meal_002:
    "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=1200&q=80",
  meal_003:
    "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=1200&q=80",
  meal_004:
    "https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&w=1200&q=80",
  meal_005:
    "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1200&q=80",
  meal_006:
    "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=1200&q=80",
  meal_007:
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80",
  meal_008:
    "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1200&q=80",
  meal_009:
    "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=1200&q=80",
  meal_010:
    "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1200&q=80",
};

export type RecipeImageSource = {
  id?: string | null;
  title?: string | null;
  slot?: string | null;
  /** Jawny HTTPS URL — pomija Pollinations. */
  imageUrl?: string | null;
  /** Prompt z JSON → Pollinations AI. */
  imagePrompt?: string | null;
  imagePromptEn?: string | null;
};

export function recipeImageSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h % 1_000_000_000) || 1;
}

/** Klucz cache: generacja + id + hash promptu. */
export function recipeImageCacheKey(recipe: RecipeImageSource): string {
  const id = (recipe.id ?? "").trim() || "noid";
  const prompt = resolveImagePrompt(recipe);
  return `g${RECIPE_IMAGE_CACHE_GENERATION}|id:${id}|p:${recipeImageSeed(prompt)}`;
}

function isSafeHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Prompt do Pollinations: imagePrompt z JSON, potem imagePromptEn, na końcu title. */
export function resolveImagePrompt(recipe: RecipeImageSource): string {
  return (
    (recipe.imagePrompt ?? "").trim() ||
    (recipe.imagePromptEn ?? "").trim() ||
    (recipe.title ?? "").trim() ||
    "healthy fitness meal"
  );
}

/**
 * URL obrazu z Pollinations AI na podstawie promptu z JSON przepisu.
 */
export function getRecipeImage(recipe: RecipeImageSource): string {
  const custom = (recipe.imageUrl ?? "").trim();
  if (custom && isSafeHttpUrl(custom)) return custom;

  const prompt = resolveImagePrompt(recipe);
  const id = (recipe.id ?? "").trim();
  const title = (recipe.title ?? "").trim();
  // Nowy seed przy zmianie generacji — unika starego wariantu CDN.
  const seed = recipeImageSeed(
    `${id || prompt}|g${RECIPE_IMAGE_CACHE_GENERATION}`,
  );

  const fullPrompt = [
    title ? `Dish: ${title}` : null,
    `Exact food: ${prompt}`,
    "only this dish on a plate or in a bowl",
    "do not show a different meal",
    "professional food photography",
    "realistic",
    "natural lighting",
    "4k",
    "no people",
    "no text",
    "no logo",
  ]
    .filter(Boolean)
    .join(", ");

  const params = new URLSearchParams({
    width: "640",
    height: "400",
    nologo: "true",
    seed: String(seed),
  });

  return `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?${params.toString()}`;
}

/** Stały Unsplash gdy Pollinations padnie. */
export function getRecipeImageFallback(recipe: RecipeImageSource): string {
  const id = (recipe.id ?? "").trim();
  if (id && STABLE_RECIPE_IMAGES[id]) return STABLE_RECIPE_IMAGES[id]!;
  const keys = Object.keys(STABLE_RECIPE_IMAGES);
  if (keys.length === 0) return RECIPE_IMAGE_FALLBACK;
  const idx = recipeImageSeed(id || resolveImagePrompt(recipe)) % keys.length;
  return STABLE_RECIPE_IMAGES[keys[idx]!] ?? RECIPE_IMAGE_FALLBACK;
}
