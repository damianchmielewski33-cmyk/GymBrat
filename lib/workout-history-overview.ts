import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workoutPlans, workouts } from "@/db/schema";
import {
  addCalendarDays,
  calendarDateKey,
  calendarWeekMondayKey,
  calendarWeekdaySun0,
  PL_MONTH_GENITIVE,
} from "@/lib/local-date";
import {
  computeWorkoutDetails,
  deltaPercent,
  type CompletedWorkoutDetails,
} from "@/lib/workout-history";
import {
  workoutPlanCompareKey,
  workoutPlanDisplayLabel,
} from "@/lib/workout-plan-compare-key";
import {
  countableCardioMinutes,
  isCompletedStrengthSession,
  isStandaloneCardioLog,
} from "@/lib/workout-cardio-attribution";
import { resolveExerciseIdentity } from "@/lib/exercise-identity";

function durationMinutesFromDetails(
  details: CompletedWorkoutDetails,
): number | null {
  if (
    details.startedAt != null &&
    details.endedAt != null &&
    details.endedAt > details.startedAt
  ) {
    return Math.max(1, Math.round((details.endedAt - details.startedAt) / 60000));
  }
  return null;
}

export type WorkoutHistoryKpis = {
  workoutsLast30: number;
  tonnageLast30Kg: number;
  cardioMinutesLast30: number;
  cardioEntriesLast30: number;
  planDaysActive: number;
  planDaysTotal: number;
  workoutsTotal: number;
  lastWorkoutDate: string | null;
  /** Sesje siłowe w bieżącym tygodniu kalendarzowym (Pn–Nd). */
  workoutsThisWeek: number;
  /** Średni czas sesji (min) — ze wszystkich sesji z znanym czasem. */
  avgDurationMinutes: number | null;
  /** Tonaż siłowy w bieżącym tygodniu (kg). */
  tonnageThisWeekKg: number;
  /** Średnia liczba treningów / tydzień z ostatnich 8 tygodni. */
  avgWorkoutsPerWeekLast8: number;
  /** Tonaż łączny (wszystkie sesje). */
  tonnageTotalKg: number;
};

export type WorkoutHistorySetPill = {
  reps: number | null;
  weight: number;
  done: boolean;
  /** Najlepsze e1RM ćwiczenia względem wcześniejszej historii. */
  isPr: boolean;
};

export type WorkoutHistoryExercisePreview = {
  id: string;
  name: string;
  volumeKg: number;
  /** Zaliczona seria z ciężarem 0 (np. pompki) — UI pokazuje „masa ciała”. */
  isBodyweight: boolean;
  sets: WorkoutHistorySetPill[];
};

export type WorkoutHistoryExerciseCompare = {
  up: number;
  down: number;
  skipped: number;
  /** Tonaż ćwiczenia bez istotnej zmiany vs poprzednia sesja. */
  same: number;
};

export type WorkoutHistoryCard = {
  id: string;
  date: string;
  title: string;
  planName: string | null;
  /** Klucz dnia planu — Push / Nogi / Bark osobno. */
  planCompareKey: string;
  /** Etykieta do UI (np. „Nogi”). */
  planLabel: string;
  workoutPlanId: string | null;
  volumeKg: number;
  volumeDeltaPercent: number | null;
  /** Różnica tonażu vs poprzednia sesja tego samego dnia planu (kg). */
  volumeDeltaKg: number | null;
  compare: WorkoutHistoryExerciseCompare | null;
  /** Brak poprzedniej sesji tego planu / tego dnia pierwszy wpis bez porównania. */
  firstOfDay: boolean;
  noComparison: boolean;
  prevDate: string | null;
  exerciseCount: number;
  setsDone: number;
  setsTotal: number;
  /** Cardio dodane w popupie po siłowym (min). */
  cardioMinutes: number;
  durationMinutes: number | null;
  /** ms — do limitu edycji 7 dni. */
  endedAt: number | null;
  /** Który z kolei trening tego dnia planu (1 = pierwszy). */
  planOccurrence: number;
  exercises: WorkoutHistoryExercisePreview[];
};

