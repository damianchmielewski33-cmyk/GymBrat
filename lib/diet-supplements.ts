/** Domyślna lista suplementów (makieta DIETA), gdy brak w ustawieniach. */
export const DEFAULT_DIET_SUPPLEMENTS = [
  "Chrom",
  "Kompleks witam",
  "Omega 3",
  "Magnez",
  "Witamina D",
  "Kreatyna",
] as const;

export type DietSupplement = {
  name: string;
  /** Dawka / ilość, np. „5 g”, „2000 IU”, „1 kaps.” */
  amount?: string;
};

export function parseDietSupplements(
  raw: string | null | undefined,
): DietSupplement[] | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return null;
    const obj = j as Record<string, unknown>;
    const list = obj.supplements ?? obj.suplementy;
    if (!Array.isArray(list)) return null;
    const out: DietSupplement[] = [];
    for (const item of list) {
      if (typeof item === "string") {
        const name = item.trim();
        if (name) out.push({ name });
        continue;
      }
      if (item && typeof item === "object") {
        const o = item as { name?: unknown; amount?: unknown; dose?: unknown };
        const name = typeof o.name === "string" ? o.name.trim() : "";
        if (!name) continue;
        const amountRaw =
          typeof o.amount === "string"
            ? o.amount
            : typeof o.dose === "string"
              ? o.dose
              : "";
        const amount = amountRaw.trim();
        out.push(amount ? { name, amount } : { name });
      }
    }
    // Pusta tablica = świadomie wyczyszczona lista (bez fallbacku do domyślnych).
    return out.slice(0, 40);
  } catch {
    return null;
  }
}

/** @deprecated użyj parseDietSupplements — zostawione dla kompatybilności. */
export function parseSupplementNames(
  raw: string | null | undefined,
): string[] | null {
  const list = parseDietSupplements(raw);
  if (!list?.length) return null;
  return list.map((s) => s.name);
}

export function resolveDietSupplements(
  ...sources: Array<string | null | undefined>
): string[] {
  return resolveDietSupplementItems(...sources).map((s) => s.name);
}

export function resolveDietSupplementItems(
  ...sources: Array<string | null | undefined>
): DietSupplement[] {
  for (const raw of sources) {
    const list = parseDietSupplements(raw);
    if (list !== null) return list;
  }
  return DEFAULT_DIET_SUPPLEMENTS.map((name) => ({ name }));
}

/** Pierwsze źródło z kluczem supplements / suplementy, albo `null` gdy brak. */
export function parseFirstDietSupplements(
  ...sources: Array<string | null | undefined>
): DietSupplement[] | null {
  for (const raw of sources) {
    const list = parseDietSupplements(raw);
    if (list !== null) return list;
  }
  return null;
}

export function formatSupplementLine(s: DietSupplement): string {
  return s.amount?.trim() ? `${s.name} · ${s.amount.trim()}` : s.name;
}
