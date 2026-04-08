/**
 * Kategorie partii mięśniowych + katalog ćwiczeń do budowy planu.
 * Polska nazwa jest kanoniczna; aliasesEn służy do wyszukiwania po angielsku (i frazach mieszanych).
 */

export type MuscleCategory = {
  id: string;
  label: string;
};

/** Wszystkie typowe partie / grupy — użytkownik przypisuje ćwiczenie do kategorii. */
export const MUSCLE_CATEGORIES: MuscleCategory[] = [
  { id: "chest", label: "Klatka piersiowa" },
  { id: "back_upper", label: "Plecy (góra)" },
  { id: "back_mid", label: "Plecy (środek)" },
  { id: "back_lower", label: "Plecy (dół) / lędźwie" },
  { id: "shoulders", label: "Barki" },
  { id: "biceps", label: "Biceps" },
  { id: "triceps", label: "Triceps" },
  { id: "forearms", label: "Przedramiona" },
  { id: "core", label: "Brzuch / core" },
  { id: "quads", label: "Uda (przód)" },
  { id: "glutes", label: "Pośladki" },
  { id: "hamstrings", label: "Uda (tył)" },
  { id: "calves", label: "Łydki" },
  { id: "cardio", label: "Cardio" },
];

export type CatalogExercise = {
  id: string;
  /** Kanoniczna nazwa po polsku (wyświetlanie i zapis planu). */
  name: string;
  categoryId: string;
  /** Angielskie nazwy, skróty i warianty zapisu — dopasowanie → polska nazwa. */
  aliasesEn?: string[];
};

