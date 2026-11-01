import { daysBetweenDateKeys } from "@/lib/local-date";

/**
 * Mezocykl = okres między kolejnymi rewizjami planu (przeglądami/deloadami).
 * Identyfikator wynika z rewizji, więc nie wymaga zmian w zapisie treningów.
 */
export type MesocyclePosition = {
  /** Numer bloku od 1 (przed pierwszą rewizją = 1). */
  index: number;
  /** Id rewizji otwierającej blok; null dla pierwszego bloku. */
  revisionId: string | null;
  /** Tydzień w bloku od 1. */
  weekInBlock: number;
};

export function mesocycleAt(args: {
  /** Rewizje rosnąco po dacie (YYYY-MM-DD). */
  revisions: Array<{ id: string; date: string }>;
  /** Początek historii planu (YYYY-MM-DD) — start bloku 1. */
  planStart: string;
  today: string;
}): MesocyclePosition {
  const past = args.revisions
    .filter((r) => r.date <= args.today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const open = past.at(-1) ?? null;
  const blockStart = open?.date ?? args.planStart;
  const days = Math.max(0, daysBetweenDateKeys(blockStart, args.today));
  return {
    index: past.length + 1,
    revisionId: open?.id ?? null,
    weekInBlock: Math.floor(days / 7) + 1,
  };
}

/** Zaplanowane vs wykonane serie ćwiczenia w sesjach danego planu. */
export type PlanAdherence = {
  sessions: number;
  plannedSets: number;
  doneSets: number;
  /** doneSets / plannedSets (0–1+), null bez zaplanowanych serii. */
  completion: number | null;
};

export function computeAdherence(
  sessions: Array<{ plannedSets: number; doneSets: number }>,
): PlanAdherence {
  const plannedSets = sessions.reduce((a, s) => a + Math.max(0, s.plannedSets), 0);
  const doneSets = sessions.reduce((a, s) => a + Math.max(0, s.doneSets), 0);
  return {
    sessions: sessions.length,
    plannedSets,
    doneSets,
    completion:
      plannedSets > 0 ? Math.round((doneSets / plannedSets) * 100) / 100 : null,
  };
}
