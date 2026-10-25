import { describe, expect, it } from "vitest";
import {
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

  it("formatuje linię rekordu", () => {
    expect(formatWeightRecordLine(36, 40)).toBe("36 → 40 kg");
    expect(formatWeightRecordLine(38.5, 40)).toBe("38,5 → 40 kg");
  });
});
