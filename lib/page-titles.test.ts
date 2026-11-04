import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.join(process.cwd(), "app", "(dashboard)");

function pages(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) pages(p, out);
    else if (name === "page.tsx") out.push(p);
  }
  return out;
}

describe("Z60: tytuły stron dashboardu", () => {
  it("każda trasa ma metadata.title albo generateMetadata (szablon „%s · GymBrat”)", () => {
    const missing = pages(DIR).filter((f) => {
      const s = readFileSync(f, "utf8");
      return !/export const metadata\b|export (async )?function generateMetadata/.test(s);
    });
    expect(missing.map((f) => path.relative(process.cwd(), f))).toEqual([]);
  });

  it("tytuły nie powtarzają marki (dodaje ją szablon)", () => {
    for (const f of pages(DIR)) {
      const m = /export const metadata = \{ title: "([^"]+)"/.exec(readFileSync(f, "utf8"));
      if (m) expect(m[1]).not.toMatch(/GymBrat/i);
    }
  });
});
