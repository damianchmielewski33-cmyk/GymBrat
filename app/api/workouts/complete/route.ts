import { withApiErrors } from "@/lib/errors/api";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { workoutPlans, workouts } from "@/db/schema";
import { calendarDateKey } from "@/lib/local-date";
import { sessionVolume } from "@/lib/workout-session-calculations";
import {
  buildWorkoutPlanCompare,
  completedSessionJsonForCompare,
  type WorkoutPlanComparePayload,
} from "@/lib/workout-plan-compare";
import { workoutPlanDisplayLabel } from "@/lib/workout-plan-compare-key";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import { UserMessages, workoutCompleteZodMessage } from "@/lib/user-facing-errors";
import { fetchJavaApi, isJavaApiEnabled, passThroughJavaResponse } from "@/lib/java-api";
import { z } from "zod";

/** UI / input HTML mogą dać ułamkowe powtórzenia — zapisujemy zaokrąglone całkowite. */
function preprocessReps(val: unknown): unknown {
  if (val === undefined) return undefined;
  if (val === null) return null;
  let n: number;
  if (typeof val === "string") {
    const t = String(val).replace(",", ".").trim();
    if (t === "") return null;
    n = Number(t);
  } else if (typeof val === "number") {
    n = val;
  } else {
    return null;
  }
  if (!Number.isFinite(n)) return null;
  return Math.min(500, Math.max(0, Math.round(n)));
}

function preprocessWeightKg(val: unknown): unknown {
  if (val === undefined || val === null) return 0;
  let n: number;
  if (typeof val === "string") {
    const t = String(val).replace(",", ".").replace(/\s/g, "").trim();
    if (t === "") return 0;
    n = Number(t);
  } else if (typeof val === "number") {
    n = val;
  } else {
    return 0;
  }
  if (!Number.isFinite(n)) return 0;
  return Math.min(2000, Math.max(0, n));
}

type CompletedWorkoutPayload = {
  title: string;
  startedAt?: number | null;
  endedAt?: number | null;
  cardioMinutes: number;
  exercises: unknown;
  workoutPlanId?: string | null;
  operationId: string;
};

const setSchema = z.object({
  reps: z.preprocess(
    preprocessReps,
    z.number().int().min(0).max(500).nullable().optional(),
  ),
  weight: z.preprocess(preprocessWeightKg, z.number().min(0).max(2000)),
  done: z.boolean().optional(),
  skipped: z.boolean().optional(),
  rpe: z.union([z.number().finite().min(1).max(10), z.null()]).optional(),
  rir: z.union([z.number().finite().min(0).max(5), z.null()]).optional(),
  /** Odpoczynek przed / po serii (s) — telemetria analityczna. */
  restSeconds: z
    .union([z.number().finite().min(0).max(3600), z.null()])
    .optional(),
  heartRate: z
    .union([z.number().finite().min(30).max(250), z.null()])
    .optional(),
  /** Czas od startu sesji w momencie zaliczenia serii. */
  elapsedSecondsAtCompletion: z
    .union([z.number().finite().min(0).max(24 * 3600), z.null()])
    .optional(),
});

const exerciseSchema = z.object({
  id: z.string().max(128).nullish(),
  name: z.string().max(500).nullish(),
  note: z.string().max(4000).nullish(),
  targetSets: z.number().int().min(1).max(20).nullish(),
  targetReps: z.number().int().min(1).max(99).nullish(),
  targetRir: z.union([z.number().finite().min(0).max(5), z.null()]).optional(),
  tempo: z.string().max(16).nullish(),
  sets: z.array(setSchema).min(0).max(200),
});

