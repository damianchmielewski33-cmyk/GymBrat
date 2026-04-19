/** Etykieta czasu zdarzenia w logu aktywności (PL). */
export function formatActivityTimePl(date: Date): string {
  return date.toLocaleString("pl-PL", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}
