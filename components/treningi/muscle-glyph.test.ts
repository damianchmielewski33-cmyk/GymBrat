import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PlanDayMuscleSummary } from "@/lib/plan-day-muscles";
import { MuscleGlyph } from "@/components/treningi/muscle-glyph";

function render(summary: PlanDayMuscleSummary | null, size: "row" | "hero" = "row") {
  return renderToStaticMarkup(createElement(MuscleGlyph, { summary, size }));
}

function highlightedRegions(html: string): string[] {
  return [...html.matchAll(/data-glyph-region="(\w+)" data-glyph-on="true"/g)].map(
    (m) => m[1],
  );
}

describe("MuscleGlyph", () => {
  it("przód: zaznacza klatkę, barki i ramiona (po 2 bryły barków i ramion)", () => {
    const html = render({
      groups: ["klatka", "barki", "ramiona"],
      labels: ["Klatka", "Barki", "Ramiona"],
      view: "front",
    });
    expect(html).toContain('data-glyph-view="front"');
    expect(highlightedRegions(html).sort()).toEqual(
      ["barki", "barki", "klatka", "ramiona", "ramiona"].sort(),
    );
    expect(html).not.toContain('data-glyph-region="plecy"');
    expect(html).toContain('aria-hidden="true"');
  });

  it("tył: plecy z kręgosłupem, bez klatki i brzucha", () => {
    const html = render(
      { groups: ["plecy", "posladki"], labels: ["Plecy", "Pośladki"], view: "back" },
      "hero",
    );
    expect(html).toContain('width="64"');
    expect(html).toContain("<line");
    expect(html).not.toContain('data-glyph-region="klatka"');
    expect(html).not.toContain('data-glyph-region="brzuch"');
    expect(highlightedRegions(html)).toEqual(["plecy", "posladki", "posladki"]);
  });

  it("grupa „nogi” rysuje uda; grupa niewidoczna w widoku nie jest rysowana", () => {
    const html = render({
      groups: ["nogi", "plecy"],
      labels: ["Nogi", "Plecy"],
      view: "front",
    });
    expect(highlightedRegions(html)).toEqual(["uda", "uda"]);
  });

  it("brak rozpoznanych partii: sztanga zamiast sylwetki", () => {
    const row = render(null);
    expect(row).not.toContain("data-glyph-view");
    expect(row).toContain("lucide-dumbbell");
    expect(row).toContain('aria-hidden="true"');

    const hero = render(null, "hero");
    expect(hero).toContain("size-16");
    expect(hero).toContain("lucide-dumbbell");
  });
});
