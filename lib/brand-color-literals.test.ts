import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BRAND_GOLD,
  BRAND_GOLD_BRIGHT,
  BRAND_GOLD_DEEP,
  BRAND_ON_GOLD,
} from "@/lib/brand-colors";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components", "lib", "hooks"];
/** Dokumenty/obrazy samodzielne (poza DOM aplikacji) — `var()` tam nie działa. */
const ALLOWED = new Set([
  "lib/brand-colors.ts",
  "lib/recipe-image.ts",
  "lib/pdf/workout-plan-export.ts",
  "app/globals.css",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(p, out);
    } else if (/\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)));

describe("Z66: tokeny koloru marki", () => {
  it("brak literałów koloru marki poza app/globals.css i lib/brand-colors.ts", () => {
    const re = /#ebc44a|#f7e28f|#c49a1f|#1a1408|235,\s*196,\s*74/i;
    const offenders = files
      .map((f) => path.relative(ROOT, f).replaceAll("\\", "/"))
      .filter((rel) => !ALLOWED.has(rel))
      .filter((rel) => re.test(readFileSync(path.join(ROOT, rel), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("stałe TS zgadzają się z app/globals.css", () => {
    const css = readFileSync(path.join(ROOT, "app/globals.css"), "utf8");
    const get = (name: string) =>
      new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)?.[1]?.toLowerCase();
    expect(get("gym-gold")).toBe(BRAND_GOLD);
    expect(get("gym-gold-bright")).toBe(BRAND_GOLD_BRIGHT);
    expect(get("gym-gold-deep")).toBe(BRAND_GOLD_DEEP);
    expect(get("gym-on-gold")).toBe(BRAND_ON_GOLD);
  });
});

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe("Z66: kontrast WCAG AA", () => {
  const css = readFileSync(path.join(ROOT, "app/globals.css"), "utf8");
  const token = (n: string) =>
    new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`).exec(css)![1]!;
  const surfaces = ["gym-black", "gym-surface", "gym-surface-raised", "gym-surface-gold"].map(token);

  it.each(["gym-text-secondary", "gym-gold", "gym-success", "gym-trend-down", "gym-skipped"])(
    "%s ma ≥ 4,5:1 na powierzchniach aplikacji",
    (name) => {
      for (const bg of surfaces) expect(contrast(token(name), bg)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("tekst na złotym przycisku ma ≥ 4,5:1", () => {
    expect(contrast(token("gym-on-gold"), token("gym-gold"))).toBeGreaterThanOrEqual(4.5);
  });

  it("tekst biały z przezroczystością poniżej 50% nie jest używany (poza placeholder/disabled)", () => {
    const re = /(?<![:\w-])text-white\/(5|10|15|20|25|30|35|40|45)\b/;
    const offenders = files
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => path.relative(ROOT, f).replaceAll("\\", "/"))
      .filter((rel) => re.test(readFileSync(path.join(ROOT, rel), "utf8")));
    expect(offenders).toEqual([]);
  });
});
