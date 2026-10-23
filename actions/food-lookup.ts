"use server";

import { guardAction } from "@/lib/action-guard";
import { auth } from "@/auth";
import {
  compareFoodSearchHits,
  findLocalProductByBarcode,
  findLocalProductByName,
  lookupBarcodeRemote,
  normalizeFoodQuery,
  searchLocalProducts,
  scoreProductAgainstQuery,
} from "@/lib/food-products";
import { polishStapleQueriesFromEnglishName } from "@/lib/food-query-i18n";
import { searchRemoteFoodProducts } from "@/lib/food-products-remote";
import { listRecentFoodProductsFromLogs } from "@/lib/meal-logs";
import type { FoodProduct } from "@/lib/food-products-types";

/** Remote (USDA/OFF) pokryty lokalnym staplem z makro jak Fitatu. */
function coveredByLocalStaple(remote: FoodProduct): boolean {
  if (findLocalProductByName(remote.name)) return true;
  for (const pl of polishStapleQueriesFromEnglishName(remote.name)) {
    if (findLocalProductByName(pl)) return true;
  }
  return false;
}

export type FoodLookupResult =
  | { ok: true; product: FoodProduct }
  | { ok: false; error: string };

export type FoodSearchResult =
  | { ok: true; products: FoodProduct[]; fromRecents?: boolean }
  | { ok: false; error: string };

export async function lookupFoodByBarcodeAction(barcode: string): Promise<FoodLookupResult> {
  await guardAction("food-lookup.lookupFoodByBarcodeAction", { limit: 60, windowMs: 60000 });
  const code = barcode.replace(/\D/g, "").trim();
  if (code.length < 8) {
    return { ok: false, error: "Kod kreskowy jest za krótki — wpisz pełny EAN (8–13 cyfr)." };
  }

  const local = findLocalProductByBarcode(code);
  if (local) return { ok: true, product: local };

  try {
    const remote = await lookupBarcodeRemote(code);
    if (remote) return { ok: true, product: remote };
  } catch {
    /* sieć / OFF / USDA */
  }

  return {
    ok: false,
    error: "Nie znaleziono produktu dla tego kodu. Spróbuj wyszukać po nazwie.",
  };
}

/** Ostatnio dodane produkty z historii dziennika (bez „popularnych” z początku bazy). */
export async function listRecentFoodProductsAction(
  limit = 24,
): Promise<FoodSearchResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: true, products: [], fromRecents: true };
  }
  try {
    const recent = await listRecentFoodProductsFromLogs(session.user.id, limit);
    return { ok: true, products: recent, fromRecents: true };
  } catch {
    return { ok: true, products: [], fromRecents: true };
  }
}

export async function searchFoodProductsAction(query: string): Promise<FoodSearchResult> {
  await guardAction("food-lookup.searchFoodProductsAction", { limit: 120, windowMs: 60000 });
  const q = query.trim();
  if (!q) {
    const recent = await listRecentFoodProductsAction(24);
    if (recent.ok && recent.products.length > 0) return recent;
    return { ok: true, products: searchLocalProducts("", 24), fromRecents: false };
  }

  // Sam kod — traktuj jak skan
  if (/^\d{8,14}$/.test(q.replace(/\s/g, ""))) {
    const byCode = await lookupFoodByBarcodeAction(q);
    if (byCode.ok) return { ok: true, products: [byCode.product] };
  }

  const local = searchLocalProducts(q, 28);
  const qNorm = normalizeFoodQuery(q);

  // Jak Fitatu: 1–2 znaki → tylko lokalne podpowiedzi (ban / ki), bez OFF/USDA.
  if (qNorm.length < 3) {
    return { ok: true, products: local.slice(0, 40) };
  }

  let remote: FoodProduct[] = [];
  try {
    remote = await searchRemoteFoodProducts(q, 48);
  } catch {
    /* opcjonalne */
  }

  const seen = new Set<string>();
  const merged: Array<{ p: FoodProduct; score: number }> = [];
  for (const p of local) {
    const key = `${(p.barcode ?? "").toLowerCase()}|${p.name.toLowerCase()}|${(p.brand ?? "").toLowerCase()}`;
    seen.add(key);
    merged.push({ p, score: scoreProductAgainstQuery(q, p) });
  }
  for (const p of remote) {
    const key = `${(p.barcode ?? "").toLowerCase()}|${p.name.toLowerCase()}|${(p.brand ?? "").toLowerCase()}`;
    if (seen.has(key)) continue;
    // Duplikat stapla z lokalną bazą (np. USDA Banana vs lokalny Banan) → zostaw Fitatu makro
    if (coveredByLocalStaple(p)) continue;
    const score = scoreProductAgainstQuery(q, p);
    if (score <= 0) continue;
    seen.add(key);
    merged.push({ p, score });
  }
  merged.sort(compareFoodSearchHits);
  return { ok: true, products: merged.slice(0, 40).map((x) => x.p) };
}
