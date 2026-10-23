export const PROGRESS_TABS = [
  { id: "przeglad", label: "Przegląd" },
  { id: "sila", label: "Siła" },
  { id: "sylwetka", label: "Sylwetka" },
  { id: "tydzien", label: "Tygodnie" },
] as const;

export type ProgressTabId = (typeof PROGRESS_TABS)[number]["id"];

export const DEFAULT_PROGRESS_TAB: ProgressTabId = "przeglad";

export function parseProgressTab(
  raw: string | string[] | undefined | null,
): ProgressTabId {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "przeglad" || v === "sila" || v === "sylwetka" || v === "tydzien") {
    return v;
  }
  // Zdjęcia zostały włączone do zakładki Sylwetka — stare linki nadal działają.
  if (v === "zdjecia") return "sylwetka";
  return DEFAULT_PROGRESS_TAB;
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
