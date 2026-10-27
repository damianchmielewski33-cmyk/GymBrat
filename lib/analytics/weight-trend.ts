export type WeightTrendPoint = { date: string; kg: number };

/** Least-squares weight slope in kg/week; fewer than three distinct days is insufficient. */
export function computeWeightTrendKgPerWeek(points: readonly WeightTrendPoint[]): number | null {
  const valid = points.filter((point) => Number.isFinite(point.kg) && point.kg > 0)
    .slice().sort((a, b) => a.date.localeCompare(b.date));
  if (new Set(valid.map((point) => point.date)).size < 3) return null;
  const origin = Date.parse(`${valid[0]!.date}T12:00:00Z`);
  const xs = valid.map((point) => (Date.parse(`${point.date}T12:00:00Z`) - origin) / 86_400_000);
  if ((xs.at(-1) ?? 0) < 14) return null;
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = valid.reduce((sum, point) => sum + point.kg, 0) / valid.length;
  const denominator = xs.reduce((sum, value) => sum + (value - meanX) ** 2, 0);
  if (denominator <= 0) return null;
  const slope = xs.reduce((sum, value, index) => sum + (value - meanX) * (valid[index]!.kg - meanY), 0) / denominator;
  return Math.round(slope * 70) / 10;
}
