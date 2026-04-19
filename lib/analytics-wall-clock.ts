/**
 * Godzina i data w strefie analityki z zapisanego UTC ISO.
 */

const DEFAULT_TZ = "Europe/Warsaw";

export function wallClockYmdHourFromUtcIso(
  iso: string,
  timeZone: string = process.env.ANALYTICS_TIMEZONE?.trim() || DEFAULT_TZ,
): { ymd: string; hour: number } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { ymd: "", hour: -1 };
  }
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(d);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const y = map.year ?? "";
  const mo = String(map.month ?? "").padStart(2, "0");
  const day = String(map.day ?? "").padStart(2, "0");
  let hour = Number.parseInt(String(map.hour ?? "0"), 10);
  if (!Number.isFinite(hour)) hour = 0;
  if (hour === 24) hour = 0;
  if (hour < 0 || hour > 23) hour = Math.max(0, Math.min(23, hour));
  return { ymd: `${y}-${mo}-${day}`, hour };
}
