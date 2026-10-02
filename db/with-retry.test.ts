import { describe, expect, it } from "vitest";
import { isTransientDbError, withDbRetry } from "@/db/with-retry";

describe("withDbRetry", () => {
  it("rozpoznaje ECONNRESET / socket hang up", () => {
    expect(
      isTransientDbError(
        Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }),
      ),
    ).toBe(true);
    expect(isTransientDbError(new Error("syntax error"))).toBe(false);
  });

  it("ponawia przy chwilowym błędzie", async () => {
    let n = 0;
    const out = await withDbRetry(
      async () => {
        n += 1;
        if (n < 2) {
          throw Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
        }
        return "ok";
      },
      { attempts: 3, baseDelayMs: 1 },
    );
    expect(out).toBe("ok");
    expect(n).toBe(2);
  });
});
