import { FOOD_PRODUCTS_LOCAL } from "@/lib/food-products-data";
import { emptyDetails, formatFoodDisplayName } from "@/lib/food-nutrition";
import type { FoodNutritionDetails, FoodAmountUnit, FoodProduct } from "@/lib/food-products-types";

function normalizeBarcode(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Normalizacja PL do wyszukiwania (kiwi = kiwi, jabłko = jablko). */
export function normalizeFoodQuery(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Znane sieci / marki w zapytaniach PL (Longer KFC, chleb Lidl…). */
const KNOWN_BRAND_TOKENS: Array<{ token: string; aliases: string[] }> = [
  { token: "kfc", aliases: ["kfc"] },
  { token: "lidl", aliases: ["lidl", "tastino", "pano", "favorina"] },
  { token: "biedronka", aliases: ["biedronka", "gosto", "go active"] },
  { token: "zabka", aliases: ["zabka", "żabka"] },
  { token: "mcdonalds", aliases: ["mcdonalds", "mcdonald", "mc donalds", "mcd"] },
  { token: "subway", aliases: ["subway"] },
  { token: "auchan", aliases: ["auchan"] },
  { token: "carrefour", aliases: ["carrefour"] },
  { token: "pasibus", aliases: ["pasibus"] },
  { token: "starbucks", aliases: ["starbucks"] },
];

export function detectFoodBrandTokens(normalizedQuery: string): string[] {
  const q = ` ${normalizedQuery} `;
  const found: string[] = [];
  for (const row of KNOWN_BRAND_TOKENS) {
    if (row.aliases.some((a) => q.includes(` ${normalizeFoodQuery(a)} `))) {
      found.push(row.token);
    }
  }
  return found;
}

/**
 * Warianty zapytania do OFF / lokalnego scoringu:
 * pełne, bez marki, przestawione tokeny marka↔produkt.
 */
export function buildFoodSearchVariants(query: string): string[] {
  const raw = query.trim();
  const n = normalizeFoodQuery(raw);
  if (!n) return [];
  const parts = n.split(" ").filter(Boolean);
  const brands = detectFoodBrandTokens(n);
  const brandSet = new Set(brands);
  const productParts = parts.filter((p) => !brandSet.has(p) && p.length >= 2);
  const variants = new Set<string>();
  variants.add(raw);
  variants.add(n);
  if (productParts.length) variants.add(productParts.join(" "));
  for (const b of brands) {
    if (productParts.length) {
      variants.add(`${productParts.join(" ")} ${b}`);
      variants.add(`${b} ${productParts.join(" ")}`);
    } else {
      variants.add(b);
    }
  }
  // Typowe skróty QSR
  if (brands.includes("kfc") && productParts.includes("longer")) {
    variants.add("KFC Longer");
    variants.add("Longer KFC");
  }
  return [...variants].filter((v) => normalizeFoodQuery(v).length >= 2).slice(0, 6);
}

export function scoreProductAgainstQuery(query: string, p: FoodProduct): number {
  const q = normalizeFoodQuery(query);
  if (!q) return 0;
  const parts = q.split(" ").filter((x) => x.length >= 2);
  const hay = normalizeFoodQuery(
    `${p.name} ${p.brand ?? ""} ${p.barcode ?? ""} ${p.servingLabel}`,
  );
  let score = 0;
  if (hay === q) score += 20;
  if (hay.startsWith(q)) score += 12;
  if (hay.includes(q)) score += 8;

  let matched = 0;
  for (const part of parts) {
    if (hay.includes(part)) {
      score += part.length >= 4 ? 4 : 2;
      matched += 1;
    }
  }
  if (parts.length >= 2) {
    if (matched === parts.length) score += 10;
    else if (matched < Math.ceil(parts.length * 0.5)) return 0;
  } else if (matched === 0) {
    return 0;
  }

  const brands = detectFoodBrandTokens(q);
  for (const b of brands) {
    const brandHay = normalizeFoodQuery(p.brand ?? "");
    if (brandHay.includes(b) || hay.includes(b)) score += 6;
  }
  return score;
}

export function findLocalProductByBarcode(barcode: string): FoodProduct | null {
  const code = normalizeBarcode(barcode);
  if (!code) return null;
  return FOOD_PRODUCTS_LOCAL.find((p) => p.barcode && normalizeBarcode(p.barcode) === code) ?? null;
}

export function searchLocalProducts(query: string, limit = 20): FoodProduct[] {
  const q = normalizeFoodQuery(query);
  if (!q) return FOOD_PRODUCTS_LOCAL.slice(0, limit);
  const scored = FOOD_PRODUCTS_LOCAL.map((p) => ({
    p,
    score: scoreProductAgainstQuery(query, p),
  }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.p);
}

type OffNutriments = {
  "energy-kcal_serving"?: number;
  "energy-kcal_100g"?: number;
  proteins_serving?: number;
  proteins_100g?: number;
  fat_serving?: number;
  fat_100g?: number;
  carbohydrates_serving?: number;
  carbohydrates_100g?: number;
  "saturated-fat_100g"?: number;
  "monounsaturated-fat_100g"?: number;
  "polyunsaturated-fat_100g"?: number;
  "omega-3-fat_100g"?: number;
  "alpha-linolenic-acid_100g"?: number;
  "omega-6-fat_100g"?: number;
  "linoleic-acid_100g"?: number;
  sugars_100g?: number;
  fiber_100g?: number;
  salt_100g?: number;
  sodium_100g?: number;
  cholesterol_100g?: number;
  caffeine_100g?: number;
  "vitamin-a_100g"?: number;
  "vitamin-c_100g"?: number;
  "vitamin-d_100g"?: number;
  calcium_100g?: number;
  iron_100g?: number;
};

type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_pl?: string;
  generic_name?: string;
  generic_name_pl?: string;
  brands?: string;
  serving_size?: string;
  /** np. „330 g”, „250 ml”, „1 l” — wielkość opakowania. */
  quantity?: string;
  product_quantity?: number;
  product_quantity_unit?: string;
  ingredients_text?: string;
  ingredients_text_pl?: string;
  nutriments?: OffNutriments;
};

function pickNum(...vals: Array<number | undefined>): number {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.round(v * 10) / 10;
  }
  return 0;
}

function pickNullable(...vals: Array<number | undefined>): number | null {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      return Math.round(v * 100) / 100;
    }
  }
  return null;
}

