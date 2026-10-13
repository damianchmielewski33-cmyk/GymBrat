/**
 * Wspólne progi wysiłku (RIR/RPE) dla Live Coach, chipów i double progression.
 * Gdy jest RIR — używamy wyłącznie RIR; RPE tylko jako fallback.
 */

export const HARD_RIR = 0;
export const HARD_RPE = 9;
export const EASY_RIR = 3;
export const EASY_RPE = 6;
/** Seria „na styk” (ostrzeżenie) — kilka z rzędu z RIR=1. */
export const WARN_RIR = 1;
export const WARN_RPE = 8;

export type EffortSnapshot = {
  rir?: number | null;
  rpe?: number | null;
};

export type EffortClass =
  | "hard"
  | "easy"
  | "moderate"
  | "warn"
  | "conflict"
  | "unknown";

function finiteOrNull(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return n;
}

/**
 * Konflikt: RIR mówi „łatwo”, a RPE „bardzo ciężko” (lub odwrotnie).
 * Wtedy bezpieczny hold — nie ufamy danym.
 */
export function hasEffortConflict(snap: EffortSnapshot): boolean {
  const rir = finiteOrNull(snap.rir ?? null);
  const rpe = finiteOrNull(snap.rpe ?? null);
  if (rir == null || rpe == null || rpe <= 0) return false;
  if (rir >= EASY_RIR && rpe >= HARD_RPE) return true;
  if (rir <= HARD_RIR && rpe > 0 && rpe <= EASY_RPE) return true;
  return false;
}

/**
 * Klasyfikacja wysiłku. RIR ma pierwszeństwo nad RPE.
 */
export function classifyEffort(snap: EffortSnapshot): EffortClass {
  if (hasEffortConflict(snap)) return "conflict";

  const rir = finiteOrNull(snap.rir ?? null);
  if (rir != null) {
    if (rir <= HARD_RIR) return "hard";
    if (rir >= EASY_RIR) return "easy";
    if (rir === WARN_RIR) return "warn";
    return "moderate";
  }

  const rpe = finiteOrNull(snap.rpe ?? null);
  if (rpe != null && rpe > 0) {
    if (rpe >= HARD_RPE) return "hard";
    if (rpe <= EASY_RPE) return "easy";
    if (rpe >= WARN_RPE) return "warn";
    return "moderate";
  }

  return "unknown";
}

export function isHardEffort(snap: EffortSnapshot): boolean {
  return classifyEffort(snap) === "hard";
}

export function isEasyEffort(snap: EffortSnapshot): boolean {
  return classifyEffort(snap) === "easy";
}

export function isWarnEffort(snap: EffortSnapshot): boolean {
  const c = classifyEffort(snap);
  return c === "warn" || c === "hard";
}
