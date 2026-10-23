import { describe, expect, it } from "vitest";
import { dueReminders, localClock, parseHm } from "@/lib/reminders-schedule";

describe("reminders-schedule", () => {
  it("localClock liczy w strefie użytkownika (zima: Warszawa = UTC+1)", () => {
    const c = localClock(new Date("2026-01-15T17:30:00Z"), "Europe/Warsaw");
    expect(c.dateKey).toBe("2026-01-15");
    expect(c.minutes).toBe(18 * 60 + 30);
    expect(c.weekday).toBe(4); // czwartek
  });

  it("localClock przechodzi na następny dzień wg strefy", () => {
    const c = localClock(new Date("2026-01-15T23:30:00Z"), "Europe/Warsaw");
    expect(c.dateKey).toBe("2026-01-16");
    expect(c.minutes).toBe(30);
  });

  it("parseHm odrzuca śmieci", () => {
    expect(parseHm("18:05")).toBe(1085);
    expect(parseHm("25:00")).toBeNull();
    expect(parseHm("abc")).toBeNull();
    expect(parseHm(undefined)).toBeNull();
  });

  it("przypomnienie jest należne w oknie po godzinie, nie przed i nie po", () => {
    const prefs = { workoutTime: "18:00", timezone: "Europe/Warsaw" };
    const at = (iso: string) => dueReminders(prefs, new Date(iso)).kinds;
    expect(at("2026-01-15T16:55:00Z")).toEqual([]); // 17:55
    expect(at("2026-01-15T17:00:00Z")).toEqual(["workout"]); // 18:00
    expect(at("2026-01-15T17:15:00Z")).toEqual(["workout"]); // 18:15
    expect(at("2026-01-15T17:30:00Z")).toEqual([]); // 18:30 — po oknie
  });

  it("respektuje dni tygodnia", () => {
    // 2026-01-15 to czwartek (4); tylko pon–śr.
    const prefs = {
      workoutTime: "18:00",
      daysOfWeek: [1, 2, 3],
      timezone: "Europe/Warsaw",
    };
    expect(dueReminders(prefs, new Date("2026-01-15T17:00:00Z")).kinds).toEqual([]);
    expect(
      dueReminders({ ...prefs, daysOfWeek: [4] }, new Date("2026-01-15T17:00:00Z")).kinds,
    ).toEqual(["workout"]);
  });

  it("skrót e-mail jest należny po 7:00 czasu lokalnego, tylko gdy włączony", () => {
    const base = { timezone: "Europe/Warsaw" };
    expect(
      dueReminders({ ...base, emailDailyBrief: true }, new Date("2026-01-15T05:30:00Z")).emailDue,
    ).toBe(false); // 6:30
    expect(
      dueReminders({ ...base, emailDailyBrief: true }, new Date("2026-01-15T06:05:00Z")).emailDue,
    ).toBe(true); // 7:05
    expect(dueReminders(base, new Date("2026-01-15T10:00:00Z")).emailDue).toBe(false);
  });

  it("zła strefa wraca do domyślnej zamiast rzucać wyjątek", () => {
    expect(() =>
      dueReminders({ workoutTime: "18:00", timezone: "Nope/Nowhere" }, new Date()),
    ).not.toThrow();
  });
});
