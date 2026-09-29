import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workoutPlans, workouts } from "@/db/schema";
import { addCalendarDays, calendarDateKey } from "@/lib/local-date";
import {
  computeWorkoutDetails,
  deltaPercent,
  type CompletedWorkoutDetails,
} from "@/lib/workout-history";
import {
  workoutPlanCompareKey,
  workoutPlanDisplayLabel,
} from "@/lib/workout-plan-compare-key";

export type WorkoutHistoryKpis = {
  workoutsLast30: number;
  tonnageLast30Kg: number;
  cardioMinutesLast30: number;
  cardioEntriesLast30: number;
  planDaysActive: number;
  planDaysTotal: number;
  workoutsTotal: number;
  lastWorkoutDate: string | null;
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
};

export type WorkoutHistoryCardioItem = {
  id: string;
  date: string;
  title: string;
  minutes: number;
  avgHr: number | null;
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

function isCardioLog(parsed: SessionJson | null, cardioMinutes: number): boolean {
  if (parsed?.kind === "cardio_log") return true;
  return cardioMinutes > 0 && (!parsed?.exercises || !Array.isArray(parsed.exercises) || parsed.exercises.length === 0);
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
  let cardioMinutesLast30 = 0;
  let cardioEntriesLast30 = 0;

  for (const r of rows) {
    const parsed = parseSession(r.exercisesJson);
    if (isCardioLog(parsed, r.cardioMinutes ?? 0)) {
      const minutes = Math.max(0, r.cardioMinutes ?? 0);
      const title =
        typeof parsed?.title === "string" && parsed.title.trim()
          ? parsed.title.trim()
          : "Cardio";
      const avgHrRaw = parsed?.avgHr ?? parsed?.heartRate ?? null;
      const avgHr =
        typeof avgHrRaw === "number" && Number.isFinite(avgHrRaw) && avgHrRaw > 0
          ? Math.round(avgHrRaw)
          : null;
      cardio.push({ id: r.id, date: r.date, title, minutes, avgHr });
      if (r.date >= since30) {
        cardioMinutesLast30 += minutes;
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
  }

  // Chronologicznie rosnąco do znajdowania poprzedniej sesji planu.
  const chronological = [...strengthDetails].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    return (a.endedAt ?? a.startedAt ?? 0) - (b.endedAt ?? b.startedAt ?? 0);
  });

  const prevByPlan = new Map<string, CompletedWorkoutDetails>();
  const prevAnyByDate = new Map<string, CompletedWorkoutDetails>();
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
    });

    prevByPlan.set(planKey, w);
    prevAnyByDate.set(w.date, w);
  }

  const cards = strengthDetails
    .map((w) => cardById.get(w.id)!)
    .filter(Boolean);

  let workoutsLast30 = 0;
  let tonnageLast30Kg = 0;
  const activePlanKeys = new Set<string>();
  for (const c of cards) {
    if (c.date >= since30) {
      workoutsLast30 += 1;
      tonnageLast30Kg += c.volumeKg;
    }
    activePlanKeys.add(c.planCompareKey);
  }

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
    },
    cards,
    cardio: cardio.slice(0, 30),
    planFilters: Array.from(planFiltersMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "pl"),
    ),
  };
}
