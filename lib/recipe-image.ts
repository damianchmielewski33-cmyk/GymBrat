/** Generacja — podbij przy zmianie mapowania grafik. */
export const RECIPE_IMAGE_CACHE_GENERATION = 6;

export const RECIPE_IMAGE_FALLBACK =
  "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1200&q=80";

export type RecipeImageProvider = "stock" | "pollinations";

export function getRecipeImageProvider(): RecipeImageProvider {
  const raw = (process.env.NEXT_PUBLIC_RECIPE_IMAGE_PROVIDER ?? "stock")
    .trim()
    .toLowerCase();
  return raw === "pollinations" ? "pollinations" : "stock";
}

/**
 * Trafne zdjęcia Unsplash — dobierane wyłącznie po id albo precyzyjnych regułach tytułu.
 * NIE używamy luźnego matchowania imagePrompt (powodowało desery przy wołowinie itd.).
 */
export const DISH_IMAGES = {
  oatmeal:
    "https://images.unsplash.com/photo-1517673400267-0251440c45dc?auto=format&fit=crop&w=1200&q=80",
  eggs:
    "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=1200&q=80",
  chickenRiceBroccoli:
    "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=1200&q=80",
  turkeySweetPotato:
    "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=1200&q=80",
  pastaChicken:
    "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=1200&q=80",
  wrap:
    "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=1200&q=80",
  tunaSalad:
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80",
  cottageFruit:
    "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1200&q=80",
  smoothie:
    "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=1200&q=80",
  salmon:
    "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1200&q=80",
  beefPlate:
    "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80",
  chickenCurry:
    "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=1200&q=80",
  chickenGeneric:
    "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=1200&q=80",
  pastaGeneric:
    "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1200&q=80",
} as const;

/**
 * Reguły od NAJBARDZIEJ szczegółowych — pierwsza trafiona wygrywa.
 * Tylko tytuł dania (PL), nie imagePrompt.
 */
const TITLE_RULES: Array<{ test: RegExp; url: string }> = [
  { test: /wrap|tortill|burrito/i, url: DISH_IMAGES.wrap },
  { test: /curry|curry/i, url: DISH_IMAGES.chickenCurry },
  { test: /wołowin|beef|stek|steak/i, url: DISH_IMAGES.beefPlate },
  { test: /makaron|pasta|spaghetti|noodle/i, url: DISH_IMAGES.pastaChicken },
  { test: /indyk|turkey/i, url: DISH_IMAGES.turkeySweetPotato },
  { test: /batat|sweet\s*potato/i, url: DISH_IMAGES.turkeySweetPotato },
  { test: /łoso[sś]|salmon|szparag/i, url: DISH_IMAGES.salmon },
  { test: /sałat|tu[nń]czyk|tuna/i, url: DISH_IMAGES.tunaSalad },
  { test: /owsian|oatmeal|borówk|jagód/i, url: DISH_IMAGES.oatmeal },
  { test: /jajeczn|jajk|scrambled|egg/i, url: DISH_IMAGES.eggs },
  { test: /serek|cottage|wiejsk|jogurt|yogurt|granola/i, url: DISH_IMAGES.cottageFruit },
  { test: /koktajl|shake|smoothie|banan/i, url: DISH_IMAGES.smoothie },
  { test: /kurczak.*ry[zż]|ry[zż].*brokuł|brokuł.*kurczak/i, url: DISH_IMAGES.chickenRiceBroccoli },
  { test: /kurczak|chicken/i, url: DISH_IMAGES.chickenGeneric },
  { test: /ry[zż]|rice|kasza|groats/i, url: DISH_IMAGES.chickenRiceBroccoli },
];

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
  return `g${RECIPE_IMAGE_CACHE_GENERATION}|stock|id:${id}|t:${recipeImageSeed(title)}`;
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
    (recipe.imagePrompt ?? "").trim() ||
    (recipe.imagePromptEn ?? "").trim() ||
    (recipe.title ?? "").trim() ||
    "healthy fitness meal"
  );
}

function matchByTitle(title: string): string | null {
  const t = title.trim();
  if (!t) return null;
  for (const row of TITLE_RULES) {
    if (row.test.test(t)) return row.url;
  }
  return null;
}

function stockImageForRecipe(recipe: RecipeImageSource): string {
  const custom = (recipe.imageUrl ?? "").trim();
  if (custom && isSafeHttpUrl(custom)) return custom;

  // Wyłącznie tytuł — imagePrompt nie może „podmienić” dania na deser.
  const byTitle = matchByTitle(recipe.title ?? "");
  if (byTitle) return byTitle;

  return RECIPE_IMAGE_FALLBACK;
}

function pollinationsImageForRecipe(recipe: RecipeImageSource): string {
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
 * URL grafiki: imageUrl → id → reguły tytułu → fallback.
 * Domyślnie stock (bez Pollinations).
 */
export function getRecipeImage(recipe: RecipeImageSource): string {
  const custom = (recipe.imageUrl ?? "").trim();
  if (custom && isSafeHttpUrl(custom)) return custom;

  if (getRecipeImageProvider() === "pollinations") {
    return pollinationsImageForRecipe(recipe);
  }
  return stockImageForRecipe(recipe);
}

export function getRecipeImageFallback(recipe: RecipeImageSource): string {
  return stockImageForRecipe(recipe);
}
