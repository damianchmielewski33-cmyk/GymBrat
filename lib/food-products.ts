import { FOOD_PRODUCTS_LOCAL } from "@/lib/food-products-data";
import type { FoodProduct } from "@/lib/food-products-types";

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

export function findLocalProductByBarcode(barcode: string): FoodProduct | null {
  const code = normalizeBarcode(barcode);
  if (!code) return null;
  return FOOD_PRODUCTS_LOCAL.find((p) => p.barcode && normalizeBarcode(p.barcode) === code) ?? null;
}

export function searchLocalProducts(query: string, limit = 20): FoodProduct[] {
  const q = normalizeFoodQuery(query);
  if (!q) return FOOD_PRODUCTS_LOCAL.slice(0, limit);
  const parts = q.split(" ").filter(Boolean);
  const scored = FOOD_PRODUCTS_LOCAL.map((p) => {
    const hay = normalizeFoodQuery(
      `${p.name} ${p.brand ?? ""} ${p.barcode ?? ""} ${p.servingLabel}`,
    );
    let score = 0;
    if (hay === q) score += 8;
    if (hay.startsWith(q)) score += 5;
    if (hay.includes(q)) score += 3;
    for (const part of parts) {
      if (part.length >= 2 && hay.includes(part)) score += 2;
    }
    return { p, score };
  })
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
};

type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_pl?: string;
  brands?: string;
  serving_size?: string;
  nutriments?: OffNutriments;
};

function pickNum(...vals: Array<number | undefined>): number {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.round(v * 10) / 10;
  }
  return 0;
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

  const name = (raw.product_name_pl || raw.product_name || "").trim();
  if (!name) return null;
  if (calories <= 0 && proteinG + fatG + carbsG <= 0) return null;

  const kcal =
    calories > 0 ? Math.round(calories) : Math.round(4 * proteinG + 4 * carbsG + 9 * fatG);

  return {
    id: `off-${normalizeBarcode(barcode) || raw.code || name}`,
    barcode: normalizeBarcode(barcode) || raw.code || null,
    name,
    brand: raw.brands?.split(",")[0]?.trim() || undefined,
    servingLabel: has100 ? "100 g" : raw.serving_size?.trim() || "1 porcja",
    calories: kcal,
    proteinG,
    fatG,
    carbsG,
    source: "openfoodfacts",
    basisAmount: has100 ? 100 : undefined,
    basisUnit: has100 ? "g" : undefined,
  };
}

async function fetchOffJson(url: string): Promise<unknown | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": "GymBrat/1.0 (https://github.com/damianchmielewski33-cmyk/GymBrat)" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  return res.json();
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
  const q = query.trim();
  if (q.length < 2) return [];

  const hosts = ["https://pl.openfoodfacts.org", "https://world.openfoodfacts.org"];
  for (const host of hosts) {
    const url = new URL(`${host}/cgi/search.pl`);
    url.searchParams.set("search_terms", q);
    url.searchParams.set("search_simple", "1");
    url.searchParams.set("action", "process");
    url.searchParams.set("json", "1");
    url.searchParams.set("page_size", String(Math.max(limit, 20)));
    url.searchParams.set(
      "fields",
      "code,product_name,product_name_pl,brands,serving_size,nutriments",
    );
    // Preferuj produkty z nazwą PL / sprzedawane w PL
    url.searchParams.set("tagtype_0", "countries");
    url.searchParams.set("tag_contains_0", "contains");
    url.searchParams.set("tag_0", "poland");

    const json = (await fetchOffJson(url.toString())) as { products?: OffProduct[] } | null;
    const out: FoodProduct[] = [];
    for (const p of json?.products ?? []) {
      const mapped = mapOpenFoodFactsProduct(p, p.code ?? "");
      if (mapped) out.push(mapped);
      if (out.length >= limit) break;
    }
    if (out.length > 0) return out;

    // Bez filtra kraju — szersze wyniki (np. „kiwi”)
    const url2 = new URL(`${host}/cgi/search.pl`);
    url2.searchParams.set("search_terms", q);
    url2.searchParams.set("search_simple", "1");
    url2.searchParams.set("action", "process");
    url2.searchParams.set("json", "1");
    url2.searchParams.set("page_size", String(Math.max(limit, 20)));
    url2.searchParams.set(
      "fields",
      "code,product_name,product_name_pl,brands,serving_size,nutriments",
    );
    const json2 = (await fetchOffJson(url2.toString())) as { products?: OffProduct[] } | null;
    for (const p of json2?.products ?? []) {
      const mapped = mapOpenFoodFactsProduct(p, p.code ?? "");
      if (mapped) out.push(mapped);
      if (out.length >= limit) break;
    }
    if (out.length > 0) return out;
  }
  return [];
}
