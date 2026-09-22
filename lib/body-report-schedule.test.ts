import { describe, expect, it } from "vitest";
import {
  BODY_REPORT_INTERVAL_DAYS,
  calendarDaysBetween,
  formatDaysUntilLabel,
  getNextBodyReportCountdown,
} from "@/lib/body-report-schedule";

describe("calendarDaysBetween", () => {
  it("liczy różnicę dni", () => {
    expect(calendarDaysBetween("2026-09-15", "2026-09-22")).toBe(7);
    expect(calendarDaysBetween("2026-09-22", "2026-09-15")).toBe(-7);
  });
});

describe("formatDaysUntilLabel", () => {
  it("używa formy dzień / dni", () => {
    expect(formatDaysUntilLabel(1)).toBe("dzień");
    expect(formatDaysUntilLabel(0)).toBe("dni");
    expect(formatDaysUntilLabel(2)).toBe("dni");
    expect(formatDaysUntilLabel(5)).toBe("dni");
  });
});

describe("getNextBodyReportCountdown", () => {
  it("bez raportu — termin dziś", () => {
    const r = getNextBodyReportCountdown(null, { todayKey: "2026-09-22" });
    expect(r).toEqual({
      daysUntil: 0,
      isDue: true,
      lastReportDateKey: null,
      nextReportDateKey: null,
    });
  });

  it("odlicza dni do ostatni+7", () => {
    const r = getNextBodyReportCountdown(new Date("2026-09-15T15:00:00+02:00"), {
      todayKey: "2026-09-20",
      intervalDays: BODY_REPORT_INTERVAL_DAYS,
    });
    expect(r.lastReportDateKey).toBe("2026-09-15");
    expect(r.nextReportDateKey).toBe("2026-09-22");
    expect(r.daysUntil).toBe(2);
    expect(r.isDue).toBe(false);
  });

  it("w dniu terminu daysUntil=0", () => {
    const r = getNextBodyReportCountdown(new Date("2026-09-15T12:00:00Z"), {
      todayKey: "2026-09-22",
    });
    expect(r.daysUntil).toBe(0);
    expect(r.isDue).toBe(true);
  });

  it("po terminie nadal 0 (zaległy)", () => {
    const r = getNextBodyReportCountdown(new Date("2026-09-15T12:00:00Z"), {
      todayKey: "2026-09-25",
    });
    expect(r.daysUntil).toBe(0);
    expect(r.isDue).toBe(true);
  });
});
