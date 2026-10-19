import { describe, expect, it } from "vitest";

/** Mirror of parseFormNumber in meal-log.ts (not exported). */
function parseFormNumber(val: unknown): number {
  if (val === "" || val == null) return 0;
  if (typeof val === "number") return val;
  const t = String(val).trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return 0;
  return Number(t);
}

describe("meal log form numbers with commas", () => {
  it("accepts Polish decimal comma", () => {
    expect(parseFormNumber("12,5")).toBe(12.5);
    expect(parseFormNumber("0,3")).toBe(0.3);
    expect(parseFormNumber("100")).toBe(100);
  });

  it("treats empty as 0", () => {
    expect(parseFormNumber("")).toBe(0);
    expect(parseFormNumber(null)).toBe(0);
  });
});
