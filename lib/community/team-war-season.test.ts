import { describe, expect, it } from "vitest";
import { gymbratSeasonKey } from "@/lib/community/hof-periods";

/** Parsowanie jak w ensureWarSeason — regresja NaN/Invalid Date (012 hub). */
function parseWarSeasonKey(key: string): {
  year: number;
  seasonNum: number;
  startMonth: number;
} {
  const [yRaw, seasonRaw] = key.split(/-S/);
  const year = Number(yRaw);
  const seasonNum = Number(seasonRaw);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(seasonNum) ||
    seasonNum < 1 ||
    seasonNum > 4
  ) {
    throw new Error(`Nieprawidłowy klucz sezonu wojen: ${key}`);
  }
  return { year, seasonNum, startMonth: (seasonNum - 1) * 3 };
}

describe("ensureWarSeason key parse", () => {
  it("parses YYYY-Sn without skipping the season segment", () => {
    const key = gymbratSeasonKey("2026-10-28");
    expect(key).toBe("2026-S4");
    const p = parseWarSeasonKey(key);
    expect(p.year).toBe(2026);
    expect(p.seasonNum).toBe(4);
    expect(p.startMonth).toBe(9);
    const startsAt = new Date(Date.UTC(p.year, p.startMonth, 1));
    expect(Number.isFinite(startsAt.getTime())).toBe(true);
  });

  it("old buggy destructuring [y, , s] would yield NaN for S4", () => {
    const key = "2026-S4";
    const [y, , s] = key.split(/-S/);
    expect(y).toBe("2026");
    expect(s).toBeUndefined();
    expect(Number(s)).toBeNaN();
  });
});
