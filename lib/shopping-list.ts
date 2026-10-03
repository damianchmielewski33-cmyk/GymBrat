import type { CatalogMeal } from "@/lib/meal-catalog-types";

export const SHOPPING_LIST_STORAGE_KEY = "gymbrat:shopping-list:v1";

export type ShoppingListItem = {
  id: string;
  name: string;
  recipeId: string;
  recipeTitle: string;
  checked: boolean;
  addedAtMs: number;
};

function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function itemId(recipeId: string, name: string): string {
  return `${recipeId}::${normalizeName(name).toLowerCase()}`;
}

function readRaw(): ShoppingListItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SHOPPING_LIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x): ShoppingListItem | null => {
        if (!x || typeof x !== "object") return null;
        const o = x as Record<string, unknown>;
        const name = typeof o.name === "string" ? normalizeName(o.name) : "";
        const recipeId = typeof o.recipeId === "string" ? o.recipeId : "";
        const recipeTitle =
          typeof o.recipeTitle === "string" ? o.recipeTitle : "";
        if (!name || !recipeId) return null;
        return {
          id:
            typeof o.id === "string" && o.id
              ? o.id
              : itemId(recipeId, name),
          name,
          recipeId,
          recipeTitle,
          checked: Boolean(o.checked),
          addedAtMs:
            typeof o.addedAtMs === "number" && Number.isFinite(o.addedAtMs)
              ? o.addedAtMs
              : Date.now(),
        };
      })
      .filter((x): x is ShoppingListItem => x != null);
  } catch {
    return [];
  }
}

function writeRaw(list: ShoppingListItem[]) {
  try {
    window.localStorage.setItem(
      SHOPPING_LIST_STORAGE_KEY,
      JSON.stringify(list.slice(0, 200)),
    );
  } catch {
    /* ignore quota */
  }
}

export function listShoppingItems(): ShoppingListItem[] {
  return readRaw().sort((a, b) => b.addedAtMs - a.addedAtMs);
}

/** Dodaje składniki przepisu; pomija duplikaty (ten sam przepis + nazwa). */
export function addRecipeIngredientsToShoppingList(
  meal: CatalogMeal,
): ShoppingListItem[] {
  const ingredients = Array.isArray(meal.ingredients) ? meal.ingredients : [];
  if (ingredients.length === 0) return listShoppingItems();

  const now = Date.now();
  const current = readRaw();
  const byId = new Map(current.map((i) => [i.id, i]));

  for (const line of ingredients) {
    const name = normalizeName(line);
    if (!name) continue;
    const id = itemId(meal.id, name);
    if (byId.has(id)) continue;
    byId.set(id, {
      id,
      name,
      recipeId: meal.id,
      recipeTitle: meal.title,
      checked: false,
      addedAtMs: now,
    });
  }

  const next = Array.from(byId.values());
  writeRaw(next);
  return next.sort((a, b) => b.addedAtMs - a.addedAtMs);
}

export function toggleShoppingItem(id: string): ShoppingListItem[] {
  const next = readRaw().map((i) =>
    i.id === id ? { ...i, checked: !i.checked } : i,
  );
  writeRaw(next);
  return next.sort((a, b) => b.addedAtMs - a.addedAtMs);
}

export function removeShoppingItem(id: string): ShoppingListItem[] {
  const next = readRaw().filter((i) => i.id !== id);
  writeRaw(next);
  return next.sort((a, b) => b.addedAtMs - a.addedAtMs);
}

export function clearShoppingList(): ShoppingListItem[] {
  writeRaw([]);
  return [];
}
