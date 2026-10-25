import { describe, expect, it } from "vitest";
import { formatProgressDeltaPl } from "@/lib/workout-finish-delta-format";

/**
 * 005, przegląd ux 21.3 W-4: ekran końcowy musi pokazywać deltę w stylu pl-PL
 * (przecinek dziesiętny, prawdziwy minus U+2212), w przeciwieństwie do współdzielonego
 * `formatProgressDelta` (ASCII `.`/`-`), którego ten test NIE dotyka.
 */
describe("formatProgressDeltaPl (005, W-4)", () => {
  it("procent dodatni: plus i przecinek dziesiętny", () => {
    expect(formatProgressDeltaPl({ unit: "percent", percent: 4.2, absolute: null })).toBe(
      "+4,2%",
    );
  });

  it("procent ujemny: prawdziwy minus (U+2212), nie ASCII '-'", () => {
    const result = formatProgressDeltaPl({ unit: "percent", percent: -3.1, absolute: null });
    expect(result).toBe("−3,1%");
    expect(result).not.toContain("-3,1%");
  });

  it("procent zero: bez znaku", () => {
    expect(formatProgressDeltaPl({ unit: "percent", percent: 0, absolute: null })).toBe("0%");
  });

  it("kg dodatnie i ujemne: jednostka po liczbie, przecinek dziesiętny", () => {
    expect(formatProgressDeltaPl({ unit: "kg", percent: null, absolute: 12.5 })).toBe(
      "+12,5 kg",
    );
    expect(formatProgressDeltaPl({ unit: "kg", percent: null, absolute: -8 })).toBe(
      "−8 kg",
    );
  });

  it("null/niefinite -> null", () => {
    expect(formatProgressDeltaPl({ unit: "percent", percent: null, absolute: null })).toBeNull();
    expect(
      formatProgressDeltaPl({ unit: "kg", percent: null, absolute: Number.NaN }),
    ).toBeNull();
  });
});
