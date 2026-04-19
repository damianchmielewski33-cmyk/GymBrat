export type AppRole = "zawodnik" | "trener" | "admin";

export function roleFromSearchParam(value: string | null): AppRole {
  return value === "trener" ? "trener" : "zawodnik";
}

/** Trener UI is locked until product logic exists — only zawodnik may register / log in as trener path. */
export function isTrainerFlowEnabled(): boolean {
  return false;
}
