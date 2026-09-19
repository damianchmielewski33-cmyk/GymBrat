import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression: early return before useEffect on /progress-analysis caused
 * "Rendered fewer hooks than expected" when navigating to Analiza.
 */
describe("CoachChatFab hooks order", () => {
  it("keeps progress-analysis hide after all useEffect calls", () => {
    const src = readFileSync(
      path.join(__dirname, "coach-chat-fab.tsx"),
      "utf8",
    );
    const firstEffect = src.indexOf("useEffect(");
    const hideReturn = src.indexOf("if (hideOnProgressAnalysis) return null");
    expect(firstEffect).toBeGreaterThan(-1);
    expect(hideReturn).toBeGreaterThan(-1);
    expect(hideReturn).toBeGreaterThan(firstEffect);
    expect(src).not.toMatch(
      /if\s*\(\s*pathname\.startsWith\(\s*["']\/progress-analysis["']\s*\)\s*\)\s*return\s+null\s*;[\s\S]*?useEffect\s*\(/,
    );
  });
});
