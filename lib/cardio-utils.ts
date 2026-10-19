/** Czyste typy i formatowanie cardio — bez DB ani szyfrowania (bezpieczne dla klienta). */

/** Stabilny slug aktywności (Analityka 2.0). */
export const CARDIO_TYPE_SLUGS = [
  "walk",
  "treadmill",
  "bike",
  "elliptical",
  "stairs",
  "run",
  "swim",
  "other",
] as const;

export type CardioTypeSlug = (typeof CARDIO_TYPE_SLUGS)[number];

export const CARDIO_TYPE_LABELS_PL: Record<CardioTypeSlug, string> = {
  walk: "Marsz",
  treadmill: "Bieżnia",
  bike: "Rower",
  elliptical: "Orbitrek",
  stairs: "Schody",
  run: "Bieg",
  swim: "Pływanie",
  other: "Inne",
};

const TITLE_TO_SLUG: Record<string, CardioTypeSlug> = {
  marsz: "walk",
  bieznia: "treadmill",
  "bieżnia": "treadmill",
  rower: "bike",
  orbitrek: "elliptical",
  schody: "stairs",
  bieg: "run",
  pływanie: "swim",
  plywanie: "swim",
  inne: "other",
  walk: "walk",
  treadmill: "treadmill",
  bike: "bike",
  elliptical: "elliptical",
  stairs: "stairs",
  run: "run",
  swim: "swim",
  other: "other",
};

export function isCardioTypeSlug(v: unknown): v is CardioTypeSlug {
  return (
    typeof v === "string" &&
    (CARDIO_TYPE_SLUGS as readonly string[]).includes(v)
  );
}

/** Mapuje etykietę PL / slug → stabilny typ. */
export function resolveCardioType(
  titleOrSlug: string | null | undefined,
): CardioTypeSlug {
  const raw = (titleOrSlug ?? "").trim().toLowerCase();
  if (!raw) return "other";
  const folded = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/g, "l");
  return TITLE_TO_SLUG[raw] ?? TITLE_TO_SLUG[folded] ?? "other";
}

/** Strefa intensywności 1–5 (HR vs HRmax). */
export type HeartRateZone = 1 | 2 | 3 | 4 | 5;

/** Metryki cardio współdzielone przez cardio_log i cardio po siłowym. */
export type CardioExtras = {
  distanceKm: number | null;
  avgHr: number | null;
  maxHr: number | null;
  calories: number | null;
  steps: number | null;
  paceMinPerKm: number | null;
  cardioType: CardioTypeSlug | null;
  effortScore: number | null;
  heartRateZone: HeartRateZone | null;
};

export const EMPTY_CARDIO_EXTRAS: CardioExtras = {
  distanceKm: null,
  avgHr: null,
  maxHr: null,
  calories: null,
  steps: null,
  paceMinPerKm: null,
  cardioType: null,
  effortScore: null,
  heartRateZone: null,
};

export type CardioLogPayload = {
  kind: "cardio_log";
  title: string;
  notes?: string | null;
  cardioType?: CardioTypeSlug | null;
  distanceKm?: number | null;
  avgHr?: number | null;
  maxHr?: number | null;
  calories?: number | null;
  /** Alias analityczny — przy zapisie kopiujemy do calories gdy brak. */
  caloriesBurned?: number | null;
  steps?: number | null;
  paceMinPerKm?: number | null;
  effortScore?: number | null;
  heartRateZone?: HeartRateZone | null;
  /** Surowa wartość z JSON (może być zaszyfrowana) — nie odszyfrowywać w bundlu klienta. */
  devicePhotoDataUrl?: string | null;
};

function finitePositive(n: unknown): number | null {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  return v;
}

function clampEffort(n: unknown): number | null {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return null;
  const r = Math.round(v);
  if (r < 1 || r > 10) return null;
  return r;
}

function clampZone(n: unknown): HeartRateZone | null {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return null;
  const r = Math.round(v);
  if (r < 1 || r > 5) return null;
  return r as HeartRateZone;
}

/** HRmax ≈ 220 − wiek. */
export function estimateHrMax(ageYears: number | null | undefined): number | null {
  if (ageYears == null || !Number.isFinite(ageYears) || ageYears < 10 || ageYears > 100) {
    return null;
  }
  return Math.round(220 - ageYears);
}

/**
 * Strefa z % HRmax:
 * Z1 50–60%, Z2 60–70%, Z3 70–80%, Z4 80–90%, Z5 90–100%.
 */
export function heartRateZoneFromHr(
  avgHr: number | null | undefined,
  hrMax: number | null | undefined,
): HeartRateZone | null {
  if (
    avgHr == null ||
    hrMax == null ||
    !Number.isFinite(avgHr) ||
    !Number.isFinite(hrMax) ||
    hrMax <= 0 ||
    avgHr <= 0
  ) {
    return null;
  }
  const pct = avgHr / hrMax;
  if (pct < 0.5) return 1;
  if (pct < 0.6) return 1;
  if (pct < 0.7) return 2;
  if (pct < 0.8) return 3;
  if (pct < 0.9) return 4;
  return 5;
}

