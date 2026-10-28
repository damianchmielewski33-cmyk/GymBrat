import { describe, expect, it } from "vitest";
import { hashWeek, mondayOf, weekBounds } from "@/lib/community/week";

describe("community week bounds (pon–nd)", () => {
  it("mondayOf returns Monday for mid-week", () => {
    expect(mondayOf("2026-10-28")).toBe("2026-10-26"); // środa → pon
  });

  it("weekBounds covers 7 days Mon–Sun", () => {
    const b = weekBounds("2026-10-28");
    expect(b.weekStart).toBe("2026-10-26");
    expect(b.weekEnd).toBe("2026-11-01");
    expect(b.days).toHaveLength(7);
    expect(b.days[0]).toBe(b.weekStart);
    expect(b.days[6]).toBe(b.weekEnd);
  });

  it("hashWeek is deterministic", () => {
    expect(hashWeek("team-a", "2026-10-26")).toBe(
      hashWeek("team-a", "2026-10-26"),
    );
    expect(hashWeek("team-a", "2026-10-26")).not.toBe(
      hashWeek("team-b", "2026-10-26"),
    );
  });
});
