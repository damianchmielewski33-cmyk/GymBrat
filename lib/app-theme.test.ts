import { describe, expect, it } from "vitest";
import { nextQuickTheme, parseAppTheme } from "./app-theme";

describe("app-theme", () => {
  it("parsuje znane motywy, reszta → gold", () => {
    expect(parseAppTheme("pink")).toBe("pink");
    expect(parseAppTheme("blue")).toBe("blue");
    expect(parseAppTheme("neon")).toBe("gold");
    expect(parseAppTheme(null)).toBe("gold");
    expect(parseAppTheme(undefined)).toBe("gold");
  });
  it("szybki przełącznik: gold↔pink", () => {
    expect(nextQuickTheme("gold")).toBe("pink");
    expect(nextQuickTheme("pink")).toBe("gold");
    expect(nextQuickTheme("teal")).toBe("gold");
  });
});
