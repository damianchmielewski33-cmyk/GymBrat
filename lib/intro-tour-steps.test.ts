import { describe, expect, it } from "vitest";
import { shouldShowIntroTour } from "@/lib/intro-tour-steps";

describe("shouldShowIntroTour", () => {
  it("hides when already completed", () => {
    expect(
      shouldShowIntroTour({
        introTourCompletedAt: new Date("2026-10-22T12:00:00"),
        accountCreatedAt: new Date("2026-10-22T12:00:00"),
      }),
    ).toBe(false);
  });

  it("hides for accounts created before the feature ship date", () => {
    expect(
      shouldShowIntroTour({
        introTourCompletedAt: null,
        accountCreatedAt: new Date("2026-10-01T12:00:00"),
      }),
    ).toBe(false);
  });

  it("shows for new accounts without completion", () => {
    expect(
      shouldShowIntroTour({
        introTourCompletedAt: null,
        accountCreatedAt: new Date("2026-10-22T18:00:00"),
      }),
    ).toBe(true);
  });
});
