export type DietTabId = "plan" | "diary";

export function parseDietTab(raw: unknown): DietTabId {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string") return "plan";
  const key = v.trim().toLowerCase();
  if (key === "diary" || key === "dziennik" || key === "jadlospis") {
    return "diary";
  }
  // „przepisy” = ta sama zakładka co dawny Plan (id URL zostaje `plan`).
  if (key === "plan" || key === "przepisy" || key === "recipes") return "plan";
  return "plan";
}
