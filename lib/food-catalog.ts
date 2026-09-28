/**
 * Wbudowany katalog popularnych produktów PL (na 100 g, o ile nie zaznaczono inaczej).
 */

export type FoodCatalogItem = {
  id: string;
  name: string;
  /** kcal / 100 g (lub porcja, jeśli portionLabel) */
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  /** np. "1 sztuka (~50 g)" — wtedy makro dotyczy porcji, nie 100 g */
  portionLabel?: string;
  aliases?: string[];
};

export const FOOD_CATALOG: FoodCatalogItem[] = [
  { id: "rice-white", name: "Ryż biały ugotowany", kcal: 130, proteinG: 2.7, fatG: 0.3, carbsG: 28, aliases: ["ryz", "rice"] },
  { id: "oats", name: "Płatki owsiane", kcal: 379, proteinG: 13, fatG: 7, carbsG: 67, aliases: ["owies", "oatmeal"] },
  { id: "chicken-breast", name: "Pierś z kurczaka", kcal: 110, proteinG: 23, fatG: 1.5, carbsG: 0, aliases: ["kurczak", "chicken"] },
  { id: "egg", name: "Jajko kurze", kcal: 78, proteinG: 6.5, fatG: 5.3, carbsG: 0.6, portionLabel: "1 sztuka (L)", aliases: ["jajko", "egg"] },
  { id: "banana", name: "Banan", kcal: 89, proteinG: 1.1, fatG: 0.3, carbsG: 23, aliases: ["banan"] },
  { id: "apple", name: "Jabłko", kcal: 52, proteinG: 0.3, fatG: 0.2, carbsG: 14, aliases: ["jablko"] },
  { id: "potato", name: "Ziemniak ugotowany", kcal: 87, proteinG: 1.9, fatG: 0.1, carbsG: 20, aliases: ["ziemniaki"] },
  { id: "cottage", name: "Twaróg chudy", kcal: 98, proteinG: 18, fatG: 0.5, carbsG: 3.5, aliases: ["twarog"] },
  { id: "yogurt-natural", name: "Jogurt naturalny 2%", kcal: 60, proteinG: 5, fatG: 2, carbsG: 4.5, aliases: ["jogurt"] },
  { id: "milk-2", name: "Mleko 2%", kcal: 50, proteinG: 3.3, fatG: 2, carbsG: 4.8, aliases: ["mleko"] },
  { id: "bread-wheat", name: "Chleb pszenny", kcal: 265, proteinG: 9, fatG: 3.2, carbsG: 49, aliases: ["chleb"] },
  { id: "pasta", name: "Makaron ugotowany", kcal: 131, proteinG: 5, fatG: 1.1, carbsG: 25, aliases: ["makaron", "pasta"] },
  { id: "tuna", name: "Tuńczyk w sosie własnym", kcal: 116, proteinG: 26, fatG: 1, carbsG: 0, aliases: ["tunczyk", "tuna"] },
  { id: "salmon", name: "Łosoś", kcal: 208, proteinG: 20, fatG: 13, carbsG: 0, aliases: ["losos"] },
  { id: "beef", name: "Wołowina chuda", kcal: 150, proteinG: 26, fatG: 5, carbsG: 0, aliases: ["wolowina"] },
  { id: "olive-oil", name: "Oliwa z oliwek", kcal: 884, proteinG: 0, fatG: 100, carbsG: 0, aliases: ["oliwa"] },
  { id: "butter", name: "Masło", kcal: 717, proteinG: 0.9, fatG: 81, carbsG: 0.1, aliases: ["maslo"] },
  { id: "cheese-yellow", name: "Ser żółty", kcal: 350, proteinG: 25, fatG: 27, carbsG: 1.5, aliases: ["ser"] },
  { id: "whey", name: "Odżywka białkowa (whey)", kcal: 380, proteinG: 75, fatG: 5, carbsG: 8, aliases: ["whey", "bialko"] },
  { id: "rice-cakes", name: "Wafle ryżowe", kcal: 390, proteinG: 8, fatG: 3, carbsG: 82, aliases: ["wafle"] },
  { id: "avocado", name: "Awokado", kcal: 160, proteinG: 2, fatG: 15, carbsG: 9, aliases: ["awokado"] },
  { id: "broccoli", name: "Brokuł", kcal: 34, proteinG: 2.8, fatG: 0.4, carbsG: 7, aliases: ["brokul"] },
  { id: "peanut-butter", name: "Masło orzechowe", kcal: 588, proteinG: 25, fatG: 50, carbsG: 20, aliases: ["peanut"] },
  { id: "honey", name: "Miód", kcal: 304, proteinG: 0.3, fatG: 0, carbsG: 82, aliases: ["miod"] },
];

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

export function searchFoodCatalog(query: string, limit = 12): FoodCatalogItem[] {
  const q = normalize(query);
  if (!q) return FOOD_CATALOG.slice(0, limit);
  const scored = FOOD_CATALOG.map((item) => {
    const name = normalize(item.name);
    const aliases = (item.aliases ?? []).map(normalize);
    let score = 0;
    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.includes(q)) score = 60;
    else if (aliases.some((a) => a.includes(q) || q.includes(a))) score = 50;
    return { item, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.item);
}