export type WorkoutHistoryCardioItem = {
  id: string;
  date: string;
  title: string;
  minutes: number;
  avgHr: number | null;
  kind: "cardio_log" | "post_strength";
};

export type WorkoutHistoryOverview = {
  kpis: WorkoutHistoryKpis;
  cards: WorkoutHistoryCard[];
  cardio: WorkoutHistoryCardioItem[];
  planFilters: Array<{ id: string; label: string; count: number }>;
  /** true gdy zapytanie ucięło wynik limitem (rows.length === 400). */
  sessionsLimitReached: boolean;
};

type SessionJson = {
  kind?: string;
  title?: string;
  avgHr?: number | null;
  heartRate?: number | null;
  exercises?: unknown;
};

function normalizeName(name: string): string {
  return (
    resolveExerciseIdentity(name).key ||
    name.trim().toLowerCase().replace(/\s+/g, " ")
  );
}

function exerciseVolume(ex: CompletedWorkoutDetails["exercises"][number]): number {
  return ex.volumeKg;
}

function exerciseDone(ex: CompletedWorkoutDetails["exercises"][number]): boolean {
  return ex.sets.some((s) => s.done);
}

/**
 * Porównanie ćwiczeń bieżącej sesji do poprzedniej (ten sam plan).
 * w górę / w dół = tonaż ćwiczenia vs poprzednio; pominięte = bez zaliczonych serii
 * albo obecne wcześniej, a teraz brak.
 */
export function compareWorkoutExercises(
  current: CompletedWorkoutDetails,
  previous: CompletedWorkoutDetails | null,
): WorkoutHistoryExerciseCompare | null {
  if (!previous) return null;

  const prevByName = new Map<string, CompletedWorkoutDetails["exercises"][number]>();
  for (const ex of previous.exercises) {
    prevByName.set(normalizeName(ex.name), ex);
  }

  let up = 0;
  let down = 0;
  let skipped = 0;
  let same = 0;
  const seen = new Set<string>();

  for (const ex of current.exercises) {
    const key = normalizeName(ex.name);
    seen.add(key);
    if (!exerciseDone(ex)) {
      skipped += 1;
      continue;
    }
    const prev = prevByName.get(key);
    if (!prev || !exerciseDone(prev)) continue;
    const curVol = exerciseVolume(ex);
    const prevVol = exerciseVolume(prev);
    // N-22-1 (005): ćwiczenie na masę ciała (zaliczone, tonaż 0) nie ma sensownej
    // delty vs poprzednia sesja z obciążeniem — nie licz go ani do „w górę”, ani
    // do „w dół” (fałszywe -100%), i nie traktuj jak pominięte (seria jest zaliczona).
    if (curVol === 0) continue;
    if (curVol > prevVol + 0.5) up += 1;
    else if (curVol < prevVol - 0.5) down += 1;
    else same += 1;
  }

  for (const [key, prev] of prevByName) {
    if (seen.has(key)) continue;
    if (exerciseDone(prev)) skipped += 1;
  }

  return { up, down, skipped, same };
}

export function formatTonnes(volumeKg: number): string {
  const t = Math.max(0, volumeKg) / 1000;
  return `${new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(t)} t`;
}

