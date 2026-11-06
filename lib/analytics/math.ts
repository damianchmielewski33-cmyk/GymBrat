/** Pomocnicze formuły OLS / clamp dla silników analitycznych. */

export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

export function round0(n: number): number {
  return Math.round(n);
}

export function pctDelta(prev: number, next: number): number | null {
  if (!Number.isFinite(prev) || !Number.isFinite(next) || prev <= 0) return null;
  return round1(((next - prev) / prev) * 100);
}

export function mean(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Prosta regresja liniowa y = a + b*x. */
export function linearRegression(
  points: Array<{ x: number; y: number }>,
): { a: number; b: number; r2: number } | null {
  if (points.length < 2) return null;
  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXX += p.x * p.x;
    sumXY += p.x * p.y;
  }
  const den = n * sumXX - sumX * sumX;
  if (Math.abs(den) < 1e-9) return null;
  const b = (n * sumXY - sumX * sumY) / den;
  const a = (sumY - b * sumX) / n;
  const yMean = sumY / n;
  let ssTot = 0;
  let ssRes = 0;
  for (const p of points) {
    const pred = a + b * p.x;
    ssTot += (p.y - yMean) ** 2;
    ssRes += (p.y - pred) ** 2;
  }
  const r2 = ssTot > 1e-9 ? clamp(1 - ssRes / ssTot, 0, 1) : 0;
  return { a, b, r2 };
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function inWindow(
  date: string,
  endInclusive: string,
  lookbackDays: number,
): boolean {
  const end = new Date(`${endInclusive}T12:00:00`).getTime();
  const start = end - lookbackDays * 24 * 60 * 60 * 1000;
  const t = new Date(`${date}T12:00:00`).getTime();
  return Number.isFinite(t) && t >= start && t <= end;
}

/**
 * Ostatnie `days` dni kalendarzowych łącznie z `endInclusive`.
 * W odróżnieniu od `inWindow` początek jest wyłączony, więc „7 dni” to dokładnie 7 dat
 * (inWindow obejmuje oba końce, czyli 8 dat).
 */
export function inLastDays(
  date: string,
  endInclusive: string,
  days: number,
): boolean {
  const end = new Date(`${endInclusive}T12:00:00`).getTime();
  const start = end - days * 24 * 60 * 60 * 1000;
  const t = new Date(`${date}T12:00:00`).getTime();
  return Number.isFinite(t) && t > start && t <= end;
}

/** Liczba dni kalendarzowych od `fromIso` do `toIso` (może być ujemna). */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T12:00:00`).getTime();
  const b = new Date(`${toIso}T12:00:00`).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}
