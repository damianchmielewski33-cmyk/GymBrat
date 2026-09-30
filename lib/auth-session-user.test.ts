import { describe, expect, it } from "vitest";
import { shouldRecheckSessionUser } from "@/lib/auth-session-user";

describe("shouldRecheckSessionUser", () => {
  it("wymaga sprawdzenia gdy brak znacznika", () => {
    expect(shouldRecheckSessionUser(undefined, 1000, 60_000)).toBe(true);
    expect(shouldRecheckSessionUser("x", 1000, 60_000)).toBe(true);
  });

  it("nie sprawdza ponownie w oknie interwału", () => {
    expect(shouldRecheckSessionUser(1000, 30_000, 60_000)).toBe(false);
  });

  it("sprawdza ponownie po upływie interwału", () => {
    expect(shouldRecheckSessionUser(1000, 61_001, 60_000)).toBe(true);
  });
});
