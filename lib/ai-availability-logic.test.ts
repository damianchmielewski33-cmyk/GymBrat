import { describe, expect, it } from "vitest";
import { computeAiEnabledForUser } from "@/lib/ai-availability-logic";

describe("computeAiEnabledForUser", () => {
  it("is false when model not configured", () => {
    expect(
      computeAiEnabledForUser({
        isConfigured: false,
        globalDisabled: false,
        entitled: true,
        userDisabled: false,
      }),
    ).toBe(false);
  });

  it("is false when globally disabled", () => {
    expect(
      computeAiEnabledForUser({
        isConfigured: true,
        globalDisabled: true,
        entitled: true,
        userDisabled: false,
      }),
    ).toBe(false);
  });

  it("is true when all gates pass", () => {
    expect(
      computeAiEnabledForUser({
        isConfigured: true,
        globalDisabled: false,
        entitled: true,
        userDisabled: false,
      }),
    ).toBe(true);
  });
});
