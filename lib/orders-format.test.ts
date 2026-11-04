import { describe, expect, it } from "vitest";
import { formatPln, isFinalOrderStatus, orderStatusHint, orderStatusLabel } from "@/lib/orders-format";

describe("orders-format", () => {
  it("formatuje kwoty w PLN", () => {
    expect(formatPln(1999)).toBe("19,99 zł");
    expect(formatPln(-5)).toBe("0,00 zł");
  });
  it("etykiety i podpowiedzi nie ujawniają szczegółów wewnętrznych", () => {
    expect(orderStatusLabel("amount_mismatch")).toBe("W weryfikacji");
    expect(orderStatusHint("amount_mismatch")).not.toMatch(/kwot/i);
    expect(orderStatusLabel("nieznany")).toBe("nieznany");
  });
  it("tylko pending nie jest stanem końcowym", () => {
    expect(isFinalOrderStatus("pending")).toBe(false);
    expect(isFinalOrderStatus("paid")).toBe(true);
    expect(isFinalOrderStatus("failed")).toBe(true);
  });
});
