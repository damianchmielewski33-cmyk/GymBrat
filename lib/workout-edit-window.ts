import { calendarDateKey } from "@/lib/local-date";

/** Okno edycji ukończonego treningu (dni kalendarzowe wstecz włącznie z dniem sesji). */
export const WORKOUT_EDIT_WINDOW_DAYS = 7;

/**
 * Czy trening z datą `workoutDateYmd` (YYYY-MM-DD) wolno jeszcze edytować.
 * Porównanie względem „dziś” w lokalnej strefie (klucz kalendarza).
 */
export function isWorkoutEditable(workoutDateYmd: string, now = new Date()): boolean {
  const today = calendarDateKey(now);
  const start = parseYmd(workoutDateYmd);
  const end = parseYmd(today);
  if (start == null || end == null) return false;
  const diffDays = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return diffDays >= 0 && diffDays <= WORKOUT_EDIT_WINDOW_DAYS;
}

function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}
