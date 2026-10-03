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
 * „jeszcze nie robiony” / „ostatnio wczoraj · 02.10” / „ostatnio 5 dni temu · 28.09”.
 * Zawsze dokłada konkretną datę dd.mm, gdy trening był wykonany.
 */
export function formatPlanLastDoneRelative(
  ymd: string | null,
  todayYmd: string,
): string {
  if (!ymd) return "jeszcze nie robiony";
  const short = formatPlanLastDoneShort(ymd);
  try {
    const t0 = new Date(`${ymd}T12:00:00`).getTime();
    const t1 = new Date(`${todayYmd}T12:00:00`).getTime();
    if (!Number.isFinite(t0) || !Number.isFinite(t1)) {
      return short ? `ostatnio ${short}` : "ostatnio —";
    }
    const days = Math.round((t1 - t0) / (24 * 60 * 60 * 1000));
    if (days <= 0) return short ? `ostatnio dziś · ${short}` : "ostatnio dziś";
    if (days === 1) {
      return short ? `ostatnio wczoraj · ${short}` : "ostatnio wczoraj";
    }
    if (days < 14) {
      return short
        ? `ostatnio ${days} dni temu · ${short}`
        : `ostatnio ${days} dni temu`;
    }
    return short ? `ostatnio ${short}` : "ostatnio —";
  } catch {
    return short ? `ostatnio ${short}` : "ostatnio —";
  }
}
