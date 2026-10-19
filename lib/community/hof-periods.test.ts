import { describe, expect, it } from "vitest";
import {
  gymbratSeasonKey,
  isoWeekKey,
  resolvePeriod,
} from "@/lib/community/hof-periods";

describe("hof-periods", () => {
  it("builds ISO week key", () => {
    expect(isoWeekKey("2026-10-19")).toMatch(/^2026-W\d{2}$/);
  });

  it("builds GymBrat season key", () => {
    expect(gymbratSeasonKey("2026-01-15")).toBe("2026-S1");
    expect(gymbratSeasonKey("2026-10-19")).toBe("2026-S4");
  });

  it("resolves month bounds", () => {
    const p = resolvePeriod("month", new Date("2026-10-19T12:00:00Z"));
    expect(p.key).toBe("2026-10");
    expect(p.kind).toBe("month");
  });

  it("all_time never closed", () => {
    const p = resolvePeriod("all_time");
    expect(p.key).toBe("all");
    expect(p.isClosed).toBe(false);
  });
});
