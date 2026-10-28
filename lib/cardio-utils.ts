/** Czyste typy i formatowanie cardio — bez DB ani szyfrowania (bezpieczne dla klienta). */

import { addCalendarDays, calendarDateKey } from "@/lib/local-date";

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

/** Cardio po siłowym w store aktywnego treningu — `paceMinPerKm` dopisywany po zapisie. */
export type ActiveCardioExtras = Omit<CardioExtras, "paceMinPerKm"> & {
  paceMinPerKm?: number | null;
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

/** Limity wpisu cardio (serwer i klient) — jedna stała, bez cichego ucinania. */
export const CARDIO_INPUT_LIMITS = {
  /** Max 10 h w jednym wpisie (ADR 0009). */
  minutesMax: 600,
  caloriesMax: 20_000,
  /** Powyżej tego kcal/min wpis to prawie na pewno literówka. */
  caloriesPerMinMax: 25,
  hrMin: 30,
  hrMax: 250,
  distanceKmMax: 500,
  stepsMax: 500_000,
  notesMax: 280,
  backdateMaxDays: 60,
} as const;

export type CardioFieldKey =
  | "minutes"
  | "date"
  | "distanceKm"
  | "avgHr"
  | "maxHr"
  | "effortScore"
  | "calories"
  | "steps"
  | "notes";

export type CardioFieldError = { field: CardioFieldKey; message: string };

export type CardioMetricsInput = {
  minutes: unknown;
  distanceKm?: unknown;
  avgHr?: unknown;
  maxHr?: unknown;
  calories?: unknown;
  steps?: unknown;
  effortScore?: unknown;
  notes?: unknown;
  date?: unknown;
};

export type ValidatedCardioMetrics = {
  minutes: number;
  distanceKm: number | null;
  avgHr: number | null;
  maxHr: number | null;
  calories: number | null;
  steps: number | null;
  effortScore: number | null;
  notes: string | null;
  date: string | null;
};

function isBlank(v: unknown): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}

function rawString(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/**
 * Parsuje opcjonalne pole liczbowe.
 * Puste → null (OK). Niepuste, ale nie liczba dodatnia / poza zakresem → błąd (nigdy ciche null).
 */
function parseOptionalPositive(
  raw: unknown,
  field: CardioFieldKey,
  opts: {
    parseMessage: string;
    max?: number;
    maxMessage?: string;
    min?: number;
    maxExclusive?: boolean;
    allowDecimal?: boolean;
  },
): { ok: true; value: number | null } | { ok: false; error: CardioFieldError } {
  if (isBlank(raw)) return { ok: true, value: null };
  const s = rawString(raw).replace(",", ".");
  if (opts.allowDecimal === false && /[.,]/.test(rawString(raw))) {
    return { ok: false, error: { field, message: opts.parseMessage } };
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    return { ok: false, error: { field, message: opts.parseMessage } };
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, error: { field, message: opts.parseMessage } };
  }
  if (
    (opts.min != null && n < opts.min) ||
    (opts.max != null && n > opts.max)
  ) {
    return {
      ok: false,
      error: {
        field,
        message: opts.maxMessage ?? opts.parseMessage,
      },
    };
  }
  return { ok: true, value: n };
}

/**
 * Walidacja metryk cardio — ta sama funkcja klient (podgląd) i serwer (źródło prawdy).
 * Zero cichych zamian na null / clamp: zła wartość = fieldError.
 */
