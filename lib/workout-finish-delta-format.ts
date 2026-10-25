import type { ProgressDeltaUnit } from "@/lib/progress-delta-unit";

/**
 * Formatowanie delty WYŁĄCZNIE dla ekranu „Trening zakończony” (005, przegląd ux
 * 21.3 W-4): przecinek dziesiętny i prawdziwy minus (U+2212) w stylu pl-PL, zamiast
 * ASCII `.`/`-` ze współdzielonego `formatProgressDelta` (lib/progress-delta-unit.ts).
 * Współdzielonej funkcji NIE zmieniamy w tym zadaniu — używają jej inne ekrany
 * (historia treningu, zdjęcia postępu); zmianę współdzielonej funkcji zgłaszamy do
 * backlogu systemowego (ux, 21.3).
 */
export const MINUS_SIGN_PL = "−";

export function formatProgressDeltaPl(opts: {
  unit: ProgressDeltaUnit;
  percent: number | null | undefined;
  absolute: number | null | undefined;
  /** Domyślnie kg — dla tonażu. */
  absoluteUnit?: string;
  digits?: number;
}): string | null {
  const { unit, percent, absolute, absoluteUnit = "kg", digits = 1 } = opts;

  function withSign(rounded: number, formatted: string, unitSuffix: string): string {
    if (rounded > 0) return `+${formatted}${unitSuffix}`;
    if (rounded < 0) return `${MINUS_SIGN_PL}${formatted}${unitSuffix}`;
    return `${formatted}${unitSuffix}`;
  }

  if (unit === "kg") {
    if (absolute == null || !Number.isFinite(absolute)) return null;
    const r = Math.round(absolute * 10 ** digits) / 10 ** digits;
    const formatted = new Intl.NumberFormat("pl-PL", {
      maximumFractionDigits: digits,
    }).format(Math.abs(r));
    return withSign(r, formatted, ` ${absoluteUnit}`);
  }

  if (percent == null || !Number.isFinite(percent)) return null;
  const r = Math.round(percent * 10) / 10;
  const formatted = new Intl.NumberFormat("pl-PL", {
    maximumFractionDigits: 1,
  }).format(Math.abs(r));
  return withSign(r, formatted, "%");
}
