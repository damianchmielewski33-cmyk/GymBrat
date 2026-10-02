/** Minimalny kształt JSON w kolumnie workouts.exercises. */
export type WorkoutSessionJson = {
  kind?: string;
  title?: string;
  exercises?: unknown;
  avgHr?: number | null;
  heartRate?: number | null;
};

export function parseWorkoutSessionJson(raw: string): WorkoutSessionJson | null {
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    return o as WorkoutSessionJson;
  } catch {
    return null;
  }
}

/** Samodzielny wpis cardio (arkusz „Dodaj cardio”, bez siłowego). */
export function isStandaloneCardioLog(
  parsed: WorkoutSessionJson | null,
  cardioMinutes: number,
): boolean {
  if (parsed?.kind === "cardio_log") return true;
  return (
    cardioMinutes > 0 &&
    (!parsed?.exercises ||
      !Array.isArray(parsed.exercises) ||
      parsed.exercises.length === 0)
  );
}

/** Zaliczony trening siłowy (completed_session z ćwiczeniami). */
export function isCompletedStrengthSession(parsed: WorkoutSessionJson | null): boolean {
  if (!parsed) return false;
  if (parsed.kind === "cardio_log") return false;
  return Array.isArray(parsed.exercises) && parsed.exercises.length > 0;
}

/**
 * Minuty cardio do KPI / tygodniowego celu:
 * - cardio_log: pełna wartość kolumny,
 * - completed_session: tylko dodatek z popupu (cardioMinutes > 0), nie czas siłowego.
 */
export function countableCardioMinutes(
  parsed: WorkoutSessionJson | null,
  cardioMinutes: number,
): number {
  const minutes = Math.max(0, Math.round(Number(cardioMinutes) || 0));
  if (minutes <= 0) return 0;
  if (isStandaloneCardioLog(parsed, minutes)) return minutes;
  if (isCompletedStrengthSession(parsed)) return minutes;
  return 0;
}
