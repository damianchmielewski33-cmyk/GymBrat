export const PROGRESS_TABS = [
  { id: "sila", label: "Siła" },
  { id: "sylwetka", label: "Sylwetka" },
  { id: "zdjecia", label: "Zdjęcia" },
  { id: "tydzien", label: "Tydzień" },
] as const;

export type ProgressTabId = (typeof PROGRESS_TABS)[number]["id"];

export function parseProgressTab(
  raw: string | string[] | undefined | null,
): ProgressTabId {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "sylwetka" || v === "zdjecia" || v === "tydzien" || v === "sila") {
    return v;
  }
  return "sila";
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