export function formatHistoryShortDate(ymd: string): string {
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

const PL_WEEKDAY_SHORT = ["nd", "pon", "wt", "śr", "czw", "pt", "sob"] as const;

/** Zakres tygodnia: „20–26 października” (rok gdy inny niż bieżący). */
export function formatHistoryWeekRange(
  monday: string,
  todayKey: string = calendarDateKey(),
): string {
  const sunday = addCalendarDays(monday, 6);
  const start = new Date(`${monday}T12:00:00`);
  const end = new Date(`${sunday}T12:00:00`);
  const today = new Date(`${todayKey}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${formatHistoryShortDate(monday)}–${formatHistoryShortDate(sunday)}`;
  }
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = PL_MONTH_GENITIVE[start.getMonth()] ?? "";
  const endMonth = PL_MONTH_GENITIVE[end.getMonth()] ?? "";
  const yearSuffix =
    !Number.isNaN(today.getTime()) && end.getFullYear() !== today.getFullYear()
      ? ` ${end.getFullYear()}`
      : "";
  if (start.getMonth() === end.getMonth()) {
    return `${startDay}–${endDay} ${endMonth}${yearSuffix}`;
  }
  return `${startDay} ${startMonth} – ${endDay} ${endMonth}${yearSuffix}`;
}

/** Etykieta względna tygodnia: TEN TYDZIEŃ / POPRZEDNI TYDZIEŃ / null. */
export function formatHistoryWeekRelativeTag(
  monday: string,
  todayKey: string = calendarDateKey(),
): "TEN TYDZIEŃ" | "POPRZEDNI TYDZIEŃ" | null {
  const thisMonday = calendarWeekMondayKey(todayKey);
  if (monday === thisMonday) return "TEN TYDZIEŃ";
  if (monday === addCalendarDays(thisMonday, -7)) return "POPRZEDNI TYDZIEŃ";
  return null;
}

const PL_WEEKDAY_CAP = ["Nd", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"] as const;

/** Części daty karty: skrót dnia + „24.10” albo „Dziś”/„Wczoraj”. */
export function formatHistorySessionDateParts(
  ymd: string,
  todayKey: string = calendarDateKey(),
): { weekday: string; day: string; isRelative: boolean } {
  if (ymd === todayKey) {
    return { weekday: "Dziś", day: formatHistoryShortDate(ymd), isRelative: true };
  }
  if (ymd === addCalendarDays(todayKey, -1)) {
    return {
      weekday: "Wczoraj",
      day: formatHistoryShortDate(ymd),
      isRelative: true,
    };
  }
  const dow = calendarWeekdaySun0(ymd);
  return {
    weekday: PL_WEEKDAY_CAP[dow] ?? "",
    day: formatHistoryShortDate(ymd),
    isRelative: false,
  };
}

/** np. „Pt 02.10” (zachowane dla edycji / starszych wywołań). */
export function formatHistoryDayChip(ymd: string): string {
  const dow = calendarWeekdaySun0(ymd);
  const short = PL_WEEKDAY_SHORT[dow] ?? "";
  return `${short} ${formatHistoryShortDate(ymd)}`;
}

/** Tonaż sesji: kg do 9 999, powyżej w tonach. */
export function formatHistoryKg(volumeKg: number): string {
  const kg = Math.max(0, Math.round(volumeKg));
  if (kg > 9999) return formatTonnes(kg);
  return `${new Intl.NumberFormat("pl-PL", {
    maximumFractionDigits: 0,
  }).format(kg)} kg`;
}

export function formatHistoryExercisesLabel(n: number): string {
  if (n === 1) return "1 ćw.";
  return `${n} ćw.`;
}

export function formatSetsLabel(n: number): string {
  if (n === 1) return "1 seria";
  if (n >= 2 && n <= 4) return `${n} serie`;
  return `${n} serii`;
}

/** Limit poprawy sesji — 7 dni od endedAt. */
export const WORKOUT_EDIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function workoutEditDeadlineMs(endedAt: number | null, dateYmd: string): number {
  if (endedAt != null && Number.isFinite(endedAt)) {
    return endedAt + WORKOUT_EDIT_WINDOW_MS;
  }
  const dayEnd = new Date(`${dateYmd}T23:59:59`).getTime();
  return (Number.isFinite(dayEnd) ? dayEnd : Date.now()) + WORKOUT_EDIT_WINDOW_MS;
}

export function canEditWorkout(endedAt: number | null, dateYmd: string, now = Date.now()): boolean {
  return now <= workoutEditDeadlineMs(endedAt, dateYmd);
}

export function formatEditDeadline(ms: number): string {
  try {
    const d = new Date(ms);
    const day = new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
    }).format(d);
    const time = new Intl.DateTimeFormat("pl-PL", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
    return `${day}, ${time}`;
  } catch {
    return "—";
  }
}

/** Agregacja KPI z kart historii — ta sama funkcja na serwerze i w kliencie (filtr). */
export function computeHistoryKpis(
  cards: WorkoutHistoryCard[],
  todayKey: string = calendarDateKey(),
): WorkoutHistoryKpis {
  const since30 = addCalendarDays(todayKey, -29);
  const weekMonday = calendarWeekMondayKey(todayKey);
  const weekSunday = addCalendarDays(weekMonday, 6);
  const since8w = addCalendarDays(todayKey, -55);

  let workoutsLast30 = 0;
  let tonnageLast30Kg = 0;
  let workoutsThisWeek = 0;
  let tonnageThisWeekKg = 0;
  let tonnageTotalKg = 0;
  let durationSum = 0;
  let durationCount = 0;
  let workoutsLast8Weeks = 0;
  const activePlanKeys = new Set<string>();

  for (const c of cards) {
    tonnageTotalKg += c.volumeKg;
    if (c.date >= since30) {
      workoutsLast30 += 1;
      tonnageLast30Kg += c.volumeKg;
    }
    if (c.date >= since8w) {
      workoutsLast8Weeks += 1;
    }
    if (c.date >= weekMonday && c.date <= weekSunday) {
      workoutsThisWeek += 1;
      tonnageThisWeekKg += c.volumeKg;
    }
    if (c.durationMinutes != null) {
      durationSum += c.durationMinutes;
      durationCount += 1;
    }
    activePlanKeys.add(c.planCompareKey);
  }

  const avgDurationMinutes =
    durationCount > 0 ? Math.round(durationSum / durationCount) : null;
  const avgWorkoutsPerWeekLast8 =
    Math.round((workoutsLast8Weeks / 8) * 10) / 10;
  const planDaysActive = activePlanKeys.size;

  return {
    workoutsLast30,
    tonnageLast30Kg,
    cardioMinutesLast30: 0,
    cardioEntriesLast30: 0,
    planDaysActive,
    planDaysTotal: planDaysActive,
    workoutsTotal: cards.length,
    lastWorkoutDate: cards[0]?.date ?? null,
    workoutsThisWeek,
    avgDurationMinutes,
    tonnageThisWeekKg,
    avgWorkoutsPerWeekLast8,
    tonnageTotalKg,
  };
}

function safePlanNameFromJson(planJson: string | null): string | null {
  if (!planJson) return null;
  try {
    const o = JSON.parse(planJson) as unknown;
    if (!o || typeof o !== "object") return null;
    const r = o as Record<string, unknown>;
    const planName = String(r.planName ?? "").trim();
    if (planName.length) return planName;
    const name = String(r.name ?? "").trim();
    return name.length ? name : null;
  } catch {
    return null;
  }
}

function parseSession(json: string): SessionJson | null {
  try {
    return JSON.parse(json) as SessionJson;
  } catch {
    return null;
  }
}

function countSets(details: CompletedWorkoutDetails) {
  let done = 0;
  let total = 0;
  for (const ex of details.exercises) {
    for (const s of ex.sets) {
      total += 1;
      // done już oznacza wykonanie (pominięte mają done=false w computeWorkoutDetails)
      if (s.done && !s.skipped) done += 1;
    }
  }
  return { done, total };
}

/** Dane pod ekran historii w stylu kart KPI + lista z porównaniem. */
export async function getWorkoutHistoryOverview(
  userId: string,
): Promise<WorkoutHistoryOverview> {
  const db = getDb();
  const today = calendarDateKey();
  const since30 = addCalendarDays(today, -29);

  const planRows = await db
    .select({ id: workoutPlans.id, planJson: workoutPlans.planJson })
    .from(workoutPlans)
    .where(eq(workoutPlans.userId, userId));

  const planDaysTotal = planRows.length;

  const rows = await db
    .select({
      id: workouts.id,
      date: workouts.date,
      workoutPlanId: workouts.workoutPlanId,
      cardioMinutes: workouts.cardioMinutes,
      exercisesJson: workouts.exercises,
      planJson: workoutPlans.planJson,
    })
    .from(workouts)
    .leftJoin(workoutPlans, eq(workouts.workoutPlanId, workoutPlans.id))
    .where(eq(workouts.userId, userId))
    .orderBy(desc(workouts.date), desc(workouts.id))
    .limit(400);

  const strengthDetails: CompletedWorkoutDetails[] = [];
  const cardio: WorkoutHistoryCardioItem[] = [];
  const cardioMinutesByWorkoutId = new Map<string, number>();
  let cardioMinutesLast30 = 0;
  let cardioEntriesLast30 = 0;

  for (const r of rows) {
    const parsed = parseSession(r.exercisesJson);
    const minutesCol = Math.max(0, r.cardioMinutes ?? 0);

    if (isStandaloneCardioLog(parsed, minutesCol)) {
      const title =
        typeof parsed?.title === "string" && parsed.title.trim()
          ? parsed.title.trim()
          : "Cardio";
      const avgHrRaw = parsed?.avgHr ?? parsed?.heartRate ?? null;
      const avgHr =
        typeof avgHrRaw === "number" && Number.isFinite(avgHrRaw) && avgHrRaw > 0
          ? Math.round(avgHrRaw)
          : null;
      const isCardioLogKind = parsed?.kind === "cardio_log";
      cardio.push({
        id: r.id,
        date: r.date,
        title,
        minutes: minutesCol,
        avgHr,
        kind: isCardioLogKind ? "cardio_log" : "post_strength",
      });
      const counted = countableCardioMinutes(parsed, minutesCol);
      if (r.date >= since30 && counted > 0) {
        cardioMinutesLast30 += counted;
        cardioEntriesLast30 += 1;
      }
      continue;
    }

    const planName = safePlanNameFromJson(r.planJson ?? null);
    const details = computeWorkoutDetails({
      id: r.id,
      date: r.date,
      rawJson: r.exercisesJson,
      workoutPlanId: r.workoutPlanId ?? null,
      planName,
    });
    if (!details) continue;
    strengthDetails.push(details);

    if (isCompletedStrengthSession(parsed) && minutesCol > 0) {
      cardioMinutesByWorkoutId.set(r.id, minutesCol);
      cardio.push({
        id: `${r.id}-post-cardio`,
        date: r.date,
        title: `${details.title} · cardio`,
        minutes: minutesCol,
        avgHr: null,
        kind: "post_strength",
      });
      if (r.date >= since30) {
        cardioMinutesLast30 += minutesCol;
        cardioEntriesLast30 += 1;
      }
    }
  }

  // Chronologicznie rosnąco do znajdowania poprzedniej sesji planu.
  const chronological = [...strengthDetails].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    return (a.endedAt ?? a.startedAt ?? 0) - (b.endedAt ?? b.startedAt ?? 0);
  });

  const prevByPlan = new Map<string, CompletedWorkoutDetails>();
  const prevAnyByDate = new Map<string, CompletedWorkoutDetails>();
  const occurrenceByPlan = new Map<string, number>();
  const bestE1rmByExercise = new Map<string, number>();
  const cardById = new Map<string, WorkoutHistoryCard>();

  for (const w of chronological) {
    // Wyłącznie w obrębie tego samego dnia planu (Nogi↔Nogi, Push↔Push).
    const planKey = workoutPlanCompareKey({
      workoutPlanId: w.workoutPlanId,
      planName: w.planName,
      title: w.title,
    });
    const planLabel = workoutPlanDisplayLabel({
      planName: w.planName,
      title: w.title,
    });
    const planOccurrence = (occurrenceByPlan.get(planKey) ?? 0) + 1;
    occurrenceByPlan.set(planKey, planOccurrence);
    const previous = prevByPlan.get(planKey) ?? null;
    const compare = compareWorkoutExercises(w, previous);
    const volumeDeltaPercent =
      previous != null ? deltaPercent(w.volumeKg, previous.volumeKg) : null;
    const volumeDeltaKg =
      previous != null &&
      Number.isFinite(w.volumeKg) &&
      Number.isFinite(previous.volumeKg)
        ? w.volumeKg - previous.volumeKg
        : null;
    const sameDayEarlier = prevAnyByDate.get(w.date) != null;
    const firstOfDay = !sameDayEarlier;
    const noComparison = previous == null;
    const sets = countSets(w);

    const exercisePreviews: WorkoutHistoryExercisePreview[] = w.exercises.map(
      (ex) => {
        const key = normalizeName(ex.name);
        const priorBest = bestE1rmByExercise.get(key) ?? 0;
        const doneSets = ex.sets.filter((s) => s.done);
        const isBodyweight =
          doneSets.length > 0 &&
          ex.volumeKg === 0 &&
          doneSets.every((s) => s.weight === 0);
        return {
          id: ex.id,
          name: ex.name,
          volumeKg: ex.volumeKg,
          isBodyweight,
          sets: ex.sets.map((s) => ({
            reps: s.reps,
            weight: s.weight,
            done: s.done,
            // Pierwszy wpis ćwiczenia nie jest PR; PR = przebicie wcześniejszego bestu.
            isPr:
              s.done && s.e1rm > 0 && priorBest > 0 && s.e1rm > priorBest + 0.25,
          })),
        };
      },
    );

    // Aktualizuj best e1RM po sesji (kolejne treningi mogą dostać PR).
    for (const ex of w.exercises) {
      const key = normalizeName(ex.name);
      const prevBest = bestE1rmByExercise.get(key) ?? 0;
      if (ex.bestE1rm > prevBest) bestE1rmByExercise.set(key, ex.bestE1rm);
    }

    cardById.set(w.id, {
      id: w.id,
      date: w.date,
      title: w.title,
      planName: w.planName,
      planCompareKey: planKey,
      planLabel,
      workoutPlanId: w.workoutPlanId,
      volumeKg: w.volumeKg,
      volumeDeltaPercent,
      volumeDeltaKg,
      compare,
      firstOfDay,
      noComparison,
      prevDate: previous?.date ?? null,
      exerciseCount: w.exercises.length,
      setsDone: sets.done,
      setsTotal: sets.total,
      cardioMinutes: cardioMinutesByWorkoutId.get(w.id) ?? 0,
      durationMinutes: durationMinutesFromDetails(w),
      endedAt: w.endedAt ?? null,
      planOccurrence,
      exercises: exercisePreviews,
    });

    prevByPlan.set(planKey, w);
    prevAnyByDate.set(w.date, w);
  }

  const cards = strengthDetails
    .map((w) => cardById.get(w.id)!)
    .filter(Boolean);

  const planFiltersMap = new Map<string, { id: string; label: string; count: number }>();
  for (const c of cards) {
    const existing = planFiltersMap.get(c.planCompareKey);
    if (existing) existing.count += 1;
    else
      planFiltersMap.set(c.planCompareKey, {
        id: c.planCompareKey,
        label: c.planLabel,
        count: 1,
      });
  }

  // Dni planu w ruchu = unikalne dni planu z historią (nie mieszać Push z Nogami).
  const planDaysFromCatalog = new Set(
    planRows
      .map((r) => {
        const name = safePlanNameFromJson(r.planJson ?? null);
        return name
          ? workoutPlanCompareKey({ planName: name, workoutPlanId: r.id })
          : workoutPlanCompareKey({ workoutPlanId: r.id });
      })
      .filter(Boolean),
  );
  const baseKpis = computeHistoryKpis(cards, today);
  const planDaysTotalResolved = Math.max(
    planDaysFromCatalog.size,
    planDaysTotal,
    baseKpis.planDaysActive,
  );

  return {
    kpis: {
      ...baseKpis,
      cardioMinutesLast30,
      cardioEntriesLast30,
      planDaysTotal: planDaysTotalResolved,
    },
    cards,
    cardio: cardio.slice(0, 30),
    planFilters: Array.from(planFiltersMap.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label, "pl");
    }),
    sessionsLimitReached: rows.length === 400,
  };
}
