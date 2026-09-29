/** Jednostka porównań postępu (tonaż / objętość vs poprzedni trening planu). */
export type ProgressDeltaUnit = "percent" | "kg";

export const PROGRESS_DELTA_UNIT_STORAGE_KEY = "gymbrat:progressDeltaUnit";

export function parseProgressDeltaUnit(raw: unknown): ProgressDeltaUnit {
  return raw === "kg" ? "kg" : "percent";
}

export function writeProgressDeltaUnitLocal(unit: ProgressDeltaUnit) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROGRESS_DELTA_UNIT_STORAGE_KEY, unit);
  } catch {
    /* ignore */
  }
}

export function readProgressDeltaUnitLocal(
  fallback: ProgressDeltaUnit = "percent",
): ProgressDeltaUnit {
  if (typeof window === "undefined") return fallback;
  try {
    return parseProgressDeltaUnit(
      window.localStorage.getItem(PROGRESS_DELTA_UNIT_STORAGE_KEY),
    );
  } catch {
    return fallback;
  }
}

export function formatProgressDelta(opts: {
  unit: ProgressDeltaUnit;
  percent: number | null | undefined;
  absolute: number | null | undefined;
  /** Domyślnie kg — dla tonażu. */
  absoluteUnit?: string;
  digits?: number;
}): string | null {
  const { unit, percent, absolute, absoluteUnit = "kg", digits = 1 } = opts;
  if (unit === "kg") {
    if (absolute == null || !Number.isFinite(absolute)) return null;
    const r = Math.round(absolute * 10 ** digits) / 10 ** digits;
    const sign = r > 0 ? "+" : "";
    return `${sign}${r} ${absoluteUnit}`;
  }
  if (percent == null || !Number.isFinite(percent)) return null;
  const r = Math.round(percent * 10) / 10;
  return `${r > 0 ? "+" : ""}${r}%`;
}

export function progressDeltaTone(
  unit: ProgressDeltaUnit,
  percent: number | null | undefined,
  absolute: number | null | undefined,
): "up" | "down" | "flat" | "none" {
  const v = unit === "kg" ? absolute : percent;
  if (v == null || !Number.isFinite(v)) return "none";
  if (Math.abs(v) < 0.05) return "flat";
  return v > 0 ? "up" : "down";
}
