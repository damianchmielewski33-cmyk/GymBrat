import { describe, expect, it } from "vitest";
import {
  calendarDateKey,
  calendarWeekMondayKey,
  daysBetweenDateKeys,
  parseDateKey,
  PL_MONTH_GENITIVE,
  weekDateKeysMondayFirst,
} from "@/lib/local-date";

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

describe("calendarWeekMondayKey", () => {
  it("poniedziałek → ten sam dzień", () => {
    expect(calendarWeekMondayKey("2026-10-19")).toBe("2026-10-19");
  });

  it("niedziela → poniedziałek tego samego tygodnia", () => {
    expect(calendarWeekMondayKey("2026-10-18")).toBe("2026-10-12");
  });

  it("przełom roku", () => {
    expect(calendarWeekMondayKey("2027-01-01")).toBe("2026-12-28");
    expect(calendarWeekMondayKey("2027-01-03")).toBe("2026-12-28");
    expect(calendarWeekMondayKey("2027-01-04")).toBe("2027-01-04");
  });

  it("zmiana czasu w marcu i październiku (Europe/Warsaw)", () => {
    expect(calendarWeekMondayKey("2026-03-29")).toBe("2026-03-23");
    expect(calendarWeekMondayKey("2026-03-30")).toBe("2026-03-30");
    expect(calendarWeekMondayKey("2026-10-25")).toBe("2026-10-19");
    expect(calendarWeekMondayKey("2026-10-26")).toBe("2026-10-26");
  });

  it("zgodny z pierwszym dniem weekDateKeysMondayFirst", () => {
    expect(weekDateKeysMondayFirst("2026-10-25")[0]).toBe(
      calendarWeekMondayKey("2026-10-25"),
    );
  });
});

describe("parseDateKey", () => {
  it("parses a valid key", () => {
    expect(parseDateKey("2026-10-24")).toEqual({ y: 2026, m: 10, d: 24 });
  });

  it("rejects bad format and out-of-range parts", () => {
    expect(parseDateKey("2026-1-24")).toBeNull();
    expect(parseDateKey("2026-13-01")).toBeNull();
    expect(parseDateKey("2026-10-32")).toBeNull();
    expect(parseDateKey("2026-10-24T12:00:00")).toBeNull();
  });
});

describe("daysBetweenDateKeys", () => {
  it("counts calendar days across DST and year boundaries", () => {
    expect(daysBetweenDateKeys("2026-10-24", "2026-10-26")).toBe(2);
    expect(daysBetweenDateKeys("2026-03-28", "2026-03-30")).toBe(2);
    expect(daysBetweenDateKeys("2025-12-31", "2026-01-01")).toBe(1);
    expect(daysBetweenDateKeys("2026-10-26", "2026-10-24")).toBe(-2);
  });

  it("returns 0 for an invalid key", () => {
    expect(daysBetweenDateKeys("bad", "2026-10-24")).toBe(0);
  });
});

describe("PL_MONTH_GENITIVE", () => {
  it("holds genitive month names starting with January", () => {
    expect(PL_MONTH_GENITIVE).toHaveLength(12);
    expect(PL_MONTH_GENITIVE[0]).toBe("stycznia");
    expect(PL_MONTH_GENITIVE[9]).toBe("października");
  });
});
