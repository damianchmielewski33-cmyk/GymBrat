import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

describe("checkRateLimit (in-memory)", () => {
  it("allows under limit", () => {
    const k = `test:${Math.random()}`;
    expect(checkRateLimit(k, 3, 60_000).ok).toBe(true);
    expect(checkRateLimit(k, 3, 60_000).ok).toBe(true);
    expect(checkRateLimit(k, 3, 60_000).ok).toBe(true);
  });

  it("blocks when bucket full", () => {
    const k = `test:${Math.random()}`;
    expect(checkRateLimit(k, 2, 60_000).ok).toBe(true);
    expect(checkRateLimit(k, 2, 60_000).ok).toBe(true);
    const third = checkRateLimit(k, 2, 60_000);
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.retryAfterSec).toBeGreaterThan(0);
  });
});