export function validateCardioMetrics(
  input: CardioMetricsInput,
):
  | { ok: true; values: ValidatedCardioMetrics }
  | { ok: false; fieldErrors: CardioFieldError[] } {
  const L = CARDIO_INPUT_LIMITS;
  const fieldErrors: CardioFieldError[] = [];

  // —— Minuty (wymagane, tylko cyfry całkowite) ——
  const minutesStr = rawString(input.minutes);
  let minutes = 0;
  if (!minutesStr) {
    fieldErrors.push({
      field: "minutes",
      message: "Podaj czas w minutach, 1–600.",
    });
  } else if (!/^\d+$/.test(minutesStr)) {
    fieldErrors.push({
      field: "minutes",
      message: "Minuty wpisz jako liczbę całkowitą, np. 90.",
    });
  } else {
    minutes = Number(minutesStr);
    if (minutes < 1) {
      fieldErrors.push({ field: "minutes", message: "Minimum to 1 minuta." });
    } else if (minutes > L.minutesMax) {
      fieldErrors.push({
        field: "minutes",
        message: "Maksymalnie 600 minut w jednym wpisie.",
      });
    }
  }

  // —— Opcjonalne liczby ——
  const distance = parseOptionalPositive(input.distanceKm, "distanceKm", {
    parseMessage: "Podaj dystans liczbą, np. 3,5.",
    max: L.distanceKmMax,
    maxMessage: "Dystans wygląda na pomyłkę (max 500 km).",
    allowDecimal: true,
  });
  if (!distance.ok) fieldErrors.push(distance.error);

  const avgHr = parseOptionalPositive(input.avgHr, "avgHr", {
    parseMessage: "Podaj tętno samą liczbą, np. 125.",
    min: L.hrMin,
    max: L.hrMax,
    maxMessage: `Tętno w zakresie ${L.hrMin}–${L.hrMax} bpm.`,
    allowDecimal: false,
  });
  if (!avgHr.ok) fieldErrors.push(avgHr.error);

  const maxHr = parseOptionalPositive(input.maxHr, "maxHr", {
    parseMessage: "Podaj tętno samą liczbą, np. 125.",
    min: L.hrMin,
    max: L.hrMax,
    maxMessage: `Tętno w zakresie ${L.hrMin}–${L.hrMax} bpm.`,
    allowDecimal: false,
  });
  if (!maxHr.ok) fieldErrors.push(maxHr.error);

  const avgHrVal =
    avgHr.ok && avgHr.value != null ? Math.round(avgHr.value) : null;
  const maxHrVal =
    maxHr.ok && maxHr.value != null ? Math.round(maxHr.value) : null;
  if (
    avgHrVal != null &&
    maxHrVal != null &&
    maxHrVal < avgHrVal &&
    !fieldErrors.some((e) => e.field === "maxHr")
  ) {
    fieldErrors.push({
      field: "maxHr",
      message: "Maksymalne tętno nie może być niższe od średniego.",
    });
  }

  const calories = parseOptionalPositive(input.calories, "calories", {
    parseMessage: "Podaj kalorie liczbą, np. 280.",
    max: L.caloriesMax,
    maxMessage: "Kalorie wyglądają na pomyłkę (max 20 000).",
    allowDecimal: false,
  });
  if (!calories.ok) fieldErrors.push(calories.error);
  else if (
    calories.value != null &&
    minutes >= 1 &&
    calories.value / minutes > L.caloriesPerMinMax
  ) {
    fieldErrors.push({
      field: "calories",
      message: "Kalorie nierealne przy tym czasie. Sprawdź wpis.",
    });
  }

  const steps = parseOptionalPositive(input.steps, "steps", {
    parseMessage: "Podaj liczbę kroków, np. 4500.",
    max: L.stepsMax,
    maxMessage: "Liczba kroków wygląda na pomyłkę.",
    allowDecimal: false,
  });
  if (!steps.ok) fieldErrors.push(steps.error);

  // —— Wysiłek 1–10 ——
  let effortScore: number | null = null;
  if (!isBlank(input.effortScore)) {
    const es = rawString(input.effortScore);
    if (!/^\d+$/.test(es)) {
      fieldErrors.push({
        field: "effortScore",
        message: "Wybierz wysiłek w skali 1–10.",
      });
    } else {
      const n = Number(es);
      if (n < 1 || n > 10) {
        fieldErrors.push({
          field: "effortScore",
          message: "Wybierz wysiłek w skali 1–10.",
        });
      } else {
        effortScore = n;
      }
    }
  }

  // —— Notatka ——
  let notes: string | null = null;
  if (!isBlank(input.notes)) {
    const n = String(input.notes).trim();
    if (n.length > L.notesMax) {
      fieldErrors.push({
        field: "notes",
        message: "Notatka może mieć najwyżej 280 znaków.",
      });
    } else {
      notes = n.length ? n : null;
    }
  }

  // —— Data ——
  let date: string | null = null;
  if (!isBlank(input.date)) {
    const resolved = resolveCardioLogDate(rawString(input.date));
    if (!resolved.ok) {
      fieldErrors.push(...resolved.fieldErrors);
    } else {
      date = resolved.date;
    }
  }

  if (fieldErrors.length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    values: {
      minutes,
      distanceKm: distance.ok ? distance.value : null,
      avgHr: avgHrVal,
      maxHr: maxHrVal,
      calories:
        calories.ok && calories.value != null
          ? Math.round(calories.value)
          : null,
      steps:
        steps.ok && steps.value != null ? Math.round(steps.value) : null,
      effortScore,
      notes,
      date,
    },
  };
}

/** Pusta data = dziś; inaczej YYYY-MM-DD z zakresu [dziś−60, dziś]. */
export function resolveCardioLogDate(
  dateKey: string | null | undefined,
):
  | { ok: true; date: string }
  | { ok: false; fieldErrors: CardioFieldError[] } {
  const todayKey = calendarDateKey(new Date());
  const raw = (dateKey ?? "").trim();
  if (!raw) return { ok: true, date: todayKey };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) {
    return {
      ok: false,
      fieldErrors: [{ field: "date", message: "Nieprawidłowa data cardio." }],
    };
  }
  if (raw > todayKey) {
    return {
      ok: false,
      fieldErrors: [
        { field: "date", message: "Nie można zapisać wpisu z przyszłości." },
      ],
    };
  }
  if (raw < addCalendarDays(todayKey, -CARDIO_INPUT_LIMITS.backdateMaxDays)) {
    return {
      ok: false,
      fieldErrors: [
        {
          field: "date",
          message: "Można wpisać najwyżej 60 dni wstecz.",
        },
      ],
    };
  }
  return { ok: true, date: raw };
}

/** Etykieta tygodnia pn–nd, np. „20–26 paź”. */
export function formatCardioWeekShortLabel(monday: string): string {
  const sun = addCalendarDays(monday, 6);
  const a = new Date(`${monday}T12:00:00`);
  const b = new Date(`${sun}T12:00:00`);
  const fmt = (d: Date) =>
    d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  return `${fmt(a)}–${fmt(b)}`;
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
