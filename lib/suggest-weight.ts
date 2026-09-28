/**
 * Sugestia ciężaru na podstawie poprzedniej serii (progresja / regresja).
 * Bazuje na RIR (preferowane) albo RPE; bez tych danych — lekki +2.5% gdy seria
 * wygląda na komfortową (wiele powtórzeń przy solidnym ciężarze).
 */

export type SuggestWeightInput = {
  lastWeightKg: number;
  lastReps?: number | null;
  lastRir?: number | null;
  lastRpe?: number | null;
  /** Zaokrąglenie do płytki (domyślnie 2.5 kg). */
  plateKg?: number;
};

function roundToPlate(kg: number, plate: number): number {
  if (!(kg > 0) || !(plate > 0)) return 0;
  return Math.round(kg / plate) * plate;
}

/**
 * Zwraca sugerowany ciężar (kg) albo null gdy brak sensownej bazy.
 */
export function suggestNextWeightKg(input: SuggestWeightInput): number | null {
  const last = Number(input.lastWeightKg);
  if (!Number.isFinite(last) || last <= 0) return null;
  const plate = input.plateKg ?? 2.5;

  let factor = 1;
  const rir = input.lastRir;
  const rpe = input.lastRpe;

  if (rir != null && Number.isFinite(rir)) {
    if (rir >= 3) factor = 1.05;
    else if (rir >= 2) factor = 1.025;
    else if (rir <= 0) factor = 0.975;
    else factor = 1;
  } else if (rpe != null && Number.isFinite(rpe)) {
    if (rpe <= 6) factor = 1.05;
    else if (rpe <= 7) factor = 1.025;
    else if (rpe >= 9.5) factor = 0.975;
    else factor = 1;
  } else {
    const reps = input.lastReps;
    if (reps != null && reps >= 12 && last >= 20) factor = 1.025;
  }

  const next = roundToPlate(last * factor, plate);
  if (next <= 0) return roundToPlate(last, plate);
  return next;
}

/** Najcięższa ukończona seria z listy — baza pod sugestię. */
export function pickBestSetForSuggestion(
  sets: Array<{
    weight?: number | null;
    reps?: number | null;
    rir?: number | null;
    rpe?: number | null;
    done?: boolean;
  }>,
): SuggestWeightInput | null {
  let best: (typeof sets)[number] | null = null;
  let bestScore = -1;
  for (const s of sets) {
    const w = Number(s.weight ?? 0);
    const r = Number(s.reps ?? 0);
    if (!(w > 0) || !(r > 0)) continue;
    if (s.done === false) continue;
    const score = w * (1 + r / 30);
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  if (!best) return null;
  return {
    lastWeightKg: Number(best.weight),
    lastReps: best.reps != null ? Number(best.reps) : null,
    lastRir: best.rir != null ? Number(best.rir) : null,
    lastRpe: best.rpe != null ? Number(best.rpe) : null,
  };
}