const bodySchema = z.object({
  title: z.string().min(0).max(200).optional().nullable(),
  startedAt: z.number().finite().optional().nullable(),
  endedAt: z.number().finite().optional().nullable(),
  cardioMinutes: z.number().finite().min(0).max(24 * 60).optional().nullable(),
  cardio: z
    .object({
      distanceKm: z.number().finite().min(0).max(500).nullable().optional(),
      avgHr: z.number().finite().min(0).max(250).nullable().optional(),
      maxHr: z.number().finite().min(0).max(250).nullable().optional(),
      calories: z.number().finite().min(0).max(20000).nullable().optional(),
      caloriesBurned: z
        .number()
        .finite()
        .min(0)
        .max(20000)
        .nullable()
        .optional(),
      steps: z.number().finite().min(0).max(500000).nullable().optional(),
      paceMinPerKm: z.number().finite().min(0).max(120).nullable().optional(),
      cardioType: z
        .enum([
          "walk",
          "treadmill",
          "bike",
          "elliptical",
          "stairs",
          "run",
          "swim",
          "other",
        ])
        .nullable()
        .optional(),
      effortScore: z
        .number()
        .finite()
        .min(1)
        .max(10)
        .nullable()
        .optional(),
      heartRateZone: z
        .number()
        .int()
        .min(1)
        .max(5)
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  workoutPlanId: z.string().min(1).max(128).optional().nullable(),
  exercises: z.array(exerciseSchema).max(200).optional().nullable(),
  /** Klucz idempotencji — jeden na sesję treningu, generowany przez klienta (LR-3). */
  operationId: z.string().uuid(),
});

function parseCompletedWorkout(json: string): {
  kind?: string;
  startedAt?: number;
  exercises?: unknown;
  title?: string;
} | null {
  try {
    const o = JSON.parse(json) as unknown;
    if (!o || typeof o !== "object") return null;
    return o as { kind?: string; startedAt?: number; exercises?: unknown; title?: string };
  } catch {
    return null;
  }
}

/** Rozpoznaje naruszenie unikalnego ograniczenia (SQLite/libSQL) przy wyścigu dwóch żądań z tym samym `operationId`. */
function isUniqueConstraintError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const message =
    "message" in err && typeof (err as { message: unknown }).message === "string"
      ? (err as { message: string }).message
      : "";
  const code = "code" in err ? String((err as { code: unknown }).code) : "";
  return (
    /UNIQUE constraint failed/i.test(message) ||
    code === "SQLITE_CONSTRAINT" ||
    code === "SQLITE_CONSTRAINT_UNIQUE"
  );
}

function safeSessionVolume(exercises: unknown): number {
  if (!Array.isArray(exercises)) return 0;
  return sessionVolume(
    exercises as ReadonlyArray<{
      sets: ReadonlyArray<{
        reps: number | null;
        weight: number;
        done?: boolean;
        skipped?: boolean;
      }>;
    }>,
  );
}

function deltaPct(current: number, prev: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(prev) || prev <= 0) return null;
  return ((current - prev) / prev) * 100;
}

function dateKeyFromStartedAt(startedAtMs: number | null | undefined, fallback: Date): string {
  if (startedAtMs != null && Number.isFinite(startedAtMs)) {
    return calendarDateKey(new Date(startedAtMs));
  }
  return calendarDateKey(fallback);
}

/**
 * Strength proxy + pełne porównanie vs poprzedni trening z tego samego planu.
 * Współdzielone przez ścieżkę normalnego zapisu i ścieżkę duplikatu (LR-3) — w obu
 * przypadkach wynik musi być deterministyczny i identyczny dla tych samych danych wejściowych.
 */
async function computePlanCompareResult(params: {
  db: ReturnType<typeof getDb>;
  userId: string;
  rawPlanId: string | null;
  title: string;
  currentJson: string;
  currentVol: number;
  currentStartedAtMs: number;
  /** Przy przeliczaniu dla już istniejącego wiersza (duplikat) wyklucza go z listy „poprzednich”. */
  excludeWorkoutId?: string;
}): Promise<{ strengthDeltaPercent: number | null; planCompare: WorkoutPlanComparePayload }> {
  const { db, userId, rawPlanId, title, currentJson, currentVol, currentStartedAtMs, excludeWorkoutId } =
    params;

  if (!rawPlanId) {
    return {
      strengthDeltaPercent: null,
      planCompare: buildWorkoutPlanCompare({
        currentExercisesJson: currentJson,
        previousExercisesJson: null,
        currentDate: calendarDateKey(new Date(currentStartedAtMs)),
        previousDate: null,
        workoutPlanId: null,
        planLabel: title,
      }),
    };
  }

  const [planRow] = await db
    .select({ planJson: workoutPlans.planJson })
    .from(workoutPlans)
    .where(and(eq(workoutPlans.id, rawPlanId), eq(workoutPlans.userId, userId)))
    .limit(1);

  let planNameFromJson: string | null = null;
  try {
    const o = JSON.parse(planRow?.planJson ?? "{}") as { planName?: unknown; name?: unknown };
    const n = String(o.planName ?? o.name ?? "").trim();
    planNameFromJson = n || null;
  } catch {
    planNameFromJson = null;
  }

  const planLabel = workoutPlanDisplayLabel({
    planName: planNameFromJson,
    title,
    workoutPlanId: rawPlanId,
  });

  const recent = await db
    .select({ id: workouts.id, exercises: workouts.exercises, date: workouts.date })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.workoutPlanId, rawPlanId)))
    .orderBy(desc(workouts.date))
    .limit(13);

  let prevJson: string | null = null;
  let prevDate: string | null = null;
  let prevVol: number | null = null;
  for (const r of recent) {
    if (excludeWorkoutId && r.id === excludeWorkoutId) continue;
    const prevParsed = parseCompletedWorkout(r.exercises);
    if (!prevParsed || prevParsed.kind !== "completed_session") continue;
    const prevStartedAtMs = typeof prevParsed.startedAt === "number" ? prevParsed.startedAt : null;
    if (prevStartedAtMs == null || !Number.isFinite(prevStartedAtMs)) continue;
    if (prevStartedAtMs >= currentStartedAtMs) continue;
    prevJson = r.exercises;
    prevDate = dateKeyFromStartedAt(prevStartedAtMs, new Date(`${r.date}T12:00:00`));
    prevVol = safeSessionVolume(prevParsed.exercises);
    break;
  }

  const strengthDeltaPercent = prevVol != null ? deltaPct(currentVol, prevVol) : null;
  const planCompare = buildWorkoutPlanCompare({
    currentExercisesJson: currentJson,
    previousExercisesJson: prevJson,
    currentDate: calendarDateKey(new Date(currentStartedAtMs)),
    previousDate: prevDate,
    workoutPlanId: rawPlanId,
    planLabel,
  });

  return { strengthDeltaPercent, planCompare };
}

