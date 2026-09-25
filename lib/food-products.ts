import { FOOD_PRODUCTS_LOCAL } from "@/lib/food-products-data";
import type { FoodProduct } from "@/lib/food-products-types";

function normalizeBarcode(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function findLocalProductByBarcode(barcode: string): FoodProduct | null {
  const code = normalizeBarcode(barcode);
  if (!code) return null;
  return FOOD_PRODUCTS_LOCAL.find((p) => p.barcode && normalizeBarcode(p.barcode) === code) ?? null;
}

export function searchLocalProducts(query: string, limit = 20): FoodProduct[] {
  const q = query.trim().toLowerCase();
  if (!q) return FOOD_PRODUCTS_LOCAL.slice(0, limit);
  const scored = FOOD_PRODUCTS_LOCAL.map((p) => {
    const hay = `${p.name} ${p.brand ?? ""} ${p.barcode ?? ""}`.toLowerCase();
    let score = 0;
    if (hay.startsWith(q)) score += 3;
    if (hay.includes(q)) score += 2;
    for (const part of q.split(/\s+/)) {
      if (part && hay.includes(part)) score += 1;
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

export function mapOpenFoodFactsProduct(raw: OffProduct, barcode: string): FoodProduct | null {
  const n = raw.nutriments ?? {};
  const calories = pickNum(n["energy-kcal_serving"], n["energy-kcal_100g"]);
  const proteinG = pickNum(n.proteins_serving, n.proteins_100g);
  const fatG = pickNum(n.fat_serving, n.fat_100g);
  const carbsG = pickNum(n.carbohydrates_serving, n.carbohydrates_100g);
  const name = (raw.product_name_pl || raw.product_name || "").trim();
  if (!name) return null;
  if (calories <= 0 && proteinG + fatG + carbsG <= 0) return null;

  const usedServing =
    n["energy-kcal_serving"] != null ||
    n.proteins_serving != null ||
    n.fat_serving != null ||
    n.carbohydrates_serving != null;

  return {
    id: `off-${normalizeBarcode(barcode) || raw.code || name}`,
    barcode: normalizeBarcode(barcode) || raw.code || null,
    name,
    brand: raw.brands?.split(",")[0]?.trim() || undefined,
    servingLabel: usedServing
      ? raw.serving_size?.trim() || "1 porcja"
      : "100 g",
    calories: calories > 0 ? Math.round(calories) : Math.round(4 * proteinG + 4 * carbsG + 9 * fatG),
    proteinG,
    fatG,
    carbsG,
    source: "openfoodfacts",
  };
}

export async function lookupBarcodeRemote(barcode: string): Promise<FoodProduct | null> {
  const code = normalizeBarcode(barcode);
  if (code.length < 8) return null;
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`;
  const res = await fetch(url, {
    headers: { "User-Agent": "GymBrat/1.0 (diet barcode lookup)" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { status?: number; product?: OffProduct };
  if (json.status !== 1 || !json.product) return null;
  return mapOpenFoodFactsProduct(json.product, code);
}

export async function searchOpenFoodFacts(query: string, limit = 12): Promise<FoodProduct[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  url.searchParams.set("search_terms", q);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", String(limit));
  url.searchParams.set("fields", "code,product_name,product_name_pl,brands,serving_size,nutriments");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "GymBrat/1.0 (diet product search)" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { products?: OffProduct[] };
  const out: FoodProduct[] = [];
  for (const p of json.products ?? []) {
    const mapped = mapOpenFoodFactsProduct(p, p.code ?? "");
    if (mapped) out.push(mapped);
  }
  return out;
}
