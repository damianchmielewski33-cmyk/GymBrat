/**
 * Kategorie partii mięśniowych + katalog ćwiczeń do budowy planu.
 * id kategorii używane w zapisie planu (JSON).
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
  name: string;
  categoryId: string;
};

export const CATALOG_EXERCISES: CatalogExercise[] = [
  // Klatka
  { id: "c-bench-bar", name: "Wyciskanie sztangi na ławce poziomej", categoryId: "chest" },
  { id: "c-bench-db", name: "Wyciskanie hantli na ławce poziomej", categoryId: "chest" },
  { id: "c-incline-bar", name: "Wyciskanie sztangi na ławce dodatniej", categoryId: "chest" },
  { id: "c-incline-db", name: "Wyciskanie hantli na ławce dodatniej", categoryId: "chest" },
  { id: "c-decline", name: "Wyciskanie na ławce ujemnej", categoryId: "chest" },
  { id: "c-fly-db", name: "Rozpiętki z hantlami", categoryId: "chest" },
  { id: "c-fly-cable", name: "Rozpiętki na wyciągu", categoryId: "chest" },
  { id: "c-dips", name: "Pompki na poręczach (klatka)", categoryId: "chest" },
  { id: "c-pushup", name: "Pompki klasyczne", categoryId: "chest" },
  { id: "c-pullover", name: "Przeciąganie hantla (pullover)", categoryId: "chest" },
  // Plecy góra
  { id: "bu-pullup", name: "Podciąganie na drążku", categoryId: "back_upper" },
  { id: "bu-lat-pulldown", name: "Ściąganie drążka wyciągu górnego", categoryId: "back_upper" },
  { id: "bu-pullover-cable", name: "Pullover na wyciągu", categoryId: "back_upper" },
  { id: "bu-facepull", name: "Face pull", categoryId: "back_upper" },
  // Plecy środek
  { id: "bm-row-barbell", name: "Wiosłowanie sztangą w opadzie", categoryId: "back_mid" },
  { id: "bm-row-db", name: "Wiosłowanie hantłem jednorącz", categoryId: "back_mid" },
  { id: "bm-row-cable", name: "Wiosłowanie na wyciągu siedząc", categoryId: "back_mid" },
  { id: "bm-chest-supported", name: "Wiosłowanie na ławce (chest-supported)", categoryId: "back_mid" },
  { id: "bm-tbar", name: "Wiosłowanie w opadzie (T-bar)", categoryId: "back_mid" },
  // Plecy dół / lędźwie
  { id: "bl-deadlift", name: "Martwy ciąg klasyczny", categoryId: "back_lower" },
  { id: "bl-rdl", name: "Rumuński martwy ciąg (RDL)", categoryId: "back_lower" },
  { id: "bl-hyper", name: "Nadprożna / hyperextension", categoryId: "back_lower" },
  { id: "bl-back-ext", name: "Prostowanie tułowia na ławce", categoryId: "back_lower" },
  // Barki
  { id: "s-ohp-bar", name: "Wyciskanie nad głowę sztangą", categoryId: "shoulders" },
  { id: "s-ohp-db", name: "Wyciskanie hantli nad głowę", categoryId: "shoulders" },
  { id: "s-lateral", name: "Unoszenie hantli bokiem", categoryId: "shoulders" },
  { id: "s-front-raise", name: "Unoszenie hantli przodem", categoryId: "shoulders" },
  { id: "s-rear-fly", name: "Odwrócone rozpiętki / ptaki", categoryId: "shoulders" },
  { id: "s-upright-row", name: "Podciąganie sztangi pod brodę", categoryId: "shoulders" },
  { id: "s-arhnold", name: "Arnoldki", categoryId: "shoulders" },
  // Biceps
  { id: "bi-barbell-curl", name: "Uginanie przedramion ze sztangą", categoryId: "biceps" },
  { id: "bi-db-curl", name: "Uginanie hantlami stojąc", categoryId: "biceps" },
  { id: "bi-hammer", name: "Uginanie młotkowe", categoryId: "biceps" },
  { id: "bi-preacher", name: "Uginanie na modlitewniku", categoryId: "biceps" },
  { id: "bi-cable-curl", name: "Uginanie na wyciągu dolnym", categoryId: "biceps" },
  { id: "bi-concentration", name: "Uginanie koncentracyjne", categoryId: "biceps" },
  // Triceps
  { id: "tr-pushdown", name: "Prostowanie na wyciągu (lina / drążek)", categoryId: "triceps" },
  { id: "tr-skull", name: "Prostowanie leżąc (francuskie)", categoryId: "triceps" },
  { id: "tr-overhead", name: "Prostowanie nad głowę z hantlem", categoryId: "triceps" },
  { id: "tr-dips", name: "Pompki na poręczach (triceps)", categoryId: "triceps" },
  { id: "tr-kickback", name: "Kickback z hantlem", categoryId: "triceps" },
  { id: "tr-close-grip", name: "Wąski wycisk na ławce", categoryId: "triceps" },
  // Przedramiona
  { id: "f-wrist-curl", name: "Uginanie nadgarstków podchwytem", categoryId: "forearms" },
  { id: "f-reverse-curl", name: "Uginanie nachwytem", categoryId: "forearms" },
  { id: "f-farmer", name: "Farmer walk", categoryId: "forearms" },
  // Core
  { id: "co-plank", name: "Deska (plank)", categoryId: "core" },
  { id: "co-dead-bug", name: "Dead bug", categoryId: "core" },
  { id: "co-crunch", name: "Spięcia brzucha", categoryId: "core" },
  { id: "co-leg-raise", name: "Unoszenie nóg w zwisie", categoryId: "core" },
  { id: "co-cable-crunch", name: "Spięcia brzucha na wyciągu", categoryId: "core" },
  { id: "co-russian", name: "Russian twist", categoryId: "core" },
  { id: "co-ab-wheel", name: "Koło do brzucha (ab wheel)", categoryId: "core" },
  // Uda przód
  { id: "q-squat", name: "Przysiad ze sztangą", categoryId: "quads" },
  { id: "q-front-squat", name: "Przysiad przedni", categoryId: "quads" },
  { id: "q-goblet", name: "Przysiad goblet", categoryId: "quads" },
  { id: "q-leg-press", name: "Wypychanie nogami na suwnicy", categoryId: "quads" },
  { id: "q-lunge", name: "Wykroki", categoryId: "quads" },
  { id: "q-bulgarian", name: "Wykroki bułgarskie", categoryId: "quads" },
  { id: "q-extension", name: "Prostowanie nóg na maszynie", categoryId: "quads" },
  // Pośladki
  { id: "g-hip-thrust", name: "Hip thrust", categoryId: "glutes" },
  { id: "g-bridge", name: "Mostek z hantlem", categoryId: "glutes" },
  { id: "g-kickback-cable", name: "Zakopy na wyciągu", categoryId: "glutes" },
  { id: "g-abduction", name: "Odwodzenie nóg (maszyna)", categoryId: "glutes" },
  // Uda tył
  { id: "h-leg-curl-lying", name: "Uginanie nóg leżąc", categoryId: "hamstrings" },
  { id: "h-leg-curl-seated", name: "Uginanie nóg siedząc", categoryId: "hamstrings" },
  { id: "h-nordic", name: "Nordic curl (jeśli dostępne)", categoryId: "hamstrings" },
  { id: "h-good-morning", name: "Dobry dzień", categoryId: "hamstrings" },
  // Łydki
  { id: "ca-standing", name: "Wspięcia na łydkach stojąc", categoryId: "calves" },
  { id: "ca-seated", name: "Wspięcia na łydkach siedząc", categoryId: "calves" },
  { id: "ca-donkey", name: "Wspięcia (donkey / maszyna)", categoryId: "calves" },
  // Cardio
  { id: "cd-treadmill", name: "Bieżnia", categoryId: "cardio" },
  { id: "cd-bike", name: "Rower stacjonarny", categoryId: "cardio" },
  { id: "cd-rower", name: "Wioślarz", categoryId: "cardio" },
  { id: "cd-elliptical", name: "Orbitrek", categoryId: "cardio" },
  { id: "cd-ski", name: "Ergometr narciarski", categoryId: "cardio" },
  { id: "cd-jump-rope", name: "Skakanka", categoryId: "cardio" },
];

export function categoryLabel(id: string): string {
  return MUSCLE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function exercisesForCategory(categoryId: string): CatalogExercise[] {
  return CATALOG_EXERCISES.filter((e) => e.categoryId === categoryId);
}
