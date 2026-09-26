import type { FoodNutritionDetails, FoodProduct } from "@/lib/food-products-types";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** WW — wymienniki węglowodanowe (1 WW ≈ 10 g węgli). */
export function carbohydrateExchanges(carbsG: number): number {
  return round1(carbsG / 10);
}

/** WBT — wymienniki białkowo-tłuszczowe ((B·4 + T·9) / 100). */
export function proteinFatExchanges(proteinG: number, fatG: number): number {
  return round1((proteinG * 4 + fatG * 9) / 100);
}

export type IngredientTagKind = "healthy" | "safe" | "harmful";

const HARMFUL = [
  "sól",
  "sol ",
  "salt",
  "cukier",
  "sugar",
  "syrop glukozowy",
  "syrop glukozowo",
  "syrop fruktozowy",
  "olej palmowy",
  "tłuszcz palmowy",
  "e621",
  "msg",
  "glutaminian",
  "arom",
  "barwnik",
  "konserwant",
  "hydrolizat",
];

const HEALTHY = [
  "mleko",
  "woda",
  "jaj",
  "owies",
  "owsian",
  "pełnoziarnist",
  "warzyw",
  "owoc",
  "oliwa",
  "olej rzepakowy",
  "jogurt",
  "twaróg",
  "twarog",
  "banan",
  "kiwi",
  "kurczak",
  "łosoś",
  "losos",
  "fasol",
  "soczewic",
];

/** Sygnały ultra-przetworzonych / „śmieciowych” produktów w nazwie. */
const JUNK_NAME = [
  "chips",
  "chip",
  "chrupk",
  "krakers",
  "snack",
  "frytk",
  "batonik",
  "baton ",
  "ciastk",
  "herbatnik",
  "cukierk",
  "żelk",
  "zelk",
  "cola",
  "napój gazowany",
  "napoj gazowany",
  "energetyk",
  "fast food",
  "hamburger",
  "hot dog",
  "pizza",
  "kebab",
];

const WHOLESOME_NAME = [
  "twaróg",
  "twarog",
  "jogurt natural",
  "jogurt grecki",
  "skyr",
  "kefir",
  "pierś",
  "piers",
  "filet",
  "jajko",
  "jajka",
  "owsian",
  "kasza",
  "ryż brąz",
  "ryz braz",
  "brokuł",
  "brokul",
  "szpinak",
  "banan",
  "jabłk",
  "jablk",
  "kiwi",
  "łosoś",
  "losos",
  "tuńczyk",
  "tunczyk",
];

export function classifyIngredient(raw: string): IngredientTagKind {
  const s = raw.toLowerCase().trim();
  if (HARMFUL.some((k) => s.includes(k))) return "harmful";
  if (HEALTHY.some((k) => s.includes(k))) return "healthy";
  return "safe";
}

export function splitIngredients(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/[,;•·\n]+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 1 && s.length < 80)
    .slice(0, 24);
}

export type GymbratScoreResult = {
  score: number;
  max: number;
  /** Krótka etykieta PL. */
  label: string;
  /** Uzasadnienia (ujawniają szczegóły oceny). */
  reasons: string[];
};

function scoreLabel(score: number): string {
  if (score >= 4.5) return "Świetny";
  if (score >= 3.5) return "Dobry";
  if (score >= 2.5) return "Przeciętny";
  if (score >= 1.5) return "Słaby";
  return "Unikaj";
}

/**
 * Ocena GymBrat 1–5 (na 100 g) — gęstość energii, tłuszcz, cukier, sól,
 * białko, błonnik, sygnały ultra-przetworzenia w nazwie/składzie.
 * Zawsze działa na makro; szczegóły mikro wzmacniają ocenę gdy są.
 */
