import { describe, expect, it } from "vitest";
import { dueSupplementSlots } from "@/lib/supplement-reminders";

const supps = [{ name: "Magnez", times: ["08:00", "20:00"] }, { name: "Chrom" }];
const prefs = { timezone: "UTC" };

describe("dueSupplementSlots", () => {
  it("nie przypomina przed upływem opóźnienia", () => {
    const r = dueSupplementSlots(supps, prefs, new Date("2026-11-08T08:10:00Z"));
    expect(r.slots).toEqual([]);
  });
  it("przypomina po opóźnieniu", () => {
    const r = dueSupplementSlots(supps, prefs, new Date("2026-11-08T08:20:00Z"));
    expect(r.slots.map((s) => s.slot)).toEqual(["08:00"]);
    expect(r.dateKey).toBe("2026-11-08");
  });
  it("nie przypomina po upłynięciu okna", () => {
    const r = dueSupplementSlots(supps, prefs, new Date("2026-11-08T10:00:00Z"));
    expect(r.slots).toEqual([]);
  });
});
