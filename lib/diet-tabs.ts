export type DietTabId = "plan" | "diary";

export function parseDietTab(raw: unknown): DietTabId {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string") return "plan";
  const key = v.trim().toLowerCase();
  if (key === "diary" || key === "dziennik" || key === "jadlospis") {
    return "diary";
  }
  if (key === "plan") return "plan";
  return "plan";
}
