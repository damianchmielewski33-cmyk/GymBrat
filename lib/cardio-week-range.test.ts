import { describe, expect, it } from "vitest";
import {
  cardioGoalPercent,
  parseCardioWeekMode,
  resolveCardioWeekRange,
  sumCardioInRange,
} from "@/lib/cardio-week-range";
import { sumCardioCaloriesWeek } from "@/lib/analytics/cardio-calories";

// 2026-11-04 to środa → tydzień pon 2026-11-02 … niedz 2026-11-08.
const TODAY = "2026-11-04";

function cardioLog(date: string, minutes: number) {
  return {
    date,
    cardioMinutes: minutes,
    exercises: JSON.stringify({ kind: "cardio_log", title: "Bieg", cardioMinutes: minutes }),
  };
}

describe("resolveCardioWeekRange", () => {
  it("calendar = poniedziałek–niedziela", () => {
    expect(resolveCardioWeekRange(TODAY, "calendar")).toEqual({
      mode: "calendar",
      from: "2026-11-02",
      to: "2026-11-08",
    });
  });

  it("niedziela należy do tygodnia kończącego się w tę niedzielę", () => {
    expect(resolveCardioWeekRange("2026-11-08").from).toBe("2026-11-02");
    expect(resolveCardioWeekRange("2026-11-09").from).toBe("2026-11-09");
  });

  it("rolling = 7 dni włącznie z dziś", () => {
    expect(resolveCardioWeekRange(TODAY, "rolling")).toEqual({
      mode: "rolling",
      from: "2026-10-29",
      to: TODAY,
    });
  });

  it("nieznany tryb wraca do calendar", () => {
    expect(parseCardioWeekMode("x")).toBe("calendar");
    expect(parseCardioWeekMode(undefined)).toBe("calendar");
    expect(parseCardioWeekMode("rolling")).toBe("rolling");
  });
});

describe("kontrakt: te same minuty cardio na Pulpicie, w Treningu i w Analizie (Z35/Z38)", () => {
  const range = resolveCardioWeekRange(TODAY, "calendar");

  it("20 min w tygodniu = 20 min (także gdy użytkownik nie ma planu)", () => {
    const rows = [cardioLog("2026-11-03", 20), cardioLog("2026-10-30", 45)];
    expect(sumCardioInRange(range, rows)).toEqual({ minutes: 20, sessions: 1 });
  });

  it("legacy training_sessions liczy się według strefy kalendarza, nie serwera", () => {
    // 2026-11-01 23:30 UTC = 2026-11-02 00:30 w Europe/Warsaw → poniedziałek (w tygodniu).
    const legacy = [{ startedAt: new Date("2026-11-01T23:30:00Z"), cardioMinutes: 15 }];
    expect(sumCardioInRange(range, [], legacy).minutes).toBe(15);
    // 2026-11-08 23:30 UTC = 2026-11-09 00:30 w Warszawie → następny tydzień.
    const next = [{ startedAt: new Date("2026-11-08T23:30:00Z"), cardioMinutes: 15 }];
    expect(sumCardioInRange(range, [], next).minutes).toBe(0);
  });

  it("workouts + legacy sumują się razem", () => {
    const legacy = [{ startedAt: new Date("2026-11-04T10:00:00Z"), cardioMinutes: 10 }];
    expect(sumCardioInRange(range, [cardioLog("2026-11-03", 20)], legacy)).toEqual({
      minutes: 30,
      sessions: 2,
    });
  });

  it("tryb rolling obejmuje ostatnie 7 dni, także z poprzedniego tygodnia", () => {
    const rolling = resolveCardioWeekRange(TODAY, "rolling");
    const rows = [cardioLog("2026-10-30", 45), cardioLog("2026-10-28", 99)];
    expect(sumCardioInRange(rolling, rows).minutes).toBe(45);
  });

  it("procent celu", () => {
    expect(cardioGoalPercent(75, 150)).toBe(50);
    expect(cardioGoalPercent(300, 150)).toBe(100);
    expect(cardioGoalPercent(10, 0)).toBe(0);
  });

  it("kcal w Analizie używają tego samego zakresu tygodnia", () => {
    const samples = [
      { date: "2026-11-03", minutes: 20, calories: 200, avgHr: null },
      { date: "2026-11-01", minutes: 30, calories: 300, avgHr: null },
    ] as never[];
    const base = { samples, today: TODAY, weightKg: 80, ageYears: 30, sex: null };
    expect(sumCardioCaloriesWeek({ ...base, range })).toBe(200);
  });
});
