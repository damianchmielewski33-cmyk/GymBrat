import { GYMBRAT_GITHUB_SLUG } from "@/lib/gymbrat-source";
import type { ChangelogSourceEntry } from "@/lib/deploy-changelog";
import entries from "./changelog-entries.json";

export type ChangelogEntry = ChangelogSourceEntry;

type RawChangelogEntry = Omit<ChangelogEntry, "sourceRepo">;

/**
 * Z80: treść dziennika zmian żyje w `changelog-entries.json` (same dane, bez kodu).
 * Każdy wpis dostaje źródło GymBrat tutaj — w JSON nie ma `sourceRepo`, więc nie da się
 * dopisać wpisu z innego repozytorium. Nowe wpisy dopisuj na początku JSON-a (`planned: true` na PR).
 */
export const CHANGELOG_ENTRIES: ChangelogEntry[] = (entries as RawChangelogEntry[]).map(
  (entry) => ({
    ...entry,
    sourceRepo: GYMBRAT_GITHUB_SLUG,
  }),
);
