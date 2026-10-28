import { describe, expect, it } from "vitest";
import { formatCurrentWeightLabel } from "@/lib/current-weight-format";

describe("formatCurrentWeightLabel", () => {
  it("pokazuje tylko kg gdy data to dziś", () => {
    const label = formatCurrentWeightLabel(
      { weightKg: 82.4, recordedAt: new Date("2026-10-28T10:00:00") },
      "2026-10-28",
    );
    expect(label).toBe("82,4 kg");
  });

  it("dokłada datę gdy wpis starszy niż wczoraj", () => {
    const label = formatCurrentWeightLabel(
      { weightKg: 80, recordedAt: new Date("2026-10-20T10:00:00") },
      "2026-10-28",
    );
    expect(label).toContain("80");
    expect(label).toContain("20.10.2026");
  });

  it("pusta waga → —", () => {
    expect(formatCurrentWeightLabel(null, "2026-10-28")).toBe("—");
  });
});
