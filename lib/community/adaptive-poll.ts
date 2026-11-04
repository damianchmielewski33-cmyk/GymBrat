/**
 * Z79: adaptacyjny interwał pollingu. Gdy kolejne odpowiedzi są „puste/bez zmian”,
 * odstęp rośnie (×2) aż do `maxMs`; zmiana lub aktywność wraca do `baseMs`.
 */
export function nextPollDelay(
  baseMs: number,
  idleStreak: number,
  maxMs = baseMs * 4,
): number {
  if (idleStreak <= 0) return baseMs;
  return Math.min(maxMs, baseMs * 2 ** Math.min(idleStreak, 8));
}