export const CATALOG_EXERCISES: CatalogExercise[] = [
  // Klatka
  {
    id: "c-bench-bar",
    name: "Wyciskanie sztangi na ławce poziomej",
    categoryId: "chest",
    aliasesEn: [
      "bench press",
      "barbell bench press",
      "flat bench press",
      "bb bench",
    ],
  },
  {
    id: "c-bench-db",
    name: "Wyciskanie hantli na ławce poziomej",
    categoryId: "chest",
    aliasesEn: ["dumbbell bench press", "db bench press", "dumbbell bench", "flat db press"],
  },
  {
    id: "c-incline-bar",
    name: "Wyciskanie sztangi na ławce dodatniej",
    categoryId: "chest",
    aliasesEn: ["incline bench press", "incline barbell press", "incline bb press"],
  },
  {
    id: "c-incline-db",
    name: "Wyciskanie hantli na ławce dodatniej",
    categoryId: "chest",
    aliasesEn: ["incline dumbbell press", "incline db press"],
  },
  {
    id: "c-decline",
    name: "Wyciskanie na ławce ujemnej",
    categoryId: "chest",
    aliasesEn: ["decline bench press", "decline press"],
  },
  {
    id: "c-fly-db",
    name: "Rozpiętki z hantlami",
    categoryId: "chest",
    aliasesEn: ["dumbbell fly", "db fly", "chest fly", "dumbbell flyes"],
  },
  {
    id: "c-fly-cable",
    name: "Rozpiętki na wyciągu",
    categoryId: "chest",
    aliasesEn: ["cable fly", "cable crossover", "cable chest fly"],
  },
  {
    id: "c-dips",
    name: "Pompki na poręczach (klatka)",
    categoryId: "chest",
    aliasesEn: ["chest dips", "parallel bar dips", "dip"],
  },
  {
    id: "c-pushup",
    name: "Pompki klasyczne",
    categoryId: "chest",
    aliasesEn: ["push up", "pushup", "push-ups", "press up"],
  },
  {
    id: "c-pullover",
    name: "Przeciąganie hantla (pullover)",
    categoryId: "chest",
    aliasesEn: ["dumbbell pullover", "db pullover", "pullover"],
  },
  // Plecy góra
  {
    id: "bu-pullup",
    name: "Podciąganie na drążku",
    categoryId: "back_upper",
    aliasesEn: ["pull up", "pullup", "pull-up", "chin up", "chinup", "lat pull up"],
  },
  {
    id: "bu-lat-pulldown",
    name: "Ściąganie drążka wyciągu górnego",
    categoryId: "back_upper",
    aliasesEn: [
      "lat pulldown",
      "lat pull down",
      "lat pull-down",
      "cable pulldown",
      "wide grip pulldown",
    ],
  },
  {
    id: "bu-pullover-cable",
    name: "Pullover na wyciągu",
    categoryId: "back_upper",
    aliasesEn: ["cable pullover", "straight arm pulldown"],
  },
  {
    id: "bu-facepull",
    name: "Face pull",
    categoryId: "back_upper",
    aliasesEn: ["face pull", "facepull", "rope face pull"],
  },
  // Plecy środek
  {
    id: "bm-row-barbell",
    name: "Wiosłowanie sztangą w opadzie",
    categoryId: "back_mid",
    aliasesEn: [
      "bent over row",
      "barbell row",
      "pendlay row",
      "bb row",
      "bent over barbell row",
    ],
  },
  {
    id: "bm-row-db",
    name: "Wiosłowanie hantłem jednorącz",
    categoryId: "back_mid",
    aliasesEn: [
      "dumbbell row",
      "one arm dumbbell row",
      "single arm dumbbell row",
      "db row",
      "kroczek",
    ],
  },
  {
    id: "bm-row-cable",
    name: "Wiosłowanie na wyciągu siedząc",
    categoryId: "back_mid",
    aliasesEn: [
      "seated cable row",
      "cable row",
      "single arm cable row",
      "one arm cable row",
      "unilateral cable row",
      "kneeling cable row",
      "low cable row",
      "mid row",
    ],
  },
  {
    id: "bm-chest-supported",
    name: "Wiosłowanie na ławce (chest-supported)",
    categoryId: "back_mid",
    aliasesEn: [
      "chest supported row",
      "incline bench row",
      "supported dumbbell row",
      "seal row",
    ],
  },
  {
    id: "bm-tbar",
    name: "Wiosłowanie w opadzie (T-bar)",
    categoryId: "back_mid",
    aliasesEn: ["t-bar row", "t bar row", "tbar row", "landmine row"],
  },
  // Plecy dół / lędźwie
  {
    id: "bl-deadlift",
    name: "Martwy ciąg klasyczny",
    categoryId: "back_lower",
    aliasesEn: ["deadlift", "conventional deadlift", "bb deadlift"],
  },
  {
    id: "bl-rdl",
    name: "Rumuński martwy ciąg (RDL)",
    categoryId: "back_lower",
    aliasesEn: ["romanian deadlift", "rdl", "stiff leg deadlift"],
  },
  {
    id: "bl-hyper",
    name: "Nadprożna / hyperextension",
    categoryId: "back_lower",
    aliasesEn: ["hyperextension", "back extension", "45 hyper", "reverse hyper"],
  },
  {
    id: "bl-back-ext",
    name: "Prostowanie tułowia na ławce",
    categoryId: "back_lower",
    aliasesEn: ["back extension machine", "lower back extension"],
  },
  // Barki
  {
    id: "s-ohp-bar",
    name: "Wyciskanie nad głowę sztangą",
    categoryId: "shoulders",
    aliasesEn: ["overhead press", "ohp", "military press", "standing press", "barbell ohp"],
  },
  {
    id: "s-ohp-db",
    name: "Wyciskanie hantli nad głowę",
    categoryId: "shoulders",
    aliasesEn: ["dumbbell shoulder press", "db ohp", "seated shoulder press"],
  },
  {
    id: "s-lateral",
    name: "Unoszenie hantli bokiem",
    categoryId: "shoulders",
    aliasesEn: ["lateral raise", "side raise", "dumbbell lateral raise"],
  },
  {
    id: "s-front-raise",
    name: "Unoszenie hantli przodem",
    categoryId: "shoulders",
    aliasesEn: ["front raise", "front dumbbell raise"],
  },
  {
    id: "s-rear-fly",
    name: "Odwrócone rozpiętki / ptaki",
    categoryId: "shoulders",
    aliasesEn: ["rear delt fly", "reverse fly", "rear delt raise", "bent over lateral raise"],
  },
  {
    id: "s-upright-row",
    name: "Podciąganie sztangi pod brodę",
    categoryId: "shoulders",
    aliasesEn: ["upright row", "barbell upright row"],
  },
  {
    id: "s-arhnold",
    name: "Arnoldki",
    categoryId: "shoulders",
    aliasesEn: ["arnold press", "arnold dumbbell press"],
  },
  // Biceps
  {
    id: "bi-barbell-curl",
    name: "Uginanie przedramion ze sztangą",
    categoryId: "biceps",
    aliasesEn: ["barbell curl", "bb curl", "standing curl"],
  },
  {
    id: "bi-db-curl",
    name: "Uginanie hantlami stojąc",
    categoryId: "biceps",
    aliasesEn: ["dumbbell curl", "db curl", "alternating curl"],
  },
  {
    id: "bi-hammer",
    name: "Uginanie młotkowe",
    categoryId: "biceps",
    aliasesEn: ["hammer curl", "neutral grip curl"],
  },
  {
    id: "bi-preacher",
    name: "Uginanie na modlitewniku",
    categoryId: "biceps",
    aliasesEn: ["preacher curl", "scott curl"],
  },
  {
    id: "bi-cable-curl",
    name: "Uginanie na wyciągu dolnym",
    categoryId: "biceps",
    aliasesEn: ["cable curl", "low cable curl"],
  },
  {
    id: "bi-concentration",
    name: "Uginanie koncentracyjne",
    categoryId: "biceps",
    aliasesEn: ["concentration curl"],
  },
  // Triceps
  {
    id: "tr-pushdown",
    name: "Prostowanie na wyciągu (lina / drążek)",
    categoryId: "triceps",
    aliasesEn: ["tricep pushdown", "cable pushdown", "rope pushdown"],
  },
  {
    id: "tr-skull",
    name: "Prostowanie leżąc (francuskie)",
    categoryId: "triceps",
    aliasesEn: ["skull crusher", "lying tricep extension", "french press"],
  },
  {
    id: "tr-overhead",
    name: "Prostowanie nad głowę z hantlem",
    categoryId: "triceps",
    aliasesEn: ["overhead tricep extension", "single dumbbell extension"],
  },
  {
    id: "tr-dips",
    name: "Pompki na poręczach (triceps)",
    categoryId: "triceps",
    aliasesEn: ["tricep dips", "bench dips"],
  },
  {
    id: "tr-kickback",
    name: "Kickback z hantlem",
    categoryId: "triceps",
    aliasesEn: ["tricep kickback", "dumbbell kickback"],
  },
  {
    id: "tr-close-grip",
    name: "Wąski wycisk na ławce",
    categoryId: "triceps",
    aliasesEn: ["close grip bench press", "cgbp", "narrow bench"],
  },
  // Przedramiona
  {
    id: "f-wrist-curl",
    name: "Uginanie nadgarstków podchwytem",
    categoryId: "forearms",
    aliasesEn: ["wrist curl", "palms up wrist curl"],
  },
  {
    id: "f-reverse-curl",
    name: "Uginanie nachwytem",
    categoryId: "forearms",
    aliasesEn: ["reverse curl", "pronated curl"],
  },
  {
    id: "f-farmer",
    name: "Farmer walk",
    categoryId: "forearms",
    aliasesEn: ["farmer carry", "farmer walk", "loaded carry"],
  },
  // Core
  {
    id: "co-plank",
    name: "Deska (plank)",
    categoryId: "core",
    aliasesEn: ["plank", "front plank", "high plank"],
  },
  {
    id: "co-dead-bug",
    name: "Dead bug",
    categoryId: "core",
    aliasesEn: ["dead bug"],
  },
  {
    id: "co-crunch",
    name: "Spięcia brzucha",
    categoryId: "core",
    aliasesEn: ["crunch", "ab crunch", "sit up"],
  },
  {
    id: "co-leg-raise",
    name: "Unoszenie nóg w zwisie",
    categoryId: "core",
    aliasesEn: ["hanging leg raise", "leg raise", "knee raise"],
  },
  {
    id: "co-cable-crunch",
    name: "Spięcia brzucha na wyciągu",
    categoryId: "core",
    aliasesEn: ["cable crunch", "kneeling cable crunch"],
  },
  {
    id: "co-russian",
    name: "Russian twist",
    categoryId: "core",
    aliasesEn: ["russian twist"],
  },
  {
    id: "co-ab-wheel",
    name: "Koło do brzucha (ab wheel)",
    categoryId: "core",
    aliasesEn: ["ab wheel", "ab rollout", "rollout"],
  },
  // Uda przód
  {
    id: "q-squat",
    name: "Przysiad ze sztangą",
    categoryId: "quads",
    aliasesEn: ["squat", "back squat", "barbell squat", "bb squat"],
  },
  {
    id: "q-front-squat",
    name: "Przysiad przedni",
    categoryId: "quads",
    aliasesEn: ["front squat"],
  },
  {
    id: "q-goblet",
    name: "Przysiad goblet",
    categoryId: "quads",
    aliasesEn: ["goblet squat"],
  },
  {
    id: "q-leg-press",
    name: "Wypychanie nogami na suwnicy",
    categoryId: "quads",
    aliasesEn: ["leg press", "sled leg press"],
  },
  {
    id: "q-lunge",
    name: "Wykroki",
    categoryId: "quads",
    aliasesEn: ["lunge", "walking lunge", "forward lunge"],
  },
  {
    id: "q-bulgarian",
    name: "Wykroki bułgarskie",
    categoryId: "quads",
    aliasesEn: ["bulgarian split squat", "bss", "split squat"],
  },
  {
    id: "q-extension",
    name: "Prostowanie nóg na maszynie",
    categoryId: "quads",
    aliasesEn: ["leg extension", "quad extension"],
  },
  // Pośladki
  {
    id: "g-hip-thrust",
    name: "Hip thrust",
    categoryId: "glutes",
    aliasesEn: ["hip thrust", "barbell hip thrust", "glute bridge weighted"],
  },
  {
    id: "g-bridge",
    name: "Mostek z hantlem",
    categoryId: "glutes",
    aliasesEn: ["glute bridge", "dumbbell glute bridge"],
  },
  {
    id: "g-kickback-cable",
    name: "Zakopy na wyciągu",
    categoryId: "glutes",
    aliasesEn: ["cable kickback", "glute kickback"],
  },
  {
    id: "g-abduction",
    name: "Odwodzenie nóg (maszyna)",
    categoryId: "glutes",
    aliasesEn: ["hip abduction", "abduction machine"],
  },
  // Uda tył
  {
    id: "h-leg-curl-lying",
    name: "Uginanie nóg leżąc",
    categoryId: "hamstrings",
    aliasesEn: ["lying leg curl", "hamstring curl lying"],
  },
  {
    id: "h-leg-curl-seated",
    name: "Uginanie nóg siedząc",
    categoryId: "hamstrings",
    aliasesEn: ["seated leg curl"],
  },
  {
    id: "h-nordic",
    name: "Nordic curl (jeśli dostępne)",
    categoryId: "hamstrings",
    aliasesEn: ["nordic curl", "nordic hamstring curl"],
  },
  {
    id: "h-good-morning",
    name: "Dobry dzień",
    categoryId: "hamstrings",
    aliasesEn: ["good morning", "barbell good morning"],
  },
  // Łydki
  {
    id: "ca-standing",
    name: "Wspięcia na łydkach stojąc",
    categoryId: "calves",
    aliasesEn: ["standing calf raise", "calf raise standing"],
  },
  {
    id: "ca-seated",
    name: "Wspięcia na łydkach siedząc",
    categoryId: "calves",
    aliasesEn: ["seated calf raise"],
  },
  {
    id: "ca-donkey",
    name: "Wspięcia (donkey / maszyna)",
    categoryId: "calves",
    aliasesEn: ["donkey calf raise", "calf raise machine"],
  },
  // Cardio
  {
    id: "cd-treadmill",
    name: "Bieżnia",
    categoryId: "cardio",
    aliasesEn: ["treadmill", "running machine", "jog"],
  },
  {
    id: "cd-bike",
    name: "Rower stacjonarny",
    categoryId: "cardio",
    aliasesEn: ["stationary bike", "bike", "cycling", "spin bike"],
  },
  {
    id: "cd-rower",
    name: "Wioślarz",
    categoryId: "cardio",
    aliasesEn: ["rower", "rowing machine", "concept2"],
  },
  {
    id: "cd-elliptical",
    name: "Orbitrek",
    categoryId: "cardio",
    aliasesEn: ["elliptical", "cross trainer"],
  },
  {
    id: "cd-ski",
    name: "Ergometr narciarski",
    categoryId: "cardio",
    aliasesEn: ["ski erg", "ski machine"],
  },
  {
    id: "cd-jump-rope",
    name: "Skakanka",
    categoryId: "cardio",
    aliasesEn: ["jump rope", "skipping rope", "rope skip"],
  },
];

