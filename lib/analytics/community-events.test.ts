import { describe, expect, it } from "vitest";
import {
  COMMUNITY_EVENT_PLAN,
  CommunityEvents,
} from "@/lib/analytics/community-events";

describe("community PostHog event plan", () => {
  it("używa snake_case i prefiksu community_", () => {
    for (const name of Object.values(CommunityEvents)) {
      expect(name).toMatch(/^community_[a-z0-9_]+$/);
    }
  });

  it("plan pokrywa wszystkie eventy z katalogu", () => {
    const planned = new Set(COMMUNITY_EVENT_PLAN.map((e) => e.event));
    for (const name of Object.values(CommunityEvents)) {
      expect(planned.has(name)).toBe(true);
    }
  });
});
