/**
 * Czyste funkcje scoringu Hall of Fame (testowalne bez DB).
 */

export function relativeProgressScore(
  volumeNow: number,
  volumePrev: number,
): number {
  if (volumeNow <= 0) return 0;
  if (volumePrev <= 0) return volumeNow > 0 ? 0.55 : 0;
  return (volumeNow - volumePrev) / volumePrev;
}

export function maxConsecutiveWeeks(sortedWeekStarts: string[]): number {
  if (sortedWeekStarts.length === 0) return 0;
  const unique = [...new Set(sortedWeekStarts)].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i++) {
    const prev = new Date(`${unique[i - 1]}T00:00:00Z`).getTime();
    const cur = new Date(`${unique[i]}T00:00:00Z`).getTime();
    const diffDays = Math.round((cur - prev) / 86_400_000);
    if (diffDays === 7) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

export function communityHeroScore(
  totalRp: number,
  distinctKinds: number,
): number {
  const diversity = distinctKinds >= 3 ? 1.15 : distinctKinds >= 2 ? 1.05 : 1;
  return Math.round(totalRp * diversity);
}

export function teamLegendScore(input: {
  teamScopedRp: number;
  liveJoins: number;
  challengeClaims: number;
  distinctTeams: number;
}): number {
  const multiTeam = input.distinctTeams >= 2 ? 1.2 : 1;
  return Math.round(
    (input.teamScopedRp +
      input.liveJoins * 12 +
      input.challengeClaims * 40) *
      multiTeam,
  );
}

export function formatProgressLabel(ratio: number): string {
  const pct = Math.round(ratio * 100);
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}% objętości`;
}

export function topN<T extends { score: number; userId: string }>(
  rows: T[],
  n = 3,
): T[] {
  return [...rows]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.userId.localeCompare(b.userId);
    })
    .slice(0, n)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
