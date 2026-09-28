export type SessionSetLike = { done: boolean };
export type SessionExerciseLike = { id: string; name: string; sets: SessionSetLike[] };

export type SessionCursor = {
  exerciseIndex: number;
  setIndex: number;
};

export function findNextIncompleteSet<T extends SessionExerciseLike>(
  exercises: T[],
): SessionCursor | null {
  for (let exerciseIndex = 0; exerciseIndex < exercises.length; exerciseIndex++) {
    const sets = exercises[exerciseIndex]?.sets ?? [];
    for (let setIndex = 0; setIndex < sets.length; setIndex++) {
      if (!sets[setIndex]?.done) return { exerciseIndex, setIndex };
    }
  }
  return null;
}

export function findLastCompletedSet<T extends SessionExerciseLike>(
  exercises: T[],
): SessionCursor | null {
  for (let exerciseIndex = exercises.length - 1; exerciseIndex >= 0; exerciseIndex--) {
    const sets = exercises[exerciseIndex]?.sets ?? [];
    for (let setIndex = sets.length - 1; setIndex >= 0; setIndex--) {
      if (sets[setIndex]?.done) return { exerciseIndex, setIndex };
    }
  }
  return null;
}

export function countSessionSets<T extends SessionExerciseLike>(exercises: T[]): {
  done: number;
  total: number;
} {
  let done = 0;
  let total = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      total += 1;
      if (s.done) done += 1;
    }
  }
  return { done, total };
}

export function formatCompactClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function formatKgPl(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("pl-PL", {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(n) ? 0 : 1,
  });
}

export function formatSetScheme(setCount: number, targetReps: number | null | undefined): string {
  const reps =
    typeof targetReps === "number" && Number.isFinite(targetReps) && targetReps > 0
      ? Math.round(targetReps)
      : null;
  if (reps == null) return `${setCount}s`;
  return `${setCount}s ${reps}p`;
}
