export type PlanQueueItem = { lastWorkoutDate: string | null; dayNumber: number };

/**
 * Kolejka propozycji treningów (wspólna dla Home i ekranu Trening):
 * 1) nigdy nie robione,
 * 2) robione najdawniej,
 * 3) robione ostatnio — na końcu.
 * Remis (obie daty puste albo równe) rozstrzyga niższy numer dnia.
 */
export function comparePlansByWorkoutRecencyAsc(
  a: PlanQueueItem,
  b: PlanQueueItem,
): number {
  const da = a.lastWorkoutDate;
  const db = b.lastWorkoutDate;
  if (!da && db) return -1;
  if (da && !db) return 1;
  if (da && db && da !== db) return da.localeCompare(db);
  return a.dayNumber - b.dayNumber;
}

/**
 * Następny dzień do zrobienia: pierwszy w kolejce dzień z ćwiczeniami;
 * gdy wszystkie są puste — pierwszy w kolejce (UI: „Dzień N jest pusty”).
 * `null` tylko przy braku planów. Nie mutuje wejścia.
 */
export function pickNextWorkoutPlan<
  T extends PlanQueueItem & { plan: { exercises: readonly unknown[] } },
>(plans: readonly T[]): T | null {
  if (plans.length === 0) return null;
  const queue = [...plans].sort(comparePlansByWorkoutRecencyAsc);
  return queue.find((p) => p.plan.exercises.length > 0) ?? queue[0]!;
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
