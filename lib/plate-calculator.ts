/** Standardowe talerze olympijskie (kg), malejąco — algorytm zachłanny na stronę. */
export const DEFAULT_PLATE_WEIGHTS_KG_DESC = [
  25, 20, 15, 10, 5, 2.5, 1.25,
] as const;

const EPS = 0.02;

export type PlateBreakdownSide = {
  /** Lista talerzy na jedną stronę sztangi (w kolejności nakładania). */
  plates: number[];
  /** Pozostała masa na stronę, której nie da się uzyskać dokładnie zestawem. */
  remainderKg: number;
  /** Suma talerzy na stronę. */
  sideTotalKg: number;
};

export type PlateBreakdownResult = {
  barKg: number;
  targetTotalKg: number;
  perSideTargetKg: number;
  left: PlateBreakdownSide;
  right: PlateBreakdownSide;
  /** Rzeczywista suma: sztanga + 2× strona (powinna ≈ target przy remainder≈0). */
  achievedTotalKg: number;
  exact: boolean;
};

/**
 * Oblicza rozkład talerzy na obie strony dla docelowego ciężaru całkowitego na sztandze.
 */
export function breakdownBarbellPlates(params: {
  targetTotalKg: number;
  barKg: number;
  plateWeightsKg?: readonly number[];
}): PlateBreakdownResult | null {
  const target = params.targetTotalKg;
  if (!Number.isFinite(target) || target <= 0) return null;
  const bar = params.barKg;
  if (!Number.isFinite(bar) || bar <= 0 || target <= bar) return null;

  const plateWeights = params.plateWeightsKg ?? DEFAULT_PLATE_WEIGHTS_KG_DESC;
  const sorted = [...plateWeights].sort((a, b) => b - a);

  const perSide = (target - bar) / 2;
  if (perSide <= EPS) return null;

  const oneSide = greedyPlatesForSide(perSide, sorted);

  const achievedSide = oneSide.sideTotalKg;
  const achievedTotal = bar + 2 * achievedSide;
  const exact = Math.abs(achievedTotal - target) < EPS && oneSide.remainderKg < EPS;

  return {
    barKg: bar,
    targetTotalKg: target,
    perSideTargetKg: perSide,
    left: oneSide,
    right: { ...oneSide, plates: [...oneSide.plates] },
    achievedTotalKg: achievedTotal,
    exact,
  };
}

function greedyPlatesForSide(
  targetSideKg: number,
  plateWeightsDesc: number[],
): PlateBreakdownSide {
  let left = targetSideKg;
  const plates: number[] = [];
  for (const w of plateWeightsDesc) {
    if (w <= 0) continue;
    while (left + EPS >= w) {
      plates.push(w);
      left -= w;
    }
  }
  const sideTotal = plates.reduce((a, b) => a + b, 0);
  return {
    plates,
    remainderKg: Math.max(0, left),
    sideTotalKg: sideTotal,
  };
}
