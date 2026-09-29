import { describe, expect, it } from "vitest";
import {
  formatProgressDelta,
  parseProgressDeltaUnit,
  progressDeltaTone,
} from "@/lib/progress-delta-unit";

describe("progress-delta-unit", () => {
  it("parsowanie", () => {
    expect(parseProgressDeltaUnit("kg")).toBe("kg");
    expect(parseProgressDeltaUnit("percent")).toBe("percent");
    expect(parseProgressDeltaUnit("x")).toBe("percent");
  });

  it("format % vs kg", () => {
    expect(
      formatProgressDelta({ unit: "percent", percent: 8.25, absolute: 120 }),
    ).toBe("+8.3%");
    expect(
      formatProgressDelta({ unit: "kg", percent: 8.25, absolute: 120 }),
    ).toBe("+120 kg");
    expect(
      formatProgressDelta({ unit: "kg", percent: -5, absolute: -40.4 }),
    ).toBe("-40.4 kg");
  });

  it("tone", () => {
    expect(progressDeltaTone("percent", 2, 10)).toBe("up");
    expect(progressDeltaTone("kg", -1, -20)).toBe("down");
    expect(progressDeltaTone("percent", 0, 0)).toBe("flat");
  });
});
