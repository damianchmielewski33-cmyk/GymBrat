/**
 * Kolejka propozycji treningów:
 * 1) nigdy nie robione,
 * 2) robione najdawniej,
 * 3) robione ostatnio — na końcu.
 */
export function comparePlansByWorkoutRecencyAsc(
  a: { lastWorkoutDate: string | null; updatedAt?: string },
  b: { lastWorkoutDate: string | null; updatedAt?: string },
): number {
  if (a.lastWorkoutDate && b.lastWorkoutDate) {
    return a.lastWorkoutDate.localeCompare(b.lastWorkoutDate);
  }
  if (!a.lastWorkoutDate && b.lastWorkoutDate) return -1;
  if (a.lastWorkoutDate && !b.lastWorkoutDate) return 1;
  const au = a.updatedAt ?? "";
  const bu = b.updatedAt ?? "";
  return bu.localeCompare(au);
}

/** Krótka data ostatniego treningu planu (np. „28.09”) albo null gdy nigdy. */
export function formatPlanLastDoneShort(ymd: string | null): string | null {
  if (!ymd) return null;
  try {
    const d = new Date(`${ymd}T12:00:00`);
    return new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
    }).format(d);
  } catch {
    return ymd;
  }
}

/** Etykieta pod nazwą planu: data albo „jeszcze nie”. */
export function formatPlanLastDoneLabel(ymd: string | null): string {
  const short = formatPlanLastDoneShort(ymd);
  return short ?? "jeszcze nie";
}
