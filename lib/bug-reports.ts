export const BUG_PRIORITIES = [
  "highest",
  "high",
  "medium",
  "low",
  "lowest",
] as const;

export type BugPriority = (typeof BUG_PRIORITIES)[number];

export const BUG_PRIORITY_LABELS: Record<BugPriority, string> = {
  highest: "Najwyższy",
  high: "Wysoki",
  medium: "Średni",
  low: "Niski",
  lowest: "Najniższy",
};

export const BUG_STATUSES = ["open", "fixed"] as const;
export type BugStatus = (typeof BUG_STATUSES)[number];

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

/** Kolejność jak w Jira — najwyższy pierwszy. */
export function bugPriorityRank(priority: BugPriority): number {
  return BUG_PRIORITIES.indexOf(priority);
}
