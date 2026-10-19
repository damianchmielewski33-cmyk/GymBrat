/**
 * Agregacja FCS członków → war score (średnia aktywnych).
 */

export function meanActiveFcs(scores: number[]): number {
  const active = scores.filter((s) => s > 0);
  if (active.length === 0) return 0;
  return active.reduce((a, b) => a + b, 0) / active.length;
}

export function decideWarWinner(
  scoreA: number,
  scoreB: number,
  regularityA = 0,
  regularityB = 0,
): "a" | "b" | "draw" {
  const eps = 0.05;
  if (Math.abs(scoreA - scoreB) < eps) {
    if (Math.abs(regularityA - regularityB) < 0.01) return "draw";
    return regularityA > regularityB ? "a" : "b";
  }
  return scoreA > scoreB ? "a" : "b";
}