export function normalizeCardioExtras(
  raw: Partial<CardioExtras> & {
    title?: string | null;
    caloriesBurned?: number | null;
  } | null | undefined,
  minutes = 0,
  ageYears?: number | null,
): CardioExtras {
  const distanceKm = finitePositive(raw?.distanceKm);
  const avgHr = finitePositive(raw?.avgHr);
  const maxHr = finitePositive(raw?.maxHr);
  const calories =
    finitePositive(raw?.calories) ?? finitePositive(raw?.caloriesBurned);
  const steps = finitePositive(raw?.steps);
  const pace =
    finitePositive(raw?.paceMinPerKm) ??
    computePaceMinPerKm(distanceKm, minutes);
  const cardioType =
    (isCardioTypeSlug(raw?.cardioType) ? raw!.cardioType : null) ??
    (raw?.title ? resolveCardioType(raw.title) : null);
  const effortScore = clampEffort(raw?.effortScore);
  const hrMax = estimateHrMax(ageYears) ?? (maxHr != null ? Math.max(maxHr, avgHr ?? 0) : null);
  const heartRateZone =
    clampZone(raw?.heartRateZone) ?? heartRateZoneFromHr(avgHr, hrMax);
  return {
    distanceKm,
    avgHr: avgHr != null ? Math.round(avgHr) : null,
    maxHr: maxHr != null ? Math.round(maxHr) : null,
    calories: calories != null ? Math.round(calories) : null,
    steps: steps != null ? Math.round(steps) : null,
    paceMinPerKm: pace,
    cardioType,
    effortScore,
    heartRateZone,
  };
}

function pickNum(o: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

/** Metryki z cardio_log albo z completed_session.cardio / cardioDetails. */
export function extractCardioExtrasFromSessionJson(
  raw: unknown,
  minutesCol = 0,
  ageYears?: number | null,
): CardioExtras {
  if (!raw || typeof raw !== "object") return { ...EMPTY_CARDIO_EXTRAS };
  const o = raw as Record<string, unknown>;
  if (o.kind === "cardio_log") {
    return normalizeCardioExtras(
      {
        distanceKm: pickNum(o, "distanceKm"),
        avgHr: pickNum(o, "avgHr", "avgHeartRate", "heartRate"),
        maxHr: pickNum(o, "maxHr", "maxHeartRate"),
        calories: pickNum(o, "calories", "caloriesBurned"),
        caloriesBurned: pickNum(o, "caloriesBurned"),
        steps: pickNum(o, "steps"),
        paceMinPerKm: pickNum(o, "paceMinPerKm"),
        cardioType: isCardioTypeSlug(o.cardioType) ? o.cardioType : null,
        title: typeof o.title === "string" ? o.title : null,
        effortScore: pickNum(o, "effortScore"),
        heartRateZone: clampZone(o.heartRateZone),
      },
      minutesCol,
      ageYears,
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
        distanceKm: pickNum(nested, "distanceKm"),
        avgHr: pickNum(nested, "avgHr", "avgHeartRate", "heartRate"),
        maxHr: pickNum(nested, "maxHr", "maxHeartRate"),
        calories: pickNum(nested, "calories", "caloriesBurned"),
        caloriesBurned: pickNum(nested, "caloriesBurned"),
        steps: pickNum(nested, "steps"),
        paceMinPerKm: pickNum(nested, "paceMinPerKm"),
        cardioType: isCardioTypeSlug(nested.cardioType) ? nested.cardioType : null,
        title: typeof o.title === "string" ? o.title : null,
        effortScore: pickNum(nested, "effortScore"),
        heartRateZone: clampZone(nested.heartRateZone),
      },
      minutesCol,
      ageYears,
    );
  }
  const hr = pickNum(o, "avgHr", "heartRate");
  return normalizeCardioExtras(
    {
      distanceKm: null,
      avgHr: hr,
      maxHr: pickNum(o, "maxHr", "maxHeartRate"),
      calories: null,
      steps: null,
      paceMinPerKm: null,
    },
    minutesCol,
    ageYears,
  );
}

export function parseCardioLog(raw: unknown): CardioLogPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.kind !== "cardio_log") return null;
  const title =
    typeof o.title === "string" && o.title.trim() ? o.title.trim() : "Cardio";
  const extras = normalizeCardioExtras(
    {
      distanceKm: typeof o.distanceKm === "number" ? o.distanceKm : null,
      avgHr: typeof o.avgHr === "number" ? o.avgHr : null,
      maxHr: typeof o.maxHr === "number" ? o.maxHr : null,
      calories: typeof o.calories === "number" ? o.calories : null,
      caloriesBurned:
        typeof o.caloriesBurned === "number" ? o.caloriesBurned : null,
      steps: typeof o.steps === "number" ? o.steps : null,
      paceMinPerKm: typeof o.paceMinPerKm === "number" ? o.paceMinPerKm : null,
      cardioType: isCardioTypeSlug(o.cardioType) ? o.cardioType : null,
      title,
      effortScore: typeof o.effortScore === "number" ? o.effortScore : null,
      heartRateZone: clampZone(o.heartRateZone),
    },
    0,
  );
  return {
    kind: "cardio_log",
    title,
    notes: typeof o.notes === "string" ? o.notes : null,
    cardioType: extras.cardioType ?? resolveCardioType(title),
    distanceKm: extras.distanceKm,
    avgHr: extras.avgHr,
    maxHr: extras.maxHr,
    calories: extras.calories,
    caloriesBurned: extras.calories,
    steps: extras.steps,
    paceMinPerKm: extras.paceMinPerKm,
    effortScore: extras.effortScore,
    heartRateZone: extras.heartRateZone,
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
