import type { FoodProduct } from "@/lib/food-products-types";

const STORAGE_KEY = "gymbrat:food-favorites-v1";

export type FavoriteFoodSnapshot = {
  id: string;
  name: string;
  brand?: string;
  barcode: string | null;
  servingLabel: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  source: FoodProduct["source"];
  basisAmount?: number;
  basisUnit?: FoodProduct["basisUnit"];
  gramsPerPiece?: number;
  savedAtMs: number;
};

function readRaw(): FavoriteFoodSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is FavoriteFoodSnapshot =>
        !!x &&
        typeof x === "object" &&
        typeof (x as FavoriteFoodSnapshot).id === "string" &&
        typeof (x as FavoriteFoodSnapshot).name === "string",
    );
  } catch {
    return [];
  }
}

function writeRaw(list: FavoriteFoodSnapshot[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 80)));
  } catch {
    /* ignore */
  }
}

export function listFavoriteFoods(): FavoriteFoodSnapshot[] {
  return readRaw().sort((a, b) => b.savedAtMs - a.savedAtMs);
}

export function isFavoriteFoodId(id: string): boolean {
  return readRaw().some((f) => f.id === id);
}

export function favoriteToFoodProduct(f: FavoriteFoodSnapshot): FoodProduct {
  return {
    id: f.id,
    name: f.name,
    brand: f.brand,
    barcode: f.barcode,
    servingLabel: f.servingLabel,
    calories: f.calories,
    proteinG: f.proteinG,
    fatG: f.fatG,
    carbsG: f.carbsG,
    source: f.source,
    basisAmount: f.basisAmount,
    basisUnit: f.basisUnit,
    gramsPerPiece: f.gramsPerPiece,
  };
}

export function toggleFavoriteFood(product: FoodProduct): boolean {
  const list = readRaw();
  const idx = list.findIndex((f) => f.id === product.id);
  if (idx >= 0) {
    list.splice(idx, 1);
    writeRaw(list);
    return false;
  }
  list.unshift({
    id: product.id,
    name: product.name,
    brand: product.brand,
    barcode: product.barcode,
    servingLabel: product.servingLabel,
    calories: product.calories,
    proteinG: product.proteinG,
    fatG: product.fatG,
    carbsG: product.carbsG,
    source: product.source,
    basisAmount: product.basisAmount,
    basisUnit: product.basisUnit,
    gramsPerPiece: product.gramsPerPiece,
    savedAtMs: Date.now(),
  });
  writeRaw(list);
  return true;
}