/** Odpowiedź dla duplikatu (`operationId` już zapisany) — przelicza porównanie z wiersza, który już istnieje, bez drugiego `INSERT` i bez drugiej publikacji w feedzie (LR-3). */
async function respondWithExistingWorkout(
  db: ReturnType<typeof getDb>,
  userId: string,
  existingRow: {
    id: string;
    exercises: string;
    date: string;
    workoutPlanId: string | null;
  },
  requestedStartedAtMs: number,
) {
  const existingParsed = parseCompletedWorkout(existingRow.exercises);
  const title = (typeof existingParsed?.title === "string" ? existingParsed.title : "") || "Sesja";
  const startedAtMs =
    existingParsed && typeof existingParsed.startedAt === "number" && Number.isFinite(existingParsed.startedAt)
      ? existingParsed.startedAt
      : new Date(`${existingRow.date}T12:00:00`).getTime();

  // Defense in depth (005, B-1b): operationId identyczny, ale startedAt różny o więcej niż
  // tolerancję zegara/zaokrąglenia -> to nie jest retry TEGO SAMEGO zapisu, to kolizja
  // identyfikatora między dwiema różnymi sesjami. Nie udawaj sukcesu — zwróć konflikt.
  if (Math.abs(startedAtMs - requestedStartedAtMs) > 2000) {
    return NextResponse.json(
      { ok: false, error: UserMessages.workoutOperationConflict, conflict: true },
      { status: 409 },
    );
  }

  const currentVol = safeSessionVolume(existingParsed?.exercises ?? null);

  const { strengthDeltaPercent, planCompare } = await computePlanCompareResult({
    db,
    userId,
    rawPlanId: existingRow.workoutPlanId,
    title,
    currentJson: existingRow.exercises,
    currentVol,
    currentStartedAtMs: startedAtMs,
    excludeWorkoutId: existingRow.id,
  });

  return NextResponse.json({
    ok: true,
    workoutId: existingRow.id,
    strengthDeltaPercent,
    planCompare,
    duplicate: true,
  });
}

