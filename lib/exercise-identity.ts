import {
  CATALOG_EXERCISES,
  type CatalogExercise,
} from "@/lib/workout-exercise-catalog";

export type ExerciseIdentity = {
  /** Stabilny klucz agregacji (stats / trendy / PR). */
  key: string;
  /** Nazwa do UI — preferuje polską z katalogu. */
  displayName: string;
  catalogId: string | null;
};

const PL_FOLD: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
};

/**
 * Składa klucz porównawczy: bez diakrytyków/polskich znaków, interpunkcji
 * i wahań wielkości liter. „Bench Press”, „bench-press”, „ławce”/„lawce” → to samo.
 */
export function foldExerciseText(raw: string): string {
  return String(raw ?? "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (ch) => PL_FOLD[ch] ?? ch)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function buildCatalogIndex(): Map<string, CatalogExercise> {
  const map = new Map<string, CatalogExercise>();
  for (const ex of CATALOG_EXERCISES) {
    const nameKey = foldExerciseText(ex.name);
    if (nameKey && !map.has(nameKey)) map.set(nameKey, ex);
    for (const alias of ex.aliasesEn ?? []) {
      const aKey = foldExerciseText(alias);
      if (aKey && !map.has(aKey)) map.set(aKey, ex);
    }
  }
  return map;
}

const CATALOG_BY_FOLD = buildCatalogIndex();

/**
 * Rozwiązuje wariant nazwy do jednej tożsamości.
 * Trafienie w katalog (nazwa PL lub alias EN) → wspólny klucz `catalog:<id>`.
 * Poza katalogiem → klucz ze złożonego tekstu (i tak scala spacje/wielkość/diakrytyki).
 */
export function resolveExerciseIdentity(rawName: string): ExerciseIdentity {
  const trimmed = String(rawName ?? "").trim().replace(/\s+/g, " ");
  const folded = foldExerciseText(trimmed);
  if (!folded) {
    return { key: "", displayName: "", catalogId: null };
  }

  const hit = CATALOG_BY_FOLD.get(folded);
  if (hit) {
    return {
      key: `catalog:${hit.id}`,
      displayName: hit.name,
      catalogId: hit.id,
    };
  }

  return {
    key: `name:${folded}`,
    displayName: trimmed,
    catalogId: null,
  };
}

/** Czy dwie nazwy to to samo ćwiczenie pod kątem statystyk. */
export function isSameExercise(a: string, b: string): boolean {
  const ka = resolveExerciseIdentity(a).key;
  const kb = resolveExerciseIdentity(b).key;
  return Boolean(ka && kb && ka === kb);
}
