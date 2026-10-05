import {
  buildAppRecipeImageProxyUrl,
  composeFoodImagePrompt,
  isLegacyPollinationsImageUrl,
} from "@/lib/pollinations-image";

/** Generacja — podbij przy zmianie mapowania grafik. */
export const RECIPE_IMAGE_CACHE_GENERATION = 8;

/** Awaryjny fallback gdy Pollinations / proxy nie załaduje się w przeglądarce. */
export const RECIPE_IMAGE_FALLBACK =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
      <rect fill="#121214" width="640" height="400"/>
      <text x="320" y="205" fill="#ebc44a99" font-family="system-ui,sans-serif" font-size="18" text-anchor="middle">GymBrat</text>
    </svg>`,
  );

export type RecipeImageProvider = "pollinations" | "stock";

/** Domyślnie AI (Pollinations przez /api/recipe-image). Stock tylko gdy jawnie wymuszone env. */
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

function isAppRecipeImageProxy(url: string): boolean {
  if (url.startsWith("/api/recipe-image?")) return true;
  try {
    const u = new URL(url);
    return u.pathname === "/api/recipe-image";
  } catch {
    return false;
  }
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
 * URL grafiki AI — same-origin proxy `/api/recipe-image`
 * (serwer woła gen.pollinations.ai z POLLINATIONS_API_KEY).
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
    model: "flux",
  });
}

/** Pełny prompt (testy / debug) — ten sam skład co proxy. */
export function buildAiRecipeImageFullPrompt(recipe: RecipeImageSource): string {
  return composeFoodImagePrompt({
    title: recipe.title,
    prompt: resolveImagePrompt(recipe),
  });
}

/**
 * Przy imporcie JSON: zawsze ustaw AI imageUrl (chyba że JSON już ma HTTPS imageUrl poza Pollinations/Unsplash).
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
  if (
    existing &&
    isSafeHttpUrl(existing) &&
    !existing.includes("unsplash.com") &&
    !isLegacyPollinationsImageUrl(existing)
  ) {
    return { ...meal, imagePromptEn };
  }

  const imageUrl = buildAiRecipeImageUrl({
    id: meal.id,
    title: meal.title,
    imagePromptEn,
  });

  return { ...meal, imagePromptEn, imageUrl };
}

/**
 * URL grafiki: jawne imageUrl (nie legacy Pollinations) → proxy AI z promptu.
 */
export function getRecipeImage(recipe: RecipeImageSource): string {
  const custom = (recipe.imageUrl ?? "").trim();
  if (custom) {
    if (isAppRecipeImageProxy(custom)) return custom;
    if (
      isSafeHttpUrl(custom) &&
      !custom.includes("unsplash.com") &&
      !isLegacyPollinationsImageUrl(custom)
    ) {
      return custom;
    }
  }

  if (getRecipeImageProvider() === "pollinations") {
    return buildAiRecipeImageUrl(recipe);
  }

  return RECIPE_IMAGE_FALLBACK;
}

export function getRecipeImageFallback(_recipe?: RecipeImageSource): string {
  return RECIPE_IMAGE_FALLBACK;
}
