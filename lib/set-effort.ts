/**
 * Wspólne progi wysiłku (RIR/RPE) dla Live Coach, chipów i double progression.
 *
 * - Gdy jest RIR — używamy wyłącznie RIR; RPE tylko jako fallback
 *   (przeliczany na „równoważny RIR” = 10 − RPE).
 * - „Łatwa” seria = zapas ≥ 2 powtórzeń (RIR ≥ 2 / RPE ≤ 8).
 * - „Twarda” i „na styk” zależą od docelowego RIR ruchu (profil z
 *   `movement-profiles`): RIR 0 na izolacji z celem RIR 0–1 to seria zgodna
 *   z planem, a nie sygnał do zdjęcia ciężaru.
 */

/** Zapas ≤ tej wartości = do upadku (twarda, gdy plan zakłada zapas). */
export const HARD_RIR = 0;
/** Zapas ≥ tej wartości = seria łatwa (wystarczający zapas do dokładki). */
export const EASY_RIR = 2;
/** Seria „na styk” (ostrzeżenie), gdy plan zakłada większy zapas. */
export const WARN_RIR = 1;

/** Odpowiedniki RPE (RPE = 10 − RIR). */
export const HARD_RPE = 10;
export const WARN_RPE = 9;
export const EASY_RPE = 8;

/**
 * Konflikt RIR/RPE — osobne, celowo szersze progi (nie zależą od EASY_*):
 * RIR „bardzo łatwo” + RPE „bardzo ciężko” (lub odwrotnie).
 */
const CONFLICT_RIR_EASY = 3;
const CONFLICT_RPE_HARD = 9;
const CONFLICT_RPE_EASY = 6;

/** Domyślny minimalny docelowy RIR, gdy nie znamy ruchu (zachowanie „legacy”). */
export const DEFAULT_TARGET_RIR_MIN = 2;

export type EffortSnapshot = {
  rir?: number | null;
  rpe?: number | null;
};

/** Kontekst ruchu: najmniejszy zapas, jaki plan uznaje za zgodny z celem. */
export type EffortContext = {
  targetRirMin?: number | null;
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
  if (rir >= CONFLICT_RIR_EASY && rpe >= CONFLICT_RPE_HARD) return true;
  // RIR „łatwo” (≥ EASY_RIR) przy RPE 10 (= zero zapasu) — rozjazd o 2 pkt;
  // bez tego seria z RIR 2 / RPE 10 odblokowałaby dokładkę.
  if (rir >= EASY_RIR && rpe >= HARD_RPE) return true;
  if (rir <= HARD_RIR && rpe > 0 && rpe <= CONFLICT_RPE_EASY) return true;
  return false;
}

/** Zapas w powtórzeniach: RIR, a gdy go brak — 10 − RPE. */
export function effectiveRir(snap: EffortSnapshot): number | null {
  const rir = finiteOrNull(snap.rir ?? null);
  if (rir != null) return rir;
  const rpe = finiteOrNull(snap.rpe ?? null);
  if (rpe != null && rpe > 0) return Math.max(0, 10 - rpe);
  return null;
}

/**
 * Klasyfikacja wysiłku. RIR ma pierwszeństwo nad RPE.
 *
 * @param ctx.targetRirMin najmniejszy docelowy zapas ruchu (0 = izolacja do
 *   upadku). Gdy 0 — seria do upadku nie jest „twarda” ani „na styk”.
 */
export function classifyEffort(
  snap: EffortSnapshot,
  ctx?: EffortContext,
): EffortClass {
  if (hasEffortConflict(snap)) return "conflict";

  const rir = effectiveRir(snap);
  if (rir == null) return "unknown";

  const targetMin =
    ctx?.targetRirMin != null && Number.isFinite(ctx.targetRirMin)
      ? Math.max(0, ctx.targetRirMin)
      : DEFAULT_TARGET_RIR_MIN;

  if (rir >= EASY_RIR) return "easy";
  if (rir <= HARD_RIR) return targetMin > HARD_RIR ? "hard" : "moderate";
  if (rir <= WARN_RIR) return targetMin > WARN_RIR ? "warn" : "moderate";
  return "moderate";
}

export function isHardEffort(snap: EffortSnapshot, ctx?: EffortContext): boolean {
  return classifyEffort(snap, ctx) === "hard";
}

export function isEasyEffort(snap: EffortSnapshot, ctx?: EffortContext): boolean {
  return classifyEffort(snap, ctx) === "easy";
}

export function isWarnEffort(snap: EffortSnapshot, ctx?: EffortContext): boolean {
  const c = classifyEffort(snap, ctx);
  return c === "warn" || c === "hard";
}
