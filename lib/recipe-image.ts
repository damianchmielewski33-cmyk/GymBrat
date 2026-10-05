/** Generacja — podbij przy zmianie mapowania grafik. */
export const RECIPE_IMAGE_CACHE_GENERATION = 7;

/** Awaryjny fallback gdy Pollinations nie załaduje się w przeglądarce. */
export const RECIPE_IMAGE_FALLBACK =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
      <rect fill="#121214" width="640" height="400"/>
      <text x="320" y="205" fill="#ebc44a99" font-family="system-ui,sans-serif" font-size="18" text-anchor="middle">GymBrat</text>
    </svg>`,
  );

export type RecipeImageProvider = "pollinations" | "stock";

/** Domyślnie AI (Pollinations). Stock tylko gdy jawnie wymuszone env. */
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

export function resolveImagePrompt(recipe: RecipeImageSource): string {
  return (
    (recipe.imagePromptEn ?? "").trim() ||
    (recipe.imagePrompt ?? "").trim() ||
    (recipe.title ?? "").trim() ||
    "healthy fitness meal plated"
  );
}

/** URL generowany przez AI (Pollinations) — używany przy imporcie JSON i w UI. */
export function buildAiRecipeImageUrl(recipe: RecipeImageSource): string {
  const prompt = resolveImagePrompt(recipe);
  const id = (recipe.id ?? "").trim();
  const title = (recipe.title ?? "").trim();
  const seed = recipeImageSeed(`${id || prompt}|g${RECIPE_IMAGE_CACHE_GENERATION}`);

  const fullPrompt = [
    title ? `Dish: ${title}` : null,
    `Exact food: ${prompt}`,
    "only this dish on a plate or in a bowl",
    "professional food photography",
    "realistic",
    "4k",
    "no people",
    "no text",
    "no watermark",
  ]
    .filter(Boolean)
    .join(", ");

  const params = new URLSearchParams({
    width: "640",
    height: "400",
    nologo: "true",
    seed: String(seed),
    model: "flux",
  });

  return `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?${params.toString()}`;
}

/**
 * Przy imporcie JSON: zawsze ustaw AI imageUrl (chyba że JSON już ma HTTPS imageUrl).
 * Wymaga imagePromptEn — jeśli brak, buduje z tytułu.
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
  if (existing && isSafeHttpUrl(existing) && !existing.includes("unsplash.com")) {
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
 * URL grafiki: jawne imageUrl → AI z promptu.
 * Bez stockowych / przykładowych zdjęć Unsplash.
 */
export function getRecipeImage(recipe: RecipeImageSource): string {
  const custom = (recipe.imageUrl ?? "").trim();
  if (custom && isSafeHttpUrl(custom)) return custom;

  if (getRecipeImageProvider() === "pollinations") {
    return buildAiRecipeImageUrl(recipe);
  }

  // stock = tylko awaryjny placeholder (bez przykładowych zdjęć dań)
  return RECIPE_IMAGE_FALLBACK;
}

export function getRecipeImageFallback(_recipe?: RecipeImageSource): string {
  return RECIPE_IMAGE_FALLBACK;
}
