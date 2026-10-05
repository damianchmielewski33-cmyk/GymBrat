/** Czyste typy i formatowanie cardio — bez DB ani szyfrowania (bezpieczne dla klienta). */

/** Metryki cardio współdzielone przez cardio_log i cardio po siłowym. */
export type CardioExtras = {
  distanceKm: number | null;
  avgHr: number | null;
  calories: number | null;
  steps: number | null;
  paceMinPerKm: number | null;
};

export const EMPTY_CARDIO_EXTRAS: CardioExtras = {
  distanceKm: null,
  avgHr: null,
  calories: null,
  steps: null,
  paceMinPerKm: null,
};

export type CardioLogPayload = {
  kind: "cardio_log";
  title: string;
  notes?: string | null;
  distanceKm?: number | null;
  avgHr?: number | null;
  calories?: number | null;
  steps?: number | null;
  paceMinPerKm?: number | null;
  /** Surowa wartość z JSON (może być zaszyfrowana) — nie odszyfrowywać w bundlu klienta. */
  devicePhotoDataUrl?: string | null;
};

function finitePositive(n: unknown): number | null {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  return v;
}

export function normalizeCardioExtras(
  raw: Partial<CardioExtras> | null | undefined,
  minutes = 0,
): CardioExtras {
  const distanceKm = finitePositive(raw?.distanceKm);
  const avgHr = finitePositive(raw?.avgHr);
  const calories = finitePositive(raw?.calories);
  const steps = finitePositive(raw?.steps);
  const pace =
    finitePositive(raw?.paceMinPerKm) ??
    computePaceMinPerKm(distanceKm, minutes);
  return {
    distanceKm,
    avgHr: avgHr != null ? Math.round(avgHr) : null,
    calories: calories != null ? Math.round(calories) : null,
    steps: steps != null ? Math.round(steps) : null,
    paceMinPerKm: pace,
  };
}

/** Metryki z cardio_log albo z completed_session.cardio / cardioDetails. */
export function extractCardioExtrasFromSessionJson(
  raw: unknown,
  minutesCol = 0,
): CardioExtras {
  if (!raw || typeof raw !== "object") return { ...EMPTY_CARDIO_EXTRAS };
  const o = raw as Record<string, unknown>;
  if (o.kind === "cardio_log") {
    return normalizeCardioExtras(
      {
        distanceKm: typeof o.distanceKm === "number" ? o.distanceKm : null,
        avgHr: typeof o.avgHr === "number" ? o.avgHr : null,
        calories: typeof o.calories === "number" ? o.calories : null,
        steps: typeof o.steps === "number" ? o.steps : null,
        paceMinPerKm:
          typeof o.paceMinPerKm === "number" ? o.paceMinPerKm : null,
      },
      minutesCol,
    );
  }
  const nested =
    o.cardio && typeof o.cardio === "object"
      ? (o.cardio as Record<string, unknown>)
      : o.cardioDetails && typeof o.cardioDetails === "object"
        ? (o.cardioDetails as Record<string, unknown>)
        : null;
  if (nested) {
    return normalizeCardioExtras(
      {
        distanceKm:
          typeof nested.distanceKm === "number" ? nested.distanceKm : null,
        avgHr: typeof nested.avgHr === "number" ? nested.avgHr : null,
        calories: typeof nested.calories === "number" ? nested.calories : null,
        steps: typeof nested.steps === "number" ? nested.steps : null,
        paceMinPerKm:
          typeof nested.paceMinPerKm === "number" ? nested.paceMinPerKm : null,
      },
      minutesCol,
    );
  }
  const hr = o.avgHr ?? o.heartRate;
  return normalizeCardioExtras(
    {
      distanceKm: null,
      avgHr: typeof hr === "number" ? hr : null,
      calories: null,
      steps: null,
      paceMinPerKm: null,
    },
    minutesCol,
  );
}

export function parseCardioLog(raw: unknown): CardioLogPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.kind !== "cardio_log") return null;
  return {
    kind: "cardio_log",
    title: typeof o.title === "string" && o.title.trim() ? o.title.trim() : "Cardio",
    notes: typeof o.notes === "string" ? o.notes : null,
    distanceKm:
      typeof o.distanceKm === "number" && Number.isFinite(o.distanceKm)
        ? o.distanceKm
        : null,
    avgHr:
      typeof o.avgHr === "number" && Number.isFinite(o.avgHr) ? o.avgHr : null,
    calories:
      typeof o.calories === "number" && Number.isFinite(o.calories)
        ? o.calories
        : null,
    steps:
      typeof o.steps === "number" && Number.isFinite(o.steps) ? o.steps : null,
    paceMinPerKm:
      typeof o.paceMinPerKm === "number" && Number.isFinite(o.paceMinPerKm)
        ? o.paceMinPerKm
        : null,
    devicePhotoDataUrl:
      typeof o.devicePhotoDataUrl === "string" ? o.devicePhotoDataUrl : null,
  };
}

export function computePaceMinPerKm(
  distanceKm: number | null | undefined,
  minutes: number,
): number | null {
  if (
    distanceKm == null ||
    !Number.isFinite(distanceKm) ||
    distanceKm <= 0 ||
    !Number.isFinite(minutes) ||
    minutes <= 0
  ) {
    return null;
  }
  return minutes / distanceKm;
}

export function formatPace(paceMinPerKm: number | null | undefined): string {
  if (paceMinPerKm == null || !Number.isFinite(paceMinPerKm) || paceMinPerKm <= 0) {
    return "—";
  }
  const whole = Math.floor(paceMinPerKm);
  const secs = Math.round((paceMinPerKm - whole) * 60);
  const s = secs === 60 ? 0 : secs;
  const m = secs === 60 ? whole + 1 : whole;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatDurationMmSs(minutes: number): string {
  const totalSec = Math.max(0, Math.round(minutes * 60));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatCardioDateLabel(dateKey: string, createdHint?: Date): string {
  try {
    const d = createdHint ?? new Date(`${dateKey}T12:00:00`);
    return new Intl.DateTimeFormat("pl-PL", {
      weekday: "short",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    })
      .format(d)
      .replace(/\./g, "")
      .toUpperCase();
  } catch {
    return dateKey;
  }
}
