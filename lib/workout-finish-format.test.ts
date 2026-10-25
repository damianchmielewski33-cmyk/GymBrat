import { describe, expect, it } from "vitest";
import {
  formatCountPl,
  formatDistanceKmPl,
  formatTonnagePl,
  formatWeightRecordLine,
  formatWorkoutDurationPl,
} from "@/lib/workout-finish-format";

describe("workout-finish-format", () => {
  it("formatuje czas jak w makiecie", () => {
    expect(formatWorkoutDurationPl(65 * 60)).toBe("1 h 5 min");
    expect(formatWorkoutDurationPl(45 * 60)).toBe("45 min");
  });

  it("formatuje tonaż PL", () => {
    expect(formatTonnagePl(8004)).toBe("8004 kg");
  });

  it("formatuje linię rekordu z jednostką przy obu wartościach (005, przegląd ux 21.3 W-3)", () => {
    expect(formatWeightRecordLine(36, 40)).toBe("36 kg → 40 kg");
    expect(formatWeightRecordLine(38.5, 40)).toBe("38,5 kg → 40 kg");
  });

  it("formatCountPl grupuje tysiące odstępem, nawet dla liczb 4-cyfrowych (005, przegląd ux 19.3)", () => {
    expect(formatCountPl(4500)).toBe(`4 500`);
    expect(formatCountPl(12)).toBe("12");
    expect(formatCountPl(10000)).toBe(`10 000`);
  });

  it("formatDistanceKmPl używa przecinka dziesiętnego (005, przegląd ux 19.3)", () => {
    expect(formatDistanceKmPl(3.2)).toBe("3,2");
    expect(formatDistanceKmPl(5)).toBe("5");
  });
});
