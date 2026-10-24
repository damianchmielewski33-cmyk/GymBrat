import { describe, expect, it } from "vitest";
import { formatClockMmSs } from "@/lib/progress-format";

describe("formatClockMmSs", () => {
  it("formatuje m:ss", () => {
    expect(formatClockMmSs(0)).toBe("0:00");
    expect(formatClockMmSs(9)).toBe("0:09");
    expect(formatClockMmSs(90)).toBe("1:30");
    expect(formatClockMmSs(3599)).toBe("59:59");
    expect(formatClockMmSs(3725)).toBe("62:05");
  });

  it("ułamki w dół, ujemne i nieliczby -> 0:00", () => {
    expect(formatClockMmSs(59.9)).toBe("0:59");
    expect(formatClockMmSs(-15)).toBe("0:00");
    expect(formatClockMmSs(Number.NaN)).toBe("0:00");
  });
});
