const MIN_DAYS = 3;
const MAX_DAYS = 90;
export const DEFAULT_REPORT_CADENCE_DAYS = 14;

export function clampReportCadenceDays(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_REPORT_CADENCE_DAYS;
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(n)));
}