export function gymbratNutritionScore(
  product: FoodProduct,
): GymbratScoreResult {
  const d = product.details;
  const reasons: string[] = [];
  let penalty = 0;
  let bonus = 0;

  const kcal = product.calories;
  const protein = product.proteinG;
  const fat = product.fatG;
  const carbs = product.carbsG;
  const salt = d?.saltG ?? (d?.sodiumMg != null ? d.sodiumMg / 400 : null);
  const sugar = d?.sugarsG;
  const sat = d?.saturatedFatG;
  const fiber = d?.fiberG;
  const nameHay = `${product.name} ${product.brand ?? ""}`.toLowerCase();
  const ingredients = splitIngredients(d?.ingredientsText);
  const harmfulCount = ingredients.filter((i) => classifyIngredient(i) === "harmful").length;

  // —— Kary (na 100 g) ——
  if (kcal >= 500) {
    penalty += 1.6;
    reasons.push(`Bardzo wysoka kaloryczność (${Math.round(kcal)} kcal/100 g)`);
  } else if (kcal >= 400) {
    penalty += 1.1;
    reasons.push(`Wysoka kaloryczność (${Math.round(kcal)} kcal/100 g)`);
  } else if (kcal >= 300) {
    penalty += 0.5;
    reasons.push(`Podwyższona kaloryczność (${Math.round(kcal)} kcal/100 g)`);
  }

  if (fat >= 30) {
    penalty += 1.2;
    reasons.push(`Bardzo dużo tłuszczu (${round1(fat)} g/100 g)`);
  } else if (fat >= 20) {
    penalty += 0.8;
    reasons.push(`Dużo tłuszczu (${round1(fat)} g/100 g)`);
  } else if (fat >= 12) {
    penalty += 0.35;
  }

  if (sat != null) {
    if (sat >= 10) {
      penalty += 1.0;
      reasons.push(`Dużo tłuszczów nasyconych (${round1(sat)} g)`);
    } else if (sat >= 5) {
      penalty += 0.5;
      reasons.push(`Podwyższone tłuszcze nasycone (${round1(sat)} g)`);
    }
  }

  if (sugar != null) {
    if (sugar >= 20) {
      penalty += 1.2;
      reasons.push(`Bardzo dużo cukru (${round1(sugar)} g/100 g)`);
    } else if (sugar >= 12) {
      penalty += 0.7;
      reasons.push(`Dużo cukru (${round1(sugar)} g/100 g)`);
    } else if (sugar >= 6) {
      penalty += 0.3;
    }
  } else if (carbs >= 40 && protein < 8 && fat >= 15) {
    // Typowy profil chipsów bez danych o cukrze
    penalty += 0.4;
  }

  if (salt != null) {
    if (salt >= 1.5) {
      penalty += 1.0;
      reasons.push(`Dużo soli (${round1(salt)} g/100 g)`);
    } else if (salt >= 0.9) {
      penalty += 0.55;
      reasons.push(`Podwyższona sól (${round1(salt)} g/100 g)`);
    } else if (salt >= 0.5) {
      penalty += 0.25;
    }
  }

  // Profil „przekąska”: mało białka, dużo kcal/tłuszczu/węgli
  if (protein < 6 && kcal >= 350 && (fat >= 15 || carbs >= 35)) {
    penalty += 0.7;
    reasons.push("Profil przekąski: mało białka przy wysokiej energii");
  }

  if (JUNK_NAME.some((k) => nameHay.includes(k))) {
    penalty += 0.9;
    reasons.push("Nazwa wskazuje produkt ultra-przetworzony / przekąskę");
  }

  if (harmfulCount >= 3) {
    penalty += 0.8;
    reasons.push(`W składzie dużo składników do ograniczenia (${harmfulCount})`);
  } else if (harmfulCount >= 1) {
    penalty += 0.35;
    reasons.push("W składzie są składniki do ograniczenia");
  }

  // —— Bonusy ——
  if (protein >= 18) {
    bonus += 0.9;
    reasons.push(`Wysoka zawartość białka (${round1(protein)} g)`);
  } else if (protein >= 12) {
    bonus += 0.55;
    reasons.push(`Dobre źródło białka (${round1(protein)} g)`);
  } else if (protein >= 8) {
    bonus += 0.25;
  }

  if (fiber != null) {
    if (fiber >= 6) {
      bonus += 0.5;
      reasons.push(`Dużo błonnika (${round1(fiber)} g)`);
    } else if (fiber >= 3) {
      bonus += 0.25;
    }
  }

  if (kcal > 0 && kcal <= 120 && protein >= 8) {
    bonus += 0.45;
    reasons.push("Niska kaloryczność przy solidnym białku");
  }

  if (WHOLESOME_NAME.some((k) => nameHay.includes(k))) {
    bonus += 0.35;
    reasons.push("Produkt z kategorii bazowych (nabiał / białko / owoce)");
  }

  // Brak danych mikro przy podejrzanym profilu — nie dawaj wysokiej oceny „z niewiedzy”
  const missingMicro =
    sugar == null && sat == null && salt == null && Boolean(d);
  if (missingMicro && kcal >= 350 && protein < 8) {
    penalty += 0.5;
    reasons.push("Brak pełnych danych mikro — ostrożniejsza ocena");
  }

  if (!d) {
    reasons.push("Ocena na podstawie makro (brak pełnych szczegółów)");
  }

  const raw = 5 - penalty + bonus;
  const score = Math.max(1, Math.min(5, Math.round(raw * 10) / 10));
  // Unikalne, max 5 uzasadnień (najpierw kary/istotne)
  const uniq = [...new Set(reasons)].slice(0, 5);
  if (uniq.length === 0) {
    uniq.push(score >= 4 ? "Zrównoważony profil odżywczy" : "Ocena na podstawie dostępnych danych");
  }

  return { score, max: 5, label: scoreLabel(score), reasons: uniq };
}

