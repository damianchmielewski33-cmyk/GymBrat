import { describe, expect, it } from "vitest";
import { aggregateRevenue, conversionRate, warsawDayKey } from "@/lib/finance";

const NOW = Date.parse("2026-11-02T10:00:00Z");

describe("finance (Z75)", () => {
  it("grupuje przychód dzienny i miesięczny, manual i refunded osobno", () => {
    const rows = [
      { status: "paid", amountGrosze: 1999, paidAt: NOW },
      { status: "paid", amountGrosze: 899, paidAt: NOW - 86_400_000 },
      { status: "manual", amountGrosze: 399, paidAt: NOW },
      { status: "refunded", amountGrosze: 2499, paidAt: NOW },
      { status: "paid", amountGrosze: 7999, paidAt: Date.parse("2026-09-15T10:00:00Z") },
    ];
    const { daily, monthly } = aggregateRevenue(rows, NOW);
    expect(daily).toHaveLength(30);
    const today = daily[daily.length - 1]!;
    expect(today.key).toBe(warsawDayKey(NOW));
    expect(today).toMatchObject({ paidGrosze: 1999, manualGrosze: 399, refundedGrosze: 2499 });
    expect(monthly).toHaveLength(12);
    expect(monthly[monthly.length - 1]).toMatchObject({ key: "2026-11", paidGrosze: 1999 + 0 });
    expect(monthly.find((m) => m.key === "2026-09")!.paidGrosze).toBe(7999);
  });

  it("pomija wiersze bez paidAt i spoza okna", () => {
    const { daily } = aggregateRevenue(
      [
        { status: "paid", amountGrosze: 1, paidAt: null },
        { status: "paid", amountGrosze: 5, paidAt: NOW - 40 * 86_400_000 },
      ],
      NOW,
    );
    expect(daily.reduce((a, d) => a + d.paidGrosze, 0)).toBe(0);
  });

  it("konwersja = zapłacone / utworzone; brak zamówień → null", () => {
    expect(conversionRate(10, 3)).toBeCloseTo(0.3);
    expect(conversionRate(0, 0)).toBeNull();
  });
});
