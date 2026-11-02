import { describe, expect, it } from "vitest";
import { isPackageCheckoutEnabled, showUnfinishedPages } from "@/lib/feature-flags";

describe("feature-flags", () => {
  it("checkout domyślnie wyłączony, włącza go tylko „1”", () => {
    expect(isPackageCheckoutEnabled({})).toBe(false);
    expect(isPackageCheckoutEnabled({ PREMIUM_CHECKOUT_ENABLED: "true" })).toBe(false);
    expect(isPackageCheckoutEnabled({ PREMIUM_CHECKOUT_ENABLED: " 1 " })).toBe(true);
  });
  it("niedokończone strony domyślnie ukryte", () => {
    expect(showUnfinishedPages("")).toBe(false);
    expect(showUnfinishedPages("1")).toBe(true);
  });
});
