/** Domyślna lista suplementów (makieta DIETA), gdy brak w ustawieniach. */
export const DEFAULT_DIET_SUPPLEMENTS = [
  "Chrom",
  "Kompleks witam",
  "Omega 3",
  "Magnez",
  "Witamina D",
  "Kreatyna",
] as const;

export function parseSupplementNames(
  raw: string | null | undefined,
): string[] | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return null;
    const obj = j as Record<string, unknown>;
    const list = obj.supplements ?? obj.suplementy;
    if (!Array.isArray(list)) return null;
    const names = list
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const name = (item as { name?: unknown }).name;
          return typeof name === "string" ? name.trim() : "";
        }
        return "";
      })
      .filter(Boolean);
    return names.length > 0 ? names : null;
  } catch {
    return null;
  }
}

export function resolveDietSupplements(
  ...sources: Array<string | null | undefined>
): string[] {
  for (const raw of sources) {
    const names = parseSupplementNames(raw);
    if (names?.length) return names;
  }
  return [...DEFAULT_DIET_SUPPLEMENTS];
}
