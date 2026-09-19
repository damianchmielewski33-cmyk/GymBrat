import {
  GYMBRAT_GITHUB_SLUG,
  isGymBratRepositorySlug,
} from "@/lib/gymbrat-source";

export const CHANGELOG_MIN_BULLET_LENGTH = 24;

const VAGUE_BULLET =
  /^(fix|update|wip|chore|feat|zmiana|zmiany|poprawka|test|ok|done)[\s.!:-]*$/i;

export type ChangelogSourceEntry = {
  title: string;
  bullets: string[];
  date?: string;
  planned?: boolean;
  sourceRepo: string;
  sha?: string;
};

export type ChangelogValidationIssue = {
  entryTitle: string;
  message: string;
};

export function isPlannedChangelogEntry(entry: ChangelogSourceEntry): boolean {
  return Boolean(entry.planned) || /^planowane$/i.test(entry.title.trim());
}

export function isVagueChangelogBullet(bullet: string): boolean {
  const text = bullet.trim();
  if (text.length < CHANGELOG_MIN_BULLET_LENGTH) return true;
  return VAGUE_BULLET.test(text);
}

export function validateChangelogEntries(
  entries: ChangelogSourceEntry[],
): ChangelogValidationIssue[] {
  const issues: ChangelogValidationIssue[] = [];
  const shipped = entries.filter((entry) => !isPlannedChangelogEntry(entry));

  if (shipped.length === 0) {
    issues.push({
      entryTitle: "(brak)",
      message:
        "Changelog musi zawierać przynajmniej jeden jasny wpis wdrożeniowy z repozytorium GymBrat.",
    });
  }

  for (const entry of entries) {
    if (!entry.title.trim()) {
      issues.push({ entryTitle: "(pusty)", message: "Wpis changelogu nie ma tytułu." });
      continue;
    }
    if (!isGymBratRepositorySlug(entry.sourceRepo)) {
      issues.push({
        entryTitle: entry.title,
        message: `Źródło musi być ${GYMBRAT_GITHUB_SLUG}, jest: ${entry.sourceRepo || "(puste)"}.`,
      });
    }
    if (isPlannedChangelogEntry(entry)) {
      if (entry.bullets.length === 0) {
        issues.push({
          entryTitle: entry.title,
          message: "Wpis planowany musi mieć przynajmniej jeden punkt.",
        });
      }
      continue;
    }
    if (!entry.date || !/^\d{4}-\d{2}(-\d{2})?$/.test(entry.date)) {
      issues.push({
        entryTitle: entry.title,
        message: "Wpis wdrożeniowy musi mieć datę w formacie YYYY-MM lub YYYY-MM-DD.",
      });
    }
    if (entry.bullets.length === 0) {
      issues.push({
        entryTitle: entry.title,
        message: "Wpis wdrożeniowy musi jasno opisywać zmiany (lista punktów).",
      });
    }
    entry.bullets.forEach((bullet, index) => {
      if (isVagueChangelogBullet(bullet)) {
        issues.push({
          entryTitle: entry.title,
          message: `Punkt ${index + 1} jest zbyt ogólny — opisz zmianę GymBrat pełnym zdaniem.`,
        });
      }
    });
  }

  return issues;
}

export function assertChangelogReady(entries: ChangelogSourceEntry[]): void {
  const issues = validateChangelogEntries(entries);
  if (issues.length > 0) {
    const details = issues
      .map((issue) => `- ${issue.entryTitle}: ${issue.message}`)
      .join("\n");
    throw new Error(`Changelog GymBrat nie jest gotowy do wdrożenia:\n${details}`);
  }
}