export function emptyDetails(): FoodNutritionDetails {
  return {
    saturatedFatG: null,
    monoFatG: null,
    polyFatG: null,
    omega3G: null,
    omega6G: null,
    sugarsG: null,
    fiberG: null,
    saltG: null,
    sodiumMg: null,
    cholesterolMg: null,
    caffeineMg: null,
    vitaminAUg: null,
    vitaminCMg: null,
    vitaminDUg: null,
    calciumMg: null,
    ironMg: null,
    ingredientsText: null,
  };
}

/** Skaluje szczegóły z bazy 100 g na wybraną ilość gramów. */
export function scaleDetails(
  details: FoodNutritionDetails | undefined,
  grams: number,
): FoodNutritionDetails | undefined {
  if (!details) return undefined;
  const f = grams / 100;
  const scale = (v: number | null): number | null =>
    v == null ? null : round1(v * f);
  return {
    saturatedFatG: scale(details.saturatedFatG),
    monoFatG: scale(details.monoFatG),
    polyFatG: scale(details.polyFatG),
    omega3G: scale(details.omega3G),
    omega6G: scale(details.omega6G),
    sugarsG: scale(details.sugarsG),
    fiberG: scale(details.fiberG),
    saltG: scale(details.saltG),
    sodiumMg: scale(details.sodiumMg),
    cholesterolMg: scale(details.cholesterolMg),
    caffeineMg: scale(details.caffeineMg),
    vitaminAUg: scale(details.vitaminAUg),
    vitaminCMg: scale(details.vitaminCMg),
    vitaminDUg: scale(details.vitaminDUg),
    calciumMg: scale(details.calciumMg),
    ironMg: scale(details.ironMg),
    ingredientsText: details.ingredientsText,
  };
}

export type NutritionRow = {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  indent?: boolean;
  section?: boolean;
};

/** Wiersze tabeli jak w Fitatu — null → „b.d.”. */
export function buildNutritionRows(
  macros: { calories: number; proteinG: number; fatG: number; carbsG: number },
  details: FoodNutritionDetails | undefined,
): NutritionRow[] {
  const d = details ?? emptyDetails();
  const netCarbs =
    d.fiberG != null ? round1(Math.max(0, macros.carbsG - d.fiberG)) : null;

  return [
    { id: "kcal", label: "Wartość energetyczna (kcal)", value: macros.calories, unit: "kcal" },
    { id: "protein", label: "Białka (g)", value: macros.proteinG, unit: "g" },
    { id: "protein-animal", label: "zwierzęce", value: null, unit: "g", indent: true },
    { id: "protein-plant", label: "roślinne", value: null, unit: "g", indent: true },
    { id: "fat", label: "Tłuszcze (g)", value: macros.fatG, unit: "g" },
    { id: "sat", label: "nasycone", value: d.saturatedFatG, unit: "g", indent: true },
    { id: "mono", label: "jednonienasycone", value: d.monoFatG, unit: "g", indent: true },
    { id: "poly", label: "wielonienasycone", value: d.polyFatG, unit: "g", indent: true },
    { id: "o3", label: "Kwas omega 3", value: d.omega3G, unit: "g", indent: true },
    { id: "o6", label: "Kwas omega 6", value: d.omega6G, unit: "g", indent: true },
    { id: "carbs", label: "Węglowodany (g)", value: macros.carbsG, unit: "g" },
    { id: "net", label: "Węglowodany netto", value: netCarbs, unit: "g", indent: true },
    { id: "sugars", label: "Cukry", value: d.sugarsG, unit: "g", indent: true },
    { id: "fiber", label: "Błonnik (g)", value: d.fiberG, unit: "g" },
    { id: "salt", label: "Sól (g)", value: d.saltG, unit: "g" },
    { id: "chol", label: "Cholesterol (mg)", value: d.cholesterolMg, unit: "mg" },
    { id: "caff", label: "Kofeina (mg)", value: d.caffeineMg, unit: "mg" },
    { id: "vit-sec", label: "Witaminy", value: null, unit: "", section: true },
    { id: "vita", label: "Witamina A (µg)", value: d.vitaminAUg, unit: "µg" },
    { id: "vitc", label: "Witamina C (mg)", value: d.vitaminCMg, unit: "mg" },
    { id: "vitd", label: "Witamina D (µg)", value: d.vitaminDUg, unit: "µg" },
    { id: "min-sec", label: "Minerały", value: null, unit: "", section: true },
    { id: "ca", label: "Wapń (mg)", value: d.calciumMg, unit: "mg" },
    { id: "fe", label: "Żelazo (mg)", value: d.ironMg, unit: "mg" },
  ];
}