/** Normalizacja zapytania: małe litery, pojedyncze spacje. */
export function normalizeForSearch(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Tekst do przeszukania: polska nazwa + aliasy (bez polskich znaków opcjonalnie później). */
function exerciseSearchHaystack(ex: CatalogExercise): string {
  const parts = [ex.name, ...(ex.aliasesEn ?? [])];
  return parts.join(" ").toLowerCase();
}

/**
 * Dopasowanie po tokenach: każdy wyraz zapytania musi wystąpić w nazwie lub aliasach.
 * Dzięki temu "single arm cable row" znajdzie ćwiczenie z aliasem "single arm cable row".
 */
export function exerciseMatchesQuery(ex: CatalogExercise, rawQuery: string): boolean {
  const q = normalizeForSearch(rawQuery);
  if (!q) return true;
  const haystack = exerciseSearchHaystack(ex);
  const tokens = q.split(" ").filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((t) => haystack.includes(t));
}

function scoreCatalogMatch(ex: CatalogExercise, rawQuery: string): number {
  const q = normalizeForSearch(rawQuery);
  const nameN = normalizeForSearch(ex.name);
  if (nameN === q) return 1000;
  for (const a of ex.aliasesEn ?? []) {
    const an = normalizeForSearch(a);
    if (an === q) return 950;
    if (an.includes(q) && q.length >= 3) return 800 + Math.min(q.length, 50);
  }
  if (nameN.includes(q)) return 600 + Math.min(q.length, 40);
  return 100;
}

/**
 * Najlepsze dopasowanie z katalogu po dowolnym wpisie (PL/EN).
 * Używane przy dodawaniu „własnego” ćwiczenia — jeśli trafienie, zapisujemy polską nazwę.
 */
export function findBestCatalogMatch(rawInput: string): CatalogExercise | null {
  const q = normalizeForSearch(rawInput);
  if (!q) return null;
  const candidates = CATALOG_EXERCISES.filter((ex) => exerciseMatchesQuery(ex, rawInput));
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!;

  let best = candidates[0]!;
  let bestScore = scoreCatalogMatch(best, rawInput);
  for (const ex of candidates.slice(1)) {
    const s = scoreCatalogMatch(ex, rawInput);
    if (s > bestScore) {
      bestScore = s;
      best = ex;
    }
  }
  return best;
}

export function categoryLabel(id: string): string {
  return MUSCLE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function exercisesForCategory(categoryId: string): CatalogExercise[] {
  return CATALOG_EXERCISES.filter((e) => e.categoryId === categoryId);
}

/**
 * Lista do panelu wyszukiwania: pusta fraza → tylko wybrana kategoria; z frazą → cały katalog z dopasowaniem.
 */
export function searchCatalogForPicker(
  categoryId: string,
  rawQuery: string,
): CatalogExercise[] {
  const q = normalizeForSearch(rawQuery);
  if (!q) {
    return exercisesForCategory(categoryId);
  }
  const matched = CATALOG_EXERCISES.filter((ex) => exerciseMatchesQuery(ex, rawQuery));
  const inCategory = matched.filter((ex) => ex.categoryId === categoryId);
  const rest = matched.filter((ex) => ex.categoryId !== categoryId);
  return [...inCategory, ...rest];
}
