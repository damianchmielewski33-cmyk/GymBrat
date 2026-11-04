/** Z75: agregacja przychodów (czysta funkcja, strefa Europe/Warsaw). Kwoty w groszach. */

export type FinanceOrderRow = {
  status: string;
  amountGrosze: number;
  paidAt: Date | number | null;
};

export type RevenueBucket = {
  key: string;
  paidGrosze: number;
  paidCount: number;
  manualGrosze: number;
  manualCount: number;
  refundedGrosze: number;
  refundedCount: number;
};

const DAY_FMT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function warsawDayKey(ms: number): string {
  return DAY_FMT.format(new Date(ms));
}

function emptyBucket(key: string): RevenueBucket {
  return { key, paidGrosze: 0, paidCount: 0, manualGrosze: 0, manualCount: 0, refundedGrosze: 0, refundedCount: 0 };
}

function add(b: RevenueBucket, row: FinanceOrderRow) {
  if (row.status === "paid") {
    b.paidGrosze += row.amountGrosze;
    b.paidCount += 1;
  } else if (row.status === "manual") {
    b.manualGrosze += row.amountGrosze;
    b.manualCount += 1;
  } else if (row.status === "refunded") {
    b.refundedGrosze += row.amountGrosze;
    b.refundedCount += 1;
  }
}

/**
 * DK-20: przychód = zamówienia `paid`; `manual` (księgowane ręcznie) i `refunded` (zwroty)
 * pokazywane osobno. Dni: ostatnie `days` dni; miesiące: ostatnie `months` (klucz `RRRR-MM`).
 */
export function aggregateRevenue(
  rows: FinanceOrderRow[],
  now: number,
  opts: { days?: number; months?: number } = {},
): { daily: RevenueBucket[]; monthly: RevenueBucket[] } {
  const days = opts.days ?? 30;
  const months = opts.months ?? 12;
  const daily = new Map<string, RevenueBucket>();
  for (let i = days - 1; i >= 0; i--) {
    const key = warsawDayKey(now - i * 86_400_000);
    daily.set(key, emptyBucket(key));
  }
  const monthly = new Map<string, RevenueBucket>();
  const nowKey = warsawDayKey(now);
  let y = Number(nowKey.slice(0, 4));
  let m = Number(nowKey.slice(5, 7));
  const monthKeys: string[] = [];
  for (let i = 0; i < months; i++) {
    monthKeys.unshift(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  for (const k of monthKeys) monthly.set(k, emptyBucket(k));

  for (const row of rows) {
    if (row.paidAt == null) continue;
    const dayKey = warsawDayKey(new Date(row.paidAt).getTime());
    const d = daily.get(dayKey);
    if (d) add(d, row);
    const mo = monthly.get(dayKey.slice(0, 7));
    if (mo) add(mo, row);
  }
  return { daily: [...daily.values()], monthly: [...monthly.values()] };
}

/** Konwersja = zapłacone (`paid`) / utworzone zamówienia w okresie (DK-20). */
export function conversionRate(created: number, paid: number): number | null {
  return created > 0 ? paid / created : null;
}
