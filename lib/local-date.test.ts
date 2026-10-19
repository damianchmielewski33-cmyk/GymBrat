import { describe, expect, it } from "vitest";
import { calendarDateKey } from "@/lib/local-date";

describe("calendarDateKey", () => {
  it("does not throw on Invalid Date", () => {
    expect(() => calendarDateKey(new Date(Number.NaN))).not.toThrow();
    expect(calendarDateKey(new Date(Number.NaN))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("formats a valid date", () => {
    const key = calendarDateKey(new Date("2026-03-15T12:00:00Z"));
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
