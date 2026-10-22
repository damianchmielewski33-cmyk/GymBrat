import { describe, expect, it } from "vitest";
import {
  canUseAnalytics,
  canUseMarketing,
  defaultConsentPreferences,
  parseConsentPreferences,
} from "@/lib/consent-preferences";

describe("consent-preferences", () => {
  it("parses stored preferences", () => {
    const raw = JSON.stringify({
      version: 1,
      decidedAt: "2026-10-22T10:00:00.000Z",
      analytics: true,
      marketing: false,
    });
    const p = parseConsentPreferences(raw);
    expect(p?.analytics).toBe(true);
    expect(p?.marketing).toBe(false);
    expect(canUseAnalytics(p)).toBe(true);
    expect(canUseMarketing(p)).toBe(false);
  });

  it("rejects invalid payloads", () => {
    expect(parseConsentPreferences("{}")).toBeNull();
    expect(parseConsentPreferences("nope")).toBeNull();
  });

  it("defaults optional categories to false", () => {
    const p = defaultConsentPreferences();
    expect(p.analytics).toBe(false);
    expect(p.marketing).toBe(false);
  });
});
