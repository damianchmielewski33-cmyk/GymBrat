import { describe, expect, it } from "vitest";
import { CHANGELOG_ENTRIES } from "@/components/changelog/changelog-data";
import {
  assertChangelogReady,
  validateChangelogEntries,
  type ChangelogSourceEntry,
} from "@/lib/deploy-changelog";
import { GYMBRAT_GITHUB_SLUG } from "@/lib/gymbrat-source";

describe("deploy changelog", () => {
  it("wymaga jasnych opisów wyłącznie z repozytorium GymBrat", () => {
    const issues = validateChangelogEntries(CHANGELOG_ENTRIES);
    expect(issues).toEqual([]);
    expect(() => assertChangelogReady(CHANGELOG_ENTRIES)).not.toThrow();
    expect(
      CHANGELOG_ENTRIES.every((entry) => entry.sourceRepo === GYMBRAT_GITHUB_SLUG),
    ).toBe(true);
  });

  it("odrzuca wpis z AWP albo zbyt ogólnym opisem", () => {
    const bad: ChangelogSourceEntry[] = [
      {
        title: "2026-09",
        date: "2026-09",
        sourceRepo: "damianchmielewski33-cmyk/awp",
        bullets: ["fix", "update"],
      },
    ];
    const issues = validateChangelogEntries(bad);
    expect(issues.some((issue) => issue.message.includes(GYMBRAT_GITHUB_SLUG))).toBe(
      true,
    );
    expect(issues.some((issue) => /zbyt ogólny/.test(issue.message))).toBe(true);
  });
});