/** OFF: wielkość opakowania (quantity / product_quantity). */
export function parsePackageQuantity(args: {
  quantity?: string | null;
  productQuantity?: number | null;
  productQuantityUnit?: string | null;
}): { amount: number; unit: FoodAmountUnit } | null {
  const unitRaw = (args.productQuantityUnit ?? "").trim().toLowerCase();
  const pq = args.productQuantity;
  if (typeof pq === "number" && Number.isFinite(pq) && pq > 0) {
    if (unitRaw === "g" || unitRaw === "gr" || unitRaw === "gram" || unitRaw === "grams") {
      return { amount: Math.round(pq * 10) / 10, unit: "g" };
    }
    if (unitRaw === "ml" || unitRaw === "milliliter" || unitRaw === "millilitre") {
      return { amount: Math.round(pq * 10) / 10, unit: "ml" };
    }
    if (unitRaw === "kg") {
      return { amount: Math.round(pq * 1000 * 10) / 10, unit: "g" };
    }
    if (unitRaw === "l" || unitRaw === "liter" || unitRaw === "litre") {
      return { amount: Math.round(pq * 1000 * 10) / 10, unit: "ml" };
    }
  }

  const q = (args.quantity ?? "").trim().toLowerCase().replace(",", ".");
  if (!q) return null;

  const kg = q.match(/(\d+(?:\.\d+)?)\s*kg\b/);
  if (kg) {
    const n = Number(kg[1]);
    if (Number.isFinite(n) && n > 0) return { amount: Math.round(n * 1000 * 10) / 10, unit: "g" };
  }
  const liter = q.match(/(\d+(?:\.\d+)?)\s*l\b/);
  if (liter && !/\bml\b/.test(q)) {
    const n = Number(liter[1]);
    if (Number.isFinite(n) && n > 0) return { amount: Math.round(n * 1000 * 10) / 10, unit: "ml" };
  }
  const ml = q.match(/(\d+(?:\.\d+)?)\s*ml\b/);
  if (ml) {
    const n = Number(ml[1]);
    if (Number.isFinite(n) && n > 0) return { amount: Math.round(n * 10) / 10, unit: "ml" };
  }
  const g = q.match(/(\d+(?:\.\d+)?)\s*g\b/);
  if (g) {
    const n = Number(g[1]);
    if (Number.isFinite(n) && n > 0) return { amount: Math.round(n * 10) / 10, unit: "g" };
  }
  return null;
}

