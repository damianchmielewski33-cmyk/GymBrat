/**
 * Pure helpers for volume math (reps × weight). Safe against NaN/Infinity.
 */

export function safeNonNegative(n: number, fallback = 0): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, n);
}

/** Volume for a single set (Strong / Hevy style: reps × weight). */
export function setVolume(reps: number, weight: number): number {
  return safeNonNegative(reps) * safeNonNegative(weight);
}

export function exerciseVolume(
  sets: ReadonlyArray<{ reps: number; weight: number }>,
): number {
  let sum = 0;
  for (const s of sets) {
    sum += setVolume(s.reps, s.weight);
  }
  return sum;
}

/** Suma powtórzeń we wszystkich seriach ćwiczenia. */
export function exerciseTotalReps(sets: ReadonlyArray<{ reps: number }>): number {
  let sum = 0;
  for (const s of sets) {
    sum += safeNonNegative(s.reps);
  }
  return sum;
}

export function sessionVolume(
  exercises: ReadonlyArray<{ sets: ReadonlyArray<{ reps: number; weight: number }> }>,
): number {
  let sum = 0;
  for (const ex of exercises) {
    sum += exerciseVolume(ex.sets);
  }
  return sum;
}

export function formatVolumeKg(value: number): string {
  return new Intl.NumberFormat("pl-PL", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(safeNonNegative(value));
}
