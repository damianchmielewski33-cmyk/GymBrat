/** Domyślna lista suplementów (makieta DIETA), gdy brak w ustawieniach. */
export const DEFAULT_DIET_SUPPLEMENTS = [
  "Chrom",
  "Kompleks witamin",
  "Omega 3",
  "Magnez",
  "Witamina D",
  "Kreatyna",
] as const;

export type DietSupplement = {
  name: string;
  /** Dawka / ilość, np. „5 g”, „2000 IU”, „1 kaps.” */
  amount?: string;
  /** Godziny przyjęcia HH:mm (jedna na dawkę w ciągu dnia). Puste = jedno przyjęcie bez godziny. */
  times?: string[];
};

export const MAX_SUPPLEMENT_TIMES = 6;
const HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function normalizeSupplementTimes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = raw.filter(
    (t): t is string => typeof t === "string" && HM_RE.test(t),
  );
  return [...new Set(out)].sort().slice(0, MAX_SUPPLEMENT_TIMES);
}

/** Sloty przyjęć w ciągu dnia: godziny albo jeden slot "" (bez godziny). */
export function supplementSlots(s: DietSupplement): string[] {
  return s.times?.length ? s.times : [""];
}

export function intakeKey(name: string, slot: string): string {
  return `${name}|${slot}`;
}

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
        const o = item as {
          name?: unknown;
          amount?: unknown;
          dose?: unknown;
          times?: unknown;
        };
        const name = typeof o.name === "string" ? o.name.trim() : "";
        if (!name) continue;
        const amountRaw =
          typeof o.amount === "string"
            ? o.amount
            : typeof o.dose === "string"
              ? o.dose
              : "";
        const amount = amountRaw.trim();
        const times = normalizeSupplementTimes(o.times);
        out.push({
          name,
          ...(amount ? { amount } : {}),
          ...(times.length ? { times } : {}),
        });
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
