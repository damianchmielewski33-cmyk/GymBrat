import type { MeterStatus } from "@/lib/monitoring/types";

export function clampPercent(used: number, limit: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return 0;
  return Math.round((used / limit) * 1000) / 10;
}

export function statusFromPercent(percent: number): MeterStatus {
  if (percent >= 95) return "critical";
  if (percent >= 80) return "warn";
  return "ok";
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${round1(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${round1(mb)} MB`;
  return `${round1(mb / 1024)} GB`;
}

export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000_000) return `${round1(n / 1_000_000_000)} mld`;
  if (n >= 1_000_000) return `${round1(n / 1_000_000)} mln`;
  if (n >= 1_000) return `${round1(n / 1_000)} tys.`;
  return String(Math.round(n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

type SeriesRow = {
  unit?: string;
  values?: { value?: number | null }[];
};

/** Przelicza wartość metryki Render na bajty (gdy unit to GB/MB/…). */
export function toBytes(
  value: number,
  unit?: string,
  opts?: { assumeGbIfSmall?: boolean },
): number {
  const u = (unit ?? "").trim().toLowerCase();
  if (u === "gb" || u === "gib") return value * 1024 ** 3;
  if (u === "mb" || u === "mib") return value * 1024 ** 2;
  if (u === "kb" || u === "kib") return value * 1024;
  if (u === "b" || u === "byte" || u === "bytes") return value;
  // Pamięć/limit bez unit: małe liczby (< 256) to zwykle GB instancji.
  if (opts?.assumeGbIfSmall && value > 0 && value < 256) {
    return value * 1024 ** 3;
  }
  return value;
}

/** Ostatnia niepusta wartość z serii Render Metrics (z unit serii). */
export function latestSeriesValue(
  series: SeriesRow[] | null | undefined,
): { value: number; unit?: string } | null {
  if (!Array.isArray(series) || series.length === 0) return null;
  for (const s of series) {
    const vals = s.values;
    if (!Array.isArray(vals) || vals.length === 0) continue;
    for (let i = vals.length - 1; i >= 0; i--) {
      const v = vals[i]?.value;
      if (typeof v === "number" && Number.isFinite(v)) {
        return { value: v, unit: s.unit };
      }
    }
  }
  return null;
}

/** Suma wartości w serii (np. bandwidth w oknie miesiąca). */
export function sumSeriesValues(
  series: SeriesRow[] | null | undefined,
): { value: number; unit?: string } | null {
  if (!Array.isArray(series) || series.length === 0) return null;
  let sum = 0;
  let any = false;
  let unit: string | undefined;
  for (const s of series) {
    const vals = s.values;
    if (!Array.isArray(vals)) continue;
    if (s.unit) unit = s.unit;
    for (const point of vals) {
      const v = point?.value;
      if (typeof v === "number" && Number.isFinite(v)) {
        sum += v;
        any = true;
      }
    }
  }
  return any ? { value: sum, unit } : null;
}
