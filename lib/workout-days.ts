export type QueuedPlanLike = {
  lastWorkoutDate: string | null;
  updatedAt: string;
};

/** Następny dzień: najdawniej trenowany albo nigdy nie trenowany. */
export function pickQueuedPlan<T extends QueuedPlanLike>(plans: T[]): T | null {
  if (plans.length === 0) return null;
  const candidates = [...plans];
  candidates.sort((a, b) => {
    if (a.lastWorkoutDate && b.lastWorkoutDate) {
      return a.lastWorkoutDate.localeCompare(b.lastWorkoutDate);
    }
    if (!a.lastWorkoutDate && b.lastWorkoutDate) return -1;
    if (a.lastWorkoutDate && !b.lastWorkoutDate) return 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
  return candidates[0] ?? null;
}

export function formatExercisePreview(names: string[], max = 4): string {
  const trimmed = names.map((n) => n.trim()).filter(Boolean);
  if (trimmed.length === 0) return "Brak ćwiczeń";
  const shown = trimmed.slice(0, max);
  const extra = trimmed.length > max;
  return `${shown.join(" · ")}${extra ? " · …" : ""}`;
}

export function startWorkoutHref(planId: string): string {
  return `/start-workout?planId=${encodeURIComponent(planId)}&autostart=1`;
}

export function polishCwAbbreviation(n: number): string {
  return `${n} ćw.`;
}

export const FEATURED_PLAN_STORAGE_KEY = "gymbrat:featuredPlanId";