async function handlePOST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const rl = await checkRateLimitAsync(
    rateLimitKey("workout-complete", req),
    RATE.workoutComplete.limit,
    RATE.workoutComplete.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: UserMessages.rateLimited },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: UserMessages.sessionExpired },
      { status: 401 },
    );
  }

  let body: CompletedWorkoutPayload;
  try {
    body = (await req.json()) as CompletedWorkoutPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: UserMessages.workoutJsonBroken },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: workoutCompleteZodMessage(parsed.error) },
      { status: 400 },
    );
  }

  if (isJavaApiEnabled()) {
    const javaRes = await fetchJavaApi("/api/workouts/complete", {
      method: "POST",
      userId: session.user.id,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (javaRes) {
      if (javaRes.ok) {
        revalidatePath("/");
        revalidatePath("/reports");
        revalidatePath("/active-workout");
        revalidatePath("/workout-history");
        revalidatePath("/workout-plan");
        revalidatePath("/progress");
      }
      return passThroughJavaResponse(javaRes);
    }
  }

  const title = String(parsed.data.title ?? "Sesja").trim() || "Sesja";
  const cardioMinutes = Number(parsed.data.cardioMinutes ?? 0);
  const cardioExtras = parsed.data.cardio ?? null;
  const startedAt = typeof parsed.data.startedAt === "number"
    ? new Date(parsed.data.startedAt)
    : new Date();
  const endedAt = typeof parsed.data.endedAt === "number"
    ? new Date(parsed.data.endedAt)
    : new Date();

  const rawPlanId =
    typeof parsed.data.workoutPlanId === "string" && parsed.data.workoutPlanId.trim().length > 0
      ? parsed.data.workoutPlanId.trim()
      : null;
  const operationId = parsed.data.operationId;

  const db = getDb();
  if (rawPlanId) {
    const [owned] = await db
      .select({ id: workoutPlans.id })
      .from(workoutPlans)
      .where(and(eq(workoutPlans.id, rawPlanId), eq(workoutPlans.userId, session.user.id)))
      .limit(1);
    if (!owned) {
      return NextResponse.json(
        { ok: false, error: UserMessages.workoutPlanMismatch },
        { status: 400 },
      );
    }
  }

  // Dedup idempotencji (LR-3): ten sam operationId już zapisany — zwróć wynik pierwszego
  // zapisu (przeliczony, bez snapshotu), bez drugiego INSERT i bez drugiej publikacji w feedzie.
  const [existingByOperation] = await db
    .select({
      id: workouts.id,
      exercises: workouts.exercises,
      date: workouts.date,
      workoutPlanId: workouts.workoutPlanId,
    })
    .from(workouts)
    .where(and(eq(workouts.userId, session.user.id), eq(workouts.operationId, operationId)))
    .limit(1);
  const currentStartedAtMs = startedAt.getTime();
  if (existingByOperation) {
    return respondWithExistingWorkout(db, session.user.id, existingByOperation, currentStartedAtMs);
  }

  // Strength proxy + pełne porównanie vs poprzedni trening z tego samego planu.
  const currentVol = safeSessionVolume(parsed.data.exercises ?? null);
  const currentJson = completedSessionJsonForCompare({
    title,
    startedAtMs: currentStartedAtMs,
    endedAtMs: endedAt.getTime(),
    workoutPlanId: rawPlanId,
    exercises: parsed.data.exercises ?? null,
    cardioMinutes,
    cardio: cardioMinutes > 0 ? cardioExtras : null,
  });

  const { strengthDeltaPercent, planCompare } = await computePlanCompareResult({
    db,
    userId: session.user.id,
    rawPlanId,
    title,
    currentJson,
    currentVol,
    currentStartedAtMs,
  });

  const dateKey = calendarDateKey(startedAt);
  const workoutId = crypto.randomUUID();
  try {
    await db.insert(workouts).values({
      id: workoutId,
      userId: session.user.id,
      workoutPlanId: rawPlanId,
      date: dateKey,
      cardioMinutes: Math.max(0, Math.round(cardioMinutes)),
      exercises: currentJson,
      operationId,
    });
  } catch (err) {
    // Wyścig dwóch równoczesnych żądań z tym samym operationId (np. dwa urządzenia/zakładki) —
    // unikalny indeks (userId, operationId) jest siecią bezpieczeństwa (LR-3, ADR p.1 krok 4).
    if (isUniqueConstraintError(err)) {
      const [raceRow] = await db
        .select({
          id: workouts.id,
          exercises: workouts.exercises,
          date: workouts.date,
          workoutPlanId: workouts.workoutPlanId,
        })
        .from(workouts)
        .where(and(eq(workouts.userId, session.user.id), eq(workouts.operationId, operationId)))
        .limit(1);
      if (raceRow) {
        return respondWithExistingWorkout(db, session.user.id, raceRow, currentStartedAtMs);
      }
    }
    throw err;
  }

  const { publishTeamFeedAfterWorkout } = await import(
    "@/lib/community/team-feed-auto"
  );
  void publishTeamFeedAfterWorkout({
    userId: session.user.id,
    workoutId,
    title,
    dateKey,
    cardioMinutes: Math.max(0, Math.round(cardioMinutes)),
    exercisesJson: currentJson,
    planCompare,
  });

  revalidatePath("/");
  revalidatePath("/reports");
  revalidatePath("/active-workout");
  revalidatePath("/workout-history");
  revalidatePath("/community/teams");

  return NextResponse.json({
    ok: true,
    workoutId,
    strengthDeltaPercent,
    planCompare,
    duplicate: false,
  });
}

export const POST = withApiErrors(handlePOST);
