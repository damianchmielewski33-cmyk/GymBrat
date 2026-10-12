/** Event okna — odśwież badge liczby otwartych zgłoszeń w panelu admina. */
export const BUG_REPORTS_CHANGED_EVENT = "gymbrat:bug-reports-changed";

export const BUG_PRIORITIES = [
  "critical",
  "high",
  "normal",
  "low",
] as const;

export type BugPriority = (typeof BUG_PRIORITIES)[number];

export const BUG_PRIORITY_LABELS: Record<BugPriority, string> = {
  critical: "Krytyczny",
  high: "Wysoki",
  normal: "Normalny",
  low: "Niski",
};

/** Statusy workflow zgłoszenia. */
export const BUG_STATUSES = ["analysis", "in_fix", "retest"] as const;
export type BugStatus = (typeof BUG_STATUSES)[number];

export const BUG_STATUS_LABELS: Record<BugStatus, string> = {
  analysis: "Analiza",
  in_fix: "W naprawie",
  retest: "Do retestu",
};

/** Statusy liczone w czerwonej cyferce admina (jeszcze nie do retestu). */
export const BUG_ACTIVE_STATUSES: readonly BugStatus[] = [
  "analysis",
  "in_fix",
];

export function isBugPriority(value: unknown): value is BugPriority {
  return (
    typeof value === "string" &&
    (BUG_PRIORITIES as readonly string[]).includes(value)
  );
}

export function isBugStatus(value: unknown): value is BugStatus {
  return (
    typeof value === "string" &&
    (BUG_STATUSES as readonly string[]).includes(value)
  );
}

/** Kolejność: krytyczny pierwszy. */
export function bugPriorityRank(priority: BugPriority): number {
  return BUG_PRIORITIES.indexOf(priority);
}
