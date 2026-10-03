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

/**
 * Etykieta jak na makiecie Trening:
 * „jeszcze nie robiony” / „ostatnio wczoraj” / „ostatnio 5 dni temu” / „ostatnio 28.09”.
 */
export function formatPlanLastDoneRelative(
  ymd: string | null,
  todayYmd: string,
): string {
  if (!ymd) return "jeszcze nie robiony";
  try {
    const t0 = new Date(`${ymd}T12:00:00`).getTime();
    const t1 = new Date(`${todayYmd}T12:00:00`).getTime();
    if (!Number.isFinite(t0) || !Number.isFinite(t1)) {
      return `ostatnio ${formatPlanLastDoneShort(ymd)}`;
    }
    const days = Math.round((t1 - t0) / (24 * 60 * 60 * 1000));
    if (days <= 0) return "ostatnio dziś";
    if (days === 1) return "ostatnio wczoraj";
    if (days < 14) return `ostatnio ${days} dni temu`;
    return `ostatnio ${formatPlanLastDoneShort(ymd)}`;
  } catch {
    return `ostatnio ${formatPlanLastDoneShort(ymd) ?? "—"}`;
  }
}
