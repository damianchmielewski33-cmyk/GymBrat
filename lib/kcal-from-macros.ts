/** Parsuje pole makro z formularza (puste → 0, przecinek jako separator). */
export function parseMacroGrams(s: string): number {
  const t = s.trim().replace(",", ".");
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Energia z makro (Atwater): białko i węgle 4 kcal/g, tłuszcz 9 kcal/g.
 * Jedyna dozwolona definicja kcal w aplikacji — spójna z profilem i posiłkami.
 */
export function kcalFromMacros(
  proteinG: number,
  fatG: number,
  carbsG: number,
): number {
  return Math.round(proteinG * 4 + carbsG * 4 + fatG * 9);
}
