import { describe, expect, it } from "vitest";
import { createPushDedupe, payloadFingerprint } from "@/lib/active-workout-push-dedupe";

describe("createPushDedupe (Z71)", () => {
  it("pomija identyczny payload do czasu heartbeatu", () => {
    const d = createPushDedupe(60_000);
    const fp = payloadFingerprint({ a: 1 });
    expect(d.shouldSkip(fp, 0)).toBe(false);
    d.markPushed(fp, 0);
    expect(d.shouldSkip(fp, 8_000)).toBe(true);
    expect(d.shouldSkip(fp, 59_999)).toBe(true);
    expect(d.shouldSkip(fp, 60_000)).toBe(false);
  });

  it("zmiana payloadu zawsze przechodzi; reset czyści stan", () => {
    const d = createPushDedupe();
    d.markPushed(payloadFingerprint({ a: 1 }), 0);
    expect(d.shouldSkip(payloadFingerprint({ a: 2 }), 1)).toBe(false);
    d.reset();
    expect(d.shouldSkip(payloadFingerprint({ a: 1 }), 2)).toBe(false);
  });

  it("licznik zapisów i pominięć (metryka)", () => {
    const d = createPushDedupe();
    const fp = "x";
    d.markPushed(fp, 0);
    d.shouldSkip(fp, 1);
    d.shouldSkip(fp, 2);
    expect(d.stats()).toEqual({ skipped: 2, sent: 1 });
  });
});
