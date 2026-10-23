/** Wspólne formattery ekranów Postępy (wcześniej kopiowane w każdej zakładce). */

export function formatDayMonth(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(`${iso}T12:00:00`));
  } catch {
    return iso;
  }
}

export function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pl-PL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** „+1,2 kg” / „−0,4 kg” / „—”. */
export function fmtSigned(
  n: number | null | undefined,
  suffix = "",
  digits = 1,
): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${fmtNum(Math.abs(n), digits)}${suffix}`;
}

/** Zmiana procentowa z polskim przecinkiem: „+3,2%”. */
export function fmtPct(n: number | null | undefined): string {
  return fmtSigned(n, "%", 1);
}

/** Polska odmiana liczebnika: 1 trening, 2 treningi, 5 treningów. */
export function plural(n: number, one: string, few: string, many: string) {
  const abs = Math.abs(n);
  if (abs === 1) return one;
  const last = abs % 10;
  const lastTwo = abs % 100;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return few;
  return many;
}
