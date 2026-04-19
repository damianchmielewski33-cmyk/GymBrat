/**
 * Granice UTC dla zakresu [fromYmd, toYmd] jako dni kalendarzowe w strefie (np. Europe/Warsaw).
 */

const DEFAULT_TZ = "Europe/Warsaw";

function zonedYmd(utcMs: number, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const y = map.year ?? "";
  const mo = String(map.month ?? "").padStart(2, "0");
  const day = String(map.day ?? "").padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/** Przesuwa `YYYY-MM-DD` o `delta` dni kalendarzowych. */
export function addCalendarDaysYmd(ymd: string, delta: number): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Bieżący dzień kalendarzowy w strefie (spójnie z `input type="date"`). */
export function nowLocalYmd(
  timeZone: string = process.env.ANALYTICS_TIMEZONE?.trim() || DEFAULT_TZ,
): string {
  return zonedYmd(Date.now(), timeZone);
}

/** Wszystkie dni od `fromYmd` do `toYmd` włącznie. */
export function listLocalYmdsInclusive(fromYmd: string, toYmd: string): string[] {
  const out: string[] = [];
  let cur = fromYmd;
  while (cur <= toYmd) {
    out.push(cur);
    cur = addCalendarDaysYmd(cur, 1);
  }
  return out;
}

/** Pierwsza milisekunda dnia `ymd` w `timeZone`. */
export function startOfLocalDayUtcIso(
  ymd: string,
  timeZone: string = DEFAULT_TZ,
): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  const anchor = Date.UTC(y, mo - 1, d, 12, 0, 0, 0);
  const lo = anchor - 36 * 3600000;
  const hi = anchor + 36 * 3600000;
  let best = -1;
  for (let t = lo; t <= hi; t += 60_000) {
    if (zonedYmd(t, timeZone) === ymd) {
      best = t;
      break;
    }
  }
  if (best < 0) {
    throw new Error(`Nie znaleziono początku dnia dla ${ymd} w ${timeZone}`);
  }
  return new Date(best).toISOString();
}

/** Ostatnia milisekunda dnia `ymd` w `timeZone`. */
export function endOfLocalDayUtcIso(
  ymd: string,
  timeZone: string = DEFAULT_TZ,
): string {
  const next = addCalendarDaysYmd(ymd, 1);
  const nextStart = Date.parse(startOfLocalDayUtcIso(next, timeZone));
  return new Date(nextStart - 1).toISOString();
}

export function localYmdInclusiveUtcRange(
  fromYmd: string,
  toYmd: string,
  timeZone: string = process.env.ANALYTICS_TIMEZONE?.trim() || DEFAULT_TZ,
): { fromIso: string; toIso: string } {
  return {
    fromIso: startOfLocalDayUtcIso(fromYmd, timeZone),
    toIso: endOfLocalDayUtcIso(toYmd, timeZone),
  };
}
