import type { ExerciseProgressPoint } from "@/lib/exercise-progress";

export type ForecastPoint = {
  date: string;
  projectedE1rm: number;
  /** true = punkt poza historią (projekcja) */
  projected: boolean;
};

/**
 * Prosta regresja liniowa e1RM względem indeksu sesji → projekcja na `horizonDays`.
 */
export function projectE1rmForecast(
  points: ExerciseProgressPoint[],
  horizonDays = 28,
): {
  slopePerDay: number | null;
  forecast: ForecastPoint[];
  in28Days: number | null;
} {
  if (points.length < 3) {
    return { slopePerDay: null, forecast: [], in28Days: null };
  }

  const xs: number[] = [];
  const ys: number[] = [];
  const t0 = Date.parse(`${points[0]!.date}T12:00:00`);
  for (const p of points) {
    const t = Date.parse(`${p.date}T12:00:00`);
    if (!Number.isFinite(t) || !(p.bestE1rm > 0)) continue;
    xs.push((t - t0) / 86_400_000);
    ys.push(p.bestE1rm);
  }
  if (xs.length < 3) {
    return { slopePerDay: null, forecast: [], in28Days: null };
  }

  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - meanX) * (ys[i]! - meanY);
    den += (xs[i]! - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;

  const last = points[points.length - 1]!;
  const lastX = (Date.parse(`${last.date}T12:00:00`) - t0) / 86_400_000;
  const forecast: ForecastPoint[] = points.map((p) => ({
    date: p.date,
    projectedE1rm: Math.round(p.bestE1rm * 10) / 10,
    projected: false,
  }));

  const step = Math.max(7, Math.round(horizonDays / 4));
  for (let d = step; d <= horizonDays; d += step) {
    const x = lastX + d;
    const y = Math.max(0, intercept + slope * x);
    const date = new Date(Date.parse(`${last.date}T12:00:00`) + d * 86_400_000)
      .toISOString()
      .slice(0, 10);
    forecast.push({
      date,
      projectedE1rm: Math.round(y * 10) / 10,
      projected: true,
    });
  }

  const in28 = Math.max(0, intercept + slope * (lastX + 28));
  return {
    slopePerDay: Math.round(slope * 1000) / 1000,
    forecast,
    in28Days: Math.round(in28 * 10) / 10,
  };
}
