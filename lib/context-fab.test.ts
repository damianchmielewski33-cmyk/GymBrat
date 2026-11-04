import { describe, expect, it } from "vitest";
import { resolveContextFab } from "@/lib/context-fab";

describe("resolveContextFab (Z59)", () => {
  it("Treningi → Start", () => {
    expect(resolveContextFab("/workout-plan")?.label).toBe("Start");
  });
  it("Dieta → Dodaj posiłek (deep link ?add=1)", () => {
    const fab = resolveContextFab("/meal-suggestions");
    expect(fab?.label).toBe("Dodaj posiłek");
    expect(fab?.href).toContain("add=1");
  });
  it("Analiza i Start → Raport", () => {
    expect(resolveContextFab("/progress")?.label).toBe("Raport");
    expect(resolveContextFab("/progress/report")?.label).toBe("Raport");
    expect(resolveContextFab("/")?.label).toBe("Raport");
  });
  it("brak przycisku na Społeczności, Profilu i podekranach planów", () => {
    for (const p of ["/community/teams", "/profile", "/plany/atlas", "/nutrition/week"]) {
      expect(resolveContextFab(p)).toBeNull();
    }
  });
});