/** OFF sodium_100g jest zwykle w gramach → mg. */
function sodiumToMg(sodiumG: number | null): number | null {
  if (sodiumG == null) return null;
  return Math.round(sodiumG * 1000 * 10) / 10;
}

function mapOffDetails(
  n: OffNutriments,
  ingredientsText: string | null,
): FoodNutritionDetails {
  const salt = pickNullable(n.salt_100g);
  const sodiumG = pickNullable(n.sodium_100g);
  return {
    ...emptyDetails(),
    saturatedFatG: pickNullable(n["saturated-fat_100g"]),
    monoFatG: pickNullable(n["monounsaturated-fat_100g"]),
    polyFatG: pickNullable(n["polyunsaturated-fat_100g"]),
    omega3G: pickNullable(n["omega-3-fat_100g"], n["alpha-linolenic-acid_100g"]),
    omega6G: pickNullable(n["omega-6-fat_100g"], n["linoleic-acid_100g"]),
    sugarsG: pickNullable(n.sugars_100g),
    fiberG: pickNullable(n.fiber_100g),
    saltG: salt ?? (sodiumG != null ? Math.round(sodiumG * 2.5 * 100) / 100 : null),
    sodiumMg: sodiumToMg(sodiumG),
    cholesterolMg: pickNullable(n.cholesterol_100g),
    caffeineMg: pickNullable(n.caffeine_100g),
    vitaminAUg: pickNullable(n["vitamin-a_100g"]),
    vitaminCMg: pickNullable(n["vitamin-c_100g"]),
    vitaminDUg: pickNullable(n["vitamin-d_100g"]),
    calciumMg: pickNullable(n.calcium_100g),
    ironMg: pickNullable(n.iron_100g),
    ingredientsText,
  };
}

/**
 * Mapowanie OFF → produkt GymBrat.
 * Preferujemy makro na 100 g (jak Fitatu), nie na „serving” — różnice vs Fitatu
 * często biorą się z mieszania porcji i 100 g.
 */
export function mapOpenFoodFactsProduct(raw: OffProduct, barcode: string): FoodProduct | null {
  const n = raw.nutriments ?? {};
  const has100 =
    n["energy-kcal_100g"] != null ||
    n.proteins_100g != null ||
    n.fat_100g != null ||
    n.carbohydrates_100g != null;

  const calories = has100
    ? pickNum(n["energy-kcal_100g"])
    : pickNum(n["energy-kcal_serving"], n["energy-kcal_100g"]);
  const proteinG = has100
    ? pickNum(n.proteins_100g)
    : pickNum(n.proteins_serving, n.proteins_100g);
  const fatG = has100 ? pickNum(n.fat_100g) : pickNum(n.fat_serving, n.fat_100g);
  const carbsG = has100
    ? pickNum(n.carbohydrates_100g)
    : pickNum(n.carbohydrates_serving, n.carbohydrates_100g);

  const name = formatFoodDisplayName({
    productName: raw.product_name,
    productNamePl: raw.product_name_pl,
    genericName: raw.generic_name,
    genericNamePl: raw.generic_name_pl,
    brands: raw.brands,
  });
  if (!name) return null;
  if (calories <= 0 && proteinG + fatG + carbsG <= 0) return null;

  const kcal =
    calories > 0 ? Math.round(calories) : Math.round(4 * proteinG + 4 * carbsG + 9 * fatG);

  const ingredientsText =
    (raw.ingredients_text_pl || raw.ingredients_text || "").trim() || null;
  const details = mapOffDetails(n, ingredientsText);
  const brand = raw.brands?.split(/[,;]/)[0]?.trim() || undefined;
  const pkg = parsePackageQuantity({
    quantity: raw.quantity,
    productQuantity: raw.product_quantity,
    productQuantityUnit: raw.product_quantity_unit,
  });

  return {
    id: `off-${normalizeBarcode(barcode) || raw.code || name}`,
    barcode: normalizeBarcode(barcode) || raw.code || null,
    name,
    brand,
    servingLabel: has100
      ? "100 g"
      : pkg
        ? `${pkg.amount} ${pkg.unit}`
        : raw.serving_size?.trim() || "1 porcja",
    calories: kcal,
    proteinG,
    fatG,
    carbsG,
    source: "openfoodfacts",
    basisAmount: has100 ? 100 : undefined,
    basisUnit: has100 ? "g" : undefined,
    packageAmount: pkg?.amount,
    packageUnit: pkg?.unit,
    // Opakowanie jednostkowe (kubek/sztuka) — przydatne gdy quantity = 330 g
    gramsPerPiece:
      pkg && pkg.unit === "g" && pkg.amount >= 20 && pkg.amount <= 2000
        ? pkg.amount
        : undefined,
    details,
  };
}

