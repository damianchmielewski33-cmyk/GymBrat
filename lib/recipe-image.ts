import {
  buildAppRecipeImageProxyUrl,
  composeFoodImagePrompt,
  isLegacyPollinationsImageUrl,
  POLLINATIONS_FOOD_MODEL,
} from "@/lib/pollinations-image";

/** Generacja — podbij przy zmianie mapowania grafik. */
export const RECIPE_IMAGE_CACHE_GENERATION = 10;

/** Awaryjny fallback gdy brak trwałej grafiki w katalogu. */
export const RECIPE_IMAGE_FALLBACK =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
      <rect fill="#121214" width="640" height="400"/>
      <text x="320" y="205" fill="#ebc44a99" font-family="system-ui,sans-serif" font-size="18" text-anchor="middle">GymBrat</text>
    </svg>`,
  );

export type RecipeImageProvider = "pollinations" | "stock";

/** Domyślnie AI przy imporcie; stock tylko gdy jawnie wymuszone env. */
export function getRecipeImageProvider(): RecipeImageProvider {
  const raw = (process.env.NEXT_PUBLIC_RECIPE_IMAGE_PROVIDER ?? "pollinations")
    .trim()
    .toLowerCase();
  return raw === "stock" ? "stock" : "pollinations";
}

export type RecipeImageSource = {
  id?: string | null;
  title?: string | null;
  slot?: string | null;
  imageUrl?: string | null;
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

export function recipeImageCacheKey(recipe: RecipeImageSource): string {
  const id = (recipe.id ?? "").trim() || "noid";
  const title = (recipe.title ?? "").trim();
  return `g${RECIPE_IMAGE_CACHE_GENERATION}|ai|id:${id}|t:${recipeImageSeed(title)}`;
}

function isSafeHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function isAppRecipeImageProxy(url: string): boolean {
  if (url.startsWith("/api/recipe-image?")) return true;
  try {
    const u = new URL(url);
    return u.pathname === "/api/recipe-image";
  } catch {
    return false;
  }
}

export function isCatalogMealImageUrl(url: string): boolean {
  if (url.startsWith("/api/catalog-meal-image/")) return true;
  try {
    const u = new URL(url, "https://gymbrat.local");
    return u.pathname.startsWith("/api/catalog-meal-image/");
  } catch {
    return false;
  }
}

/**
 * Trwała grafika: zapisany asset katalogu albo zewnętrzny HTTPS
 * (nie Pollinations, nie unsplash, nie on-demand `/api/recipe-image`).
 */
export function isDurableRecipeImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (isCatalogMealImageUrl(trimmed)) return true;
  if (isAppRecipeImageProxy(trimmed)) return false;
  if (isLegacyPollinationsImageUrl(trimmed)) return false;
  if (trimmed.includes("unsplash.com")) return false;
  if (trimmed.startsWith("/")) return false;
  return isSafeHttpUrl(trimmed);
}

export function resolveImagePrompt(recipe: RecipeImageSource): string {
  return (
    (recipe.imagePromptEn ?? "").trim() ||
    (recipe.imagePrompt ?? "").trim() ||
    (recipe.title ?? "").trim() ||
    "healthy fitness meal plated"
  );
}

/**
 * URL on-demand proxy — tylko do generacji serwerowej (import / NOWY MAX),
 * nie jako imageUrl katalogu w przeglądarce.
 */
export function buildAiRecipeImageUrl(recipe: RecipeImageSource): string {
  const prompt = resolveImagePrompt(recipe);
  const id = (recipe.id ?? "").trim();
  const title = (recipe.title ?? "").trim();
  const seed = recipeImageSeed(`${id || prompt}|g${RECIPE_IMAGE_CACHE_GENERATION}`);

  return buildAppRecipeImageProxyUrl({
    prompt,
    title,
    seed,
    width: 640,
    height: 400,
    model: POLLINATIONS_FOOD_MODEL,
  });
}

/** Pełny prompt (import generacji / testy). */
export function buildAiRecipeImageFullPrompt(recipe: RecipeImageSource): string {
  return composeFoodImagePrompt({
    title: recipe.title,
    prompt: resolveImagePrompt(recipe),
  });
}

/**
 * Przy imporcie JSON: uzupełnia imagePromptEn; zostawia tylko trwałe imageUrl.
 * Nie ustawia `/api/recipe-image` — generacja dzieje się raz na serwerze i ląduje w DB.
 */
export function enrichCatalogMealWithAiImage<
  T extends {
    id: string;
    title: string;
    imagePromptEn?: string;
    imagePrompt?: string;
    imageUrl?: string;
  },
>(meal: T): T {
  const imagePromptEn =
    meal.imagePromptEn?.trim() ||
    meal.imagePrompt?.trim() ||
    meal.title.trim();

  const existing = meal.imageUrl?.trim();
  if (existing && isDurableRecipeImageUrl(existing)) {
    return { ...meal, imagePromptEn, imageUrl: existing };
  }

  const { imageUrl: _drop, ...rest } = meal;
  return { ...rest, imagePromptEn } as T;
}

/**
 * URL grafiki w UI: tylko trwały asset / HTTPS.
 * Brak on-demand Pollinations przy otwieraniu diety.
 */
export function getRecipeImage(recipe: RecipeImageSource): string {
  const custom = (recipe.imageUrl ?? "").trim();
  if (custom && isDurableRecipeImageUrl(custom)) {
    return custom;
  }

  if (getRecipeImageProvider() === "stock") {
    return RECIPE_IMAGE_FALLBACK;
  }

  // Katalog bez zapisanej grafiki → placeholder (generacja tylko przy imporcie).
  return RECIPE_IMAGE_FALLBACK;
}

export function getRecipeImageFallback(_recipe?: RecipeImageSource): string {
  return RECIPE_IMAGE_FALLBACK;
}