export function formatNutrientValue(value: number | null, unit: string): string {
  if (value == null) return "b.d.";
  const n = Number.isInteger(value) ? String(value) : String(round1(value)).replace(".", ",");
  return unit ? `${n} ${unit}` : n;
}

const FOOD_NAME_NORM = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/g, "l")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Znane pomyłki MT / złe „product_name_pl” z OFF (np. skyr → screw).
 * Jeśli autentyczna nazwa zawiera `keep`, a kandydat PL wygląda jak `reject` — odrzucamy PL.
 */
const FOOD_NAME_MT_TRAPS: Array<{ keep: RegExp; reject: RegExp }> = [
  { keep: /\bskyr\b/i, reject: /\b(screw|screws|shy|bolt|clear|skrew)\b/i },
  { keep: /\bquark\b/i, reject: /\b(quark\s*star|strange)\b/i },
  { keep: /\bmozzarella\b/i, reject: /\b(buffalo\s*bill|mozzarella\s*stickers)\b/i },
  { keep: /\bricotta\b/i, reject: /\b(rich\s*otta|ricotta\s*cheese\s*cake)\b/i },
  { keep: /\btwar[oó]g\b/i, reject: /\b(cottage\s*industry|curd\s*soap)\b/i },
];

/** Same „tłumaczenia” PL, które są oczywistym śmieciem (bez kontekstu). */
const FOOD_NAME_PL_JUNK = new Set([
  "screw",
  "screws",
  "shy",
  "bolt",
  "clear",
  "skrew",
  "strange",
]);

function cleanFoodNamePart(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/\s+/g, " ");
}

/** Czy kandydat PL wygląda na zepsute tłumaczenie względem pozostałych pól OFF. */
export function isSuspiciousFoodNamePl(
  candidate: string,
  authenticHints: Array<string | null | undefined>,
): boolean {
  const c = cleanFoodNamePart(candidate);
  if (!c) return true;
  const cLow = FOOD_NAME_NORM(c);
  if (FOOD_NAME_PL_JUNK.has(cLow)) return true;

  const hintsJoined = authenticHints
    .map((h) => cleanFoodNamePart(h))
    .filter(Boolean)
    .join(" ");
  if (!hintsJoined) return false;

  for (const trap of FOOD_NAME_MT_TRAPS) {
    if (trap.keep.test(hintsJoined) && trap.reject.test(c)) return true;
  }

  // PL bez diacrytyków, krótkie angielskie słowo, a oryginał ma znany zapożyczenie spożywcze
  if (
    trapLoanwordLost(hintsJoined, c) &&
    /^[a-z][a-z\s-]{1,14}$/i.test(c) &&
    !/[ąćęłńóśźż]/i.test(c)
  ) {
    return true;
  }

  return false;
}

function trapLoanwordLost(hints: string, candidate: string): boolean {
  for (const trap of FOOD_NAME_MT_TRAPS) {
    if (trap.keep.test(hints) && !trap.keep.test(candidate)) return true;
  }
  return false;
}

/**
 * Wybór nazwy produktu: preferuj PL, ale odrzuć śmieciowe product_name_pl
 * (np. „Screw” zamiast „Skyr”).
 */
export function pickFoodProductName(args: {
  productName?: string | null;
  productNamePl?: string | null;
  genericName?: string | null;
  genericNamePl?: string | null;
}): string {
  const productName = cleanFoodNamePart(args.productName);
  const productNamePl = cleanFoodNamePart(args.productNamePl);
  const genericName = cleanFoodNamePart(args.genericName);
  const genericNamePl = cleanFoodNamePart(args.genericNamePl);

  const authentic = [productName, genericName, productNamePl, genericNamePl];

  const ordered = [
    { value: productNamePl, pl: true },
    { value: productName, pl: false },
    { value: genericNamePl, pl: true },
    { value: genericName, pl: false },
  ];

  for (const item of ordered) {
    if (!item.value) continue;
    if (item.pl && isSuspiciousFoodNamePl(item.value, authentic)) continue;
    return item.value;
  }

  return productName || productNamePl || genericName || genericNamePl || "";
}

/** Pełna nazwa: marka + nazwa produktu (bez duplikatu marki). */
export function formatFoodDisplayName(args: {
  productName?: string | null;
  productNamePl?: string | null;
  genericName?: string | null;
  genericNamePl?: string | null;
  brands?: string | null;
}): string {
  const brand = cleanFoodNamePart((args.brands ?? "").split(/[,;]/)[0]);
  const name = pickFoodProductName(args);

  if (!name && !brand) return "";
  if (!brand) return name;
  if (!name) return brand;

  const nName = FOOD_NAME_NORM(name);
  const nBrand = FOOD_NAME_NORM(brand);
  if (nName.startsWith(nBrand) || nName.includes(` ${nBrand} `) || nName.includes(nBrand)) {
    return name;
  }
  return `${brand} ${name}`;
}
