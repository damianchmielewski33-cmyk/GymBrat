import { describe, expect, it } from "vitest";
import {
  clampPercent,
  formatBytes,
  formatCount,
  latestSeriesValue,
  statusFromPercent,
  sumSeriesValues,
  toBytes,
} from "@/lib/monitoring/format";

describe("monitoring format", () => {
  it("clampPercent rounds to one decimal", () => {
    expect(clampPercent(350, 700)).toBe(50);
    expect(clampPercent(1, 3)).toBe(33.3);
    expect(clampPercent(10, 0)).toBe(0);
  });

  it("statusFromPercent thresholds", () => {
    expect(statusFromPercent(50)).toBe("ok");
    expect(statusFromPercent(80)).toBe("warn");
    expect(statusFromPercent(95)).toBe("critical");
  });

  it("formatBytes / formatCount", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatCount(1_500_000)).toBe("1.5 mln");
  });

  it("toBytes respects unit and assumeGbIfSmall", () => {
    expect(toBytes(2, "GB")).toBe(2 * 1024 ** 3);
    expect(toBytes(0.5, undefined, { assumeGbIfSmall: true })).toBe(
      0.5 * 1024 ** 3,
    );
    expect(toBytes(1000, undefined)).toBe(1000);
  });

  it("latestSeriesValue takes last finite point", () => {
    expect(
      latestSeriesValue([
        {
          unit: "bytes",
          values: [{ value: 1 }, { value: null }, { value: 9 }],
        },
      ]),
    ).toEqual({ value: 9, unit: "bytes" });
  });

  it("sumSeriesValues sums buckets", () => {
    expect(
      sumSeriesValues([
        { unit: "bytes", values: [{ value: 10 }, { value: 5 }] },
      ]),
    ).toEqual({ value: 15, unit: "bytes" });
  });
});
