/**
 * Strefa dla „dzisiaj” i kalendarza żywienia — ta sama na serwerze i w przeglądarce
 * (ustaw CALENDAR_TIMEZONE + NEXT_PUBLIC_CALENDAR_TIMEZONE, np. Europe/Warsaw).
 */
export function getCalendarTimezone(): string {
  return (
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_CALENDAR_TIMEZONE ??
        process.env.CALENDAR_TIMEZONE)) ||
    "Europe/Warsaw"
  );
}

/**
 * YYYY-MM-DD wg kalendarza w `getCalendarTimezone()` — używaj dla żywienia / Start,
 * żeby ten sam dzień co wpisy posiłków i oznaczenia dni w profilu (serwer UTC ≠ Polska).
 */
export function calendarDateKey(d: Date = new Date()): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    return localDateKey(new Date());
  }
  const tz = getCalendarTimezone();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) {
    return localDateKey(d);
  }
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD w strefie procesu Node/przeglądarki (np. treningi zapisane „lokalnie”). */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Nazwy miesięcy w dopełniaczu („20 października”), indeks 0 = styczeń. */
export const PL_MONTH_GENITIVE = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
] as const;

/** Rok, miesiąc (1–12) i dzień klucza YYYY-MM-DD. */
export type DateKeyParts = { y: number; m: number; d: number };

/** Ścisłe parsowanie YYYY-MM-DD; `null` przy złym formacie lub zakresie miesiąca/dnia. */
export function parseDateKey(key: string): DateKeyParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

/**
 * Różnica dni kalendarzowych `toKey − fromKey` (YYYY-MM-DD), niezależna od strefy i DST.
 * Przy niepoprawnym kluczu zwraca 0.
 */
export function daysBetweenDateKeys(fromKey: string, toKey: string): number {
  const a = parseDateKey(fromKey);
  const b = parseDateKey(toKey);
  if (!a || !b) return 0;
  const t0 = Date.UTC(a.y, a.m - 1, a.d);
  const t1 = Date.UTC(b.y, b.m - 1, b.d);
  return Math.round((t1 - t0) / 86_400_000);
}

/** Dodaje `deltaDays` do YYYY-MM-DD w sensie kalendarza obywatelskiego (niezależnie od strefy). */
export function addCalendarDays(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = x.getUTCFullYear();
  const mm = String(x.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(x.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Dzień tygodnia dla `dateKey` w strefie kalendarza (`getCalendarTimezone()`),
 * w konwencji jak Date.getDay(): 0=niedziela … 6=sobota.
 */
export function calendarWeekdaySun0(dateKey: string): number {
  const tz = getCalendarTimezone();
  const noon = utcInstantNearNoonForCalendarDate(dateKey);
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(noon);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[label] ?? 0;
}

function utcInstantNearNoonForCalendarDate(dateKey: string): Date {
  const tz = getCalendarTimezone();
  const [y0, m0, d0] = dateKey.split("-").map(Number);
  const coarse = Date.UTC(y0, m0 - 1, d0, 0, 0, 0);
  for (let h = -48; h <= 48; h++) {
    const d = new Date(coarse + h * 3600000);
    if (calendarDateKey(d) !== dateKey) continue;
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(d);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? -1);
    if (hour === 12) return d;
  }
  for (let h = -48; h <= 48; h++) {
    const d = new Date(coarse + h * 3600000);
    if (calendarDateKey(d) === dateKey) return d;
  }
  return new Date(Date.UTC(y0, m0 - 1, d0, 12, 0, 0));
}

/** Poniedziałek (YYYY-MM-DD) tygodnia kalendarzowego zawierającego `dateKey`. */
export function calendarWeekMondayKey(dateKey: string): string {
  const dow = calendarWeekdaySun0(dateKey);
  return addCalendarDays(dateKey, dow === 0 ? -6 : 1 - dow);
}

/**
 * Poniedziałek–niedziela tygodnia zawierającego `anchorDateKey`,
 * w kalendarzu `getCalendarTimezone()` — spójnie z wpisami posiłków i `calendarDateKey`.
 */
export function weekDateKeysMondayFirst(anchorDateKey: string): string[] {
  const mondayKey = calendarWeekMondayKey(anchorDateKey);
  const keys: string[] = [];
  for (let i = 0; i < 7; i++) {
    keys.push(addCalendarDays(mondayKey, i));
  }
  return keys;
}

/** Etykieta zakresu „7–13 kwietnia 2026” / „28 kwietnia 2026 – 4 maja 2026” (kalendarz PL). */
export function formatPlCalendarRange(weekStart: string, weekEnd: string): string {
  const parse = (k: string) => {
    const [y, m, d] = k.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  };
  const a = parse(weekStart);
  const b = parse(weekEnd);
  const sameMonthYear =
    a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

  const dayNum = (dt: Date) =>
    new Intl.DateTimeFormat("pl-PL", { day: "numeric" }).format(dt);
  const monthYear = (dt: Date) =>
    new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(dt);
  const full = (dt: Date) =>
    new Intl.DateTimeFormat("pl-PL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(dt);

  if (sameMonthYear) {
    return `${dayNum(a)}–${dayNum(b)} ${monthYear(a)}`;
  }
  return `${full(a)} – ${full(b)}`;
}
