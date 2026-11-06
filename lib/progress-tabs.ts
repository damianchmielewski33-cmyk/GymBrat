export const PROGRESS_TABS = [
  { id: "podsumowanie", label: "Podsumowanie" },
  { id: "sila", label: "Siła" },
  { id: "cialo", label: "Ciało" },
  { id: "regularnosc", label: "Regularność" },
  { id: "porownanie", label: "Porównanie" },
] as const;

export type ProgressTabId = (typeof PROGRESS_TABS)[number]["id"];

export const DEFAULT_PROGRESS_TAB: ProgressTabId = "podsumowanie";

/** Zakres danych ładowany z serwera (loadery w `lib/progress-metrics`). */
export type ProgressDataScope = "przeglad" | "sila" | "sylwetka" | "tydzien";

/** Które zestawy danych potrzebuje dana zakładka. */
export const TAB_DATA_SCOPES: Record<ProgressTabId, readonly ProgressDataScope[]> = {
  podsumowanie: ["przeglad"],
  sila: ["sila"],
  cialo: ["sylwetka"],
  regularnosc: ["tydzien"],
  porownanie: ["tydzien", "sila"],
};

/** Stare nazwy zakładek (linki, zakładki przeglądarki) kierują do nowych. */
const LEGACY_TAB_IDS: Record<string, ProgressTabId> = {
  przeglad: "podsumowanie",
  sylwetka: "cialo",
  zdjecia: "cialo",
  tydzien: "regularnosc",
  tygodnie: "regularnosc",
};

export function parseProgressTab(
  raw: string | string[] | undefined | null,
): ProgressTabId {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return DEFAULT_PROGRESS_TAB;
  if (PROGRESS_TABS.some((t) => t.id === v)) return v as ProgressTabId;
  return LEGACY_TAB_IDS[v] ?? DEFAULT_PROGRESS_TAB;
}

export function exerciseProgressKey(name: string): string {
  return encodeURIComponent(name.trim());
}

export function decodeExerciseProgressKey(key: string): string {
  try {
    return decodeURIComponent(key).trim();
  } catch {
    return key.trim();
  }
}
