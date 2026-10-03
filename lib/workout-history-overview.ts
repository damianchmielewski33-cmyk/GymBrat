import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workoutPlans, workouts } from "@/db/schema";
import {
  addCalendarDays,
  calendarDateKey,
  calendarWeekdaySun0,
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

function mondayOfWeek(dateKey: string): string {
  const dow = calendarWeekdaySun0(dateKey);
  const offset = dow === 0 ? -6 : 1 - dow;
  return addCalendarDays(dateKey, offset);
}

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
  sets: WorkoutHistorySetPill[];
};

export type WorkoutHistoryExerciseCompare = {
  up: number;
  down: number;
  skipped: number;
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
};

type SessionJson = {
  kind?: string;
  title?: string;
  avgHr?: number | null;
  heartRate?: number | null;
  exercises?: unknown;
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
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
    if (curVol > prevVol + 0.5) up += 1;
    else if (curVol < prevVol - 0.5) down += 1;
  }

  for (const [key, prev] of prevByName) {
    if (seen.has(key)) continue;
    if (exerciseDone(prev)) skipped += 1;
  }

  return { up, down, skipped };
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
      if (s.done) done += 1;
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
        return {
          id: ex.id,
          name: ex.name,
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
      exercises: exercisePreviews,
    });

    prevByPlan.set(planKey, w);
    prevAnyByDate.set(w.date, w);
  }

  const cards = strengthDetails
    .map((w) => cardById.get(w.id)!)
    .filter(Boolean);

  const weekMonday = mondayOfWeek(today);
  const weekSunday = addCalendarDays(weekMonday, 6);

  let workoutsLast30 = 0;
  let tonnageLast30Kg = 0;
  let workoutsThisWeek = 0;
  let tonnageThisWeekKg = 0;
  let durationSum = 0;
  let durationCount = 0;
  const activePlanKeys = new Set<string>();
  for (const c of cards) {
    if (c.date >= since30) {
      workoutsLast30 += 1;
      tonnageLast30Kg += c.volumeKg;
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
  const planDaysActive = activePlanKeys.size;
  const planDaysTotalResolved = Math.max(
    planDaysFromCatalog.size,
    planDaysTotal,
    planDaysActive,
  );

  return {
    kpis: {
      workoutsLast30,
      tonnageLast30Kg,
      cardioMinutesLast30,
      cardioEntriesLast30,
      planDaysActive,
      planDaysTotal: planDaysTotalResolved,
      workoutsTotal: cards.length,
      lastWorkoutDate: cards[0]?.date ?? null,
      workoutsThisWeek,
      avgDurationMinutes,
      tonnageThisWeekKg,
    },
    cards,
    cardio: cardio.slice(0, 30),
    planFilters: Array.from(planFiltersMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "pl"),
    ),
  };
}