async function fetchOffJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "GymBrat/1.0 (https://github.com/damianchmielewski33-cmyk/GymBrat)",
        Accept: "application/json",
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("json")) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function lookupBarcodeRemote(barcode: string): Promise<FoodProduct | null> {
  const code = normalizeBarcode(barcode);
  if (code.length < 8) return null;

  // PL mirror najpierw — lepsze nazwy PL; fallback world.
  for (const host of ["https://pl.openfoodfacts.org", "https://world.openfoodfacts.org"]) {
    const json = (await fetchOffJson(
      `${host}/api/v2/product/${encodeURIComponent(code)}.json`,
    )) as { status?: number; product?: OffProduct } | null;
    if (json?.status === 1 && json.product) {
      const mapped = mapOpenFoodFactsProduct(json.product, code);
      if (mapped) return mapped;
    }
  }
  return null;
}

export async function searchOpenFoodFacts(query: string, limit = 12): Promise<FoodProduct[]> {
  const variants = buildFoodSearchVariants(query);
  if (variants.length === 0) return [];

  const hosts = ["https://world.openfoodfacts.org", "https://pl.openfoodfacts.org"];
  const collected: FoodProduct[] = [];
  const seen = new Set<string>();

  async function runOne(host: string, q: string, withPoland: boolean): Promise<void> {
    const url = new URL(`${host}/cgi/search.pl`);
    url.searchParams.set("search_terms", q);
    url.searchParams.set("search_simple", "1");
    url.searchParams.set("action", "process");
    url.searchParams.set("json", "1");
    url.searchParams.set("page_size", String(Math.max(limit, 24)));
    url.searchParams.set(
      "fields",
      "code,product_name,product_name_pl,generic_name,generic_name_pl,brands,serving_size,quantity,product_quantity,product_quantity_unit,ingredients_text,ingredients_text_pl,nutriments",
    );
    if (withPoland) {
      url.searchParams.set("tagtype_0", "countries");
      url.searchParams.set("tag_contains_0", "contains");
      url.searchParams.set("tag_0", "poland");
    }
    const brands = detectFoodBrandTokens(normalizeFoodQuery(q));
    if (brands.length === 1 && !withPoland) {
      url.searchParams.set("tagtype_1", "brands");
      url.searchParams.set("tag_contains_1", "contains");
      url.searchParams.set("tag_1", brands[0]!);
    }

    const json = (await fetchOffJson(url.toString())) as { products?: OffProduct[] } | null;
    for (const p of json?.products ?? []) {
      const mapped = mapOpenFoodFactsProduct(p, p.code ?? "");
      if (!mapped) continue;
      const key = `${(mapped.barcode ?? "").toLowerCase()}|${mapped.name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      collected.push(mapped);
    }
  }

  // Najpierw warianty bez filtra PL (szersze), potem z PL — równolegle w ramach hosta.
  for (const host of hosts) {
    if (collected.length >= limit) break;
    const jobs: Promise<void>[] = [];
    for (const v of variants.slice(0, 3)) {
      jobs.push(runOne(host, v, false));
    }
    await Promise.all(jobs);
    if (collected.length < Math.ceil(limit / 2)) {
      await Promise.all(variants.slice(0, 2).map((v) => runOne(host, v, true)));
    }
  }

  return collected
    .map((p) => ({ p, score: scoreProductAgainstQuery(query, p) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
}
