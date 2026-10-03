/**
 * Pure helpers for volume math (reps × weight). Safe against NaN/Infinity.
 * Tonaż i sumy powtórzeń liczą tylko serie naprawdę wykonane (done, nie skipped).
 */

export type VolumeSetInput = {
  reps: number | null;
  weight: number;
  done?: boolean;
  skipped?: boolean;
};

export function safeNonNegative(n: number, fallback = 0): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, n);
}

/**
 * Czy seria wchodzi do tonażu / sum powtórzeń.
 * - `skipped` → nigdy
 * - `done === false` → nie
 * - `done === true` → tak
 * - brak obu flag (legacy surowe liczby) → tak
 */
export function isCountedPerformedSet(s: VolumeSetInput): boolean {
  if (Boolean(s.skipped)) return false;
  if (s.done === false) return false;
  if (s.done === true) return true;
  // Legacy: ani done, ani skipped nie podano.
  return s.done === undefined && s.skipped === undefined;
}

/** Volume for a single set (Strong / Hevy style: reps × weight). */
export function setVolume(reps: number | null, weight: number): number {
  return safeNonNegative(reps ?? 0) * safeNonNegative(weight);
}

/** Czy seria ma obciążenie do tonażu (kg × reps). */
export function isCountedVolumeSet(s: VolumeSetInput): boolean {
  if (!isCountedPerformedSet(s)) return false;
  const reps = s.reps;
  const weight = safeNonNegative(s.weight);
  return reps != null && Number.isFinite(reps) && reps > 0 && weight > 0;
}

export function exerciseVolume(sets: ReadonlyArray<VolumeSetInput>): number {
  let sum = 0;
  for (const s of sets) {
    if (!isCountedVolumeSet(s)) continue;
    sum += setVolume(s.reps, s.weight);
  }
  return sum;
}

/** Suma powtórzeń w zaliczonych (niepominiętych) seriach. */
export function exerciseTotalReps(sets: ReadonlyArray<VolumeSetInput>): number {
  let sum = 0;
  for (const s of sets) {
    if (!isCountedPerformedSet(s)) continue;
    const reps = s.reps;
    if (reps == null || !(reps > 0)) continue;
    sum += safeNonNegative(reps);
  }
  return sum;
}

export function sessionVolume(
  exercises: ReadonlyArray<{
    sets: ReadonlyArray<VolumeSetInput>;
  }>,
): number {
  let sum = 0;
  for (const ex of exercises) {
    sum += exerciseVolume(ex.sets);
  }
  return sum;
}

/** Liczba naprawdę wykonanych serii (done, nie skipped, z powtórzeniami). */
export function countPerformedSets(
  exercises: ReadonlyArray<{
    sets: ReadonlyArray<VolumeSetInput>;
  }>,
): number {
  let n = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (!isCountedPerformedSet(s)) continue;
      if (s.reps == null || !(s.reps > 0)) continue;
      n += 1;
    }
  }
  return n;
}

export function formatVolumeKg(value: number): string {
  return new Intl.NumberFormat("pl-PL", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(safeNonNegative(value));
}

export type BestSetRow = {
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  e1rm: number;
  /** weighted = e1RM; bodyweight = max powtórzeń przy 0 kg. */
  kind: "weighted" | "bodyweight";
};

/**
 * Najlepsza seria na ćwiczenie:
 * - z obciążeniem → najwyższy e1RM (Epley),
 * - bez obciążenia → najwięcej powtórzeń (masa ciała).
 */
export function bestSetsFromSession(
  exercises: ReadonlyArray<{
    id: string;
    name: string;
    sets: ReadonlyArray<{
      reps: number | null;
      weight: number;
      done: boolean;
      skipped?: boolean;
    }>;
  }>,
  estimated1RM: (weight: number, reps: number) => number,
): BestSetRow[] {
  const rows: BestSetRow[] = [];
  for (const ex of exercises) {
    let bestWeighted: BestSetRow | null = null;
    let bestBodyweight: BestSetRow | null = null;
    for (const s of ex.sets) {
      if (!isCountedPerformedSet(s)) continue;
      const reps = s.reps;
      if (reps == null || !(reps > 0)) continue;
      if (s.weight > 0) {
        const e1rm = estimated1RM(s.weight, reps);
        if (!bestWeighted || e1rm > bestWeighted.e1rm) {
          bestWeighted = {
            exerciseId: ex.id,
            exerciseName: ex.name,
            weight: s.weight,
            reps,
            e1rm: Math.round(e1rm),
            kind: "weighted",
          };
        }
      } else if (!bestBodyweight || reps > bestBodyweight.reps) {
        bestBodyweight = {
          exerciseId: ex.id,
          exerciseName: ex.name,
          weight: 0,
          reps,
          e1rm: 0,
          kind: "bodyweight",
        };
      }
    }
    if (bestWeighted) rows.push(bestWeighted);
    else if (bestBodyweight) rows.push(bestBodyweight);
  }
  return rows;
}
