import { describe, expect, it } from "vitest";
import { safeCallbackPath } from "@/lib/safe-callback-url";

describe("safeCallbackPath", () => {
  it("przepuszcza ścieżki wewnętrzne z query", () => {
    expect(safeCallbackPath("/progress?tab=1")).toBe("/progress?tab=1");
  });

  it.each([
    null,
    undefined,
    "",
    "https://obcy.pl",
    "//obcy.pl",
    "/\\obcy.pl",
    "javascript:alert(1)",
    "progress",
    "/a\nb",
  ])("odrzuca %j", (raw) => {
    expect(safeCallbackPath(raw)).toBe("/");
  });
});
