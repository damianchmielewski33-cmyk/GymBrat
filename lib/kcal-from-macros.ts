/** Parsuje pole makroskładnika z formularza (puste → 0, przecinek jako separator). */
export function parseMacroGrams(s: string): number {
  const t = s.trim().replace(",", ".");
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Energia z makroskładników (Atwater): białko i węgle 4 kcal/g, tłuszcz 9 kcal/g.
 * Jedyna dozwolona definicja kcal w aplikacji — spójna z profilem i posiłkami.
 */
export function kcalFromMacros(
  proteinG: number,
  fatG: number,
  carbsG: number,
): number {
  return Math.round(proteinG * 4 + carbsG * 4 + fatG * 9);
}

/**
 * ADR 0006 §4 — miękkie ostrzeżenie, gdy suma kcal posiłków
 * odbiega od celu dnia o więcej niż ten próg (nie blokuje zapisu).
 */
export const MEAL_SUM_TOLERANCE_PCT = 10;

/** Wspólny zakres wagi (profil + wpis ręczny) — ADR 0006 / U-12. */
export const WEIGHT_KG_MIN = 1;
export const WEIGHT_KG_MAX = 400;
