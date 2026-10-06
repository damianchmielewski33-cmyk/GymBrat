/**
 * Rozszerzenia zapytań PL → EN pod obce bazy (USDA itd.).
 * Nie tłumaczy wszystkiego — tylko częste produkty spożywcze.
 */

function norm(raw: string): string {
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

const PL_EN_EXACT: Record<string, string> = {
  truskawka: "strawberry",
  truskawki: "strawberry",
  malina: "raspberry",
  maliny: "raspberry",
  jagoda: "blueberry",
  jagody: "blueberry",
  borowka: "blueberry",
  borowki: "blueberry",
  banan: "banana",
  banany: "banana",
  jablko: "apple",
  jablka: "apple",
  gruszka: "pear",
  gruszki: "pear",
  pomarancza: "orange",
  pomarancze: "orange",
  winogrono: "grape",
  winogrona: "grape",
  kiwi: "kiwi",
  awokado: "avocado",
  pomidor: "tomato",
  pomidory: "tomato",
  ogorek: "cucumber",
  ogorki: "cucumber",
  marchew: "carrot",
  marchewka: "carrot",
  ziemniak: "potato",
  ziemniaki: "potato",
  brokul: "broccoli",
  ryz: "rice",
  makaron: "pasta",
  chleb: "bread",
  jajko: "egg",
  jajka: "egg",
  mleko: "milk",
  jogurt: "yogurt",
  twarog: "cottage cheese",
  ser: "cheese",
  maslo: "butter",
  kurczak: "chicken",
  piers: "chicken breast",
  indyk: "turkey",
  wolowina: "beef",
  wieprzowina: "pork",
  losos: "salmon",
  tunczyk: "tuna",
  dorsz: "cod",
  oliwa: "olive oil",
  miod: "honey",
  orzechy: "walnuts",
  migdaly: "almonds",
  kasza: "buckwheat",
  gryka: "buckwheat",
  owsiane: "oats",
  platki: "cereal",
  skyr: "skyr",
  kefir: "kefir",
  hummus: "hummus",
  tofu: "tofu",
  czekolada: "chocolate",
  cukinia: "zucchini",
  papryka: "bell pepper",
  szpinak: "spinach",
  salata: "lettuce",
  cebula: "onion",
  czosnek: "garlic",
  ananas: "pineapple",
  mango: "mango",
  arbuz: "watermelon",
  cytryna: "lemon",
  limonka: "lime",
  sliwka: "plum",
  wisnia: "cherry",
  czeresnia: "cherry",
  morela: "apricot",
  brzoskwinia: "peach",
  fasola: "beans",
  soczewica: "lentils",
  ciecierzyca: "chickpeas",
  schab: "pork loin",
  szynka: "ham",
  krewetki: "shrimp",
  majonez: "mayonnaise",
  ketchup: "ketchup",
  musztarda: "mustard",
};

/** Angielskie warianty zapytania (dla USDA / OFF world). */
export function englishFoodQueryVariants(query: string): string[] {
  const n = norm(query);
  if (!n) return [];
  const out = new Set<string>();
  const parts = n.split(" ").filter(Boolean);

  const mappedParts = parts.map((p) => PL_EN_EXACT[p] ?? null);
  if (mappedParts.every((x) => x != null)) {
    out.add(mappedParts.join(" "));
  }
  for (const p of parts) {
    const en = PL_EN_EXACT[p];
    if (en) out.add(en);
  }
  if (PL_EN_EXACT[n]) out.add(PL_EN_EXACT[n]!);

  return [...out].filter((v) => v.length >= 2).slice(0, 4);
}
