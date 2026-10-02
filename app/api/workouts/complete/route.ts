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
};

const setSchema = z.object({
  reps: z.preprocess(
    preprocessReps,
    z.number().int().min(0).max(500).nullable().optional(),
  ),
  weight: z.preprocess(preprocessWeightKg, z.number().min(0).max(2000)),
  done: z.boolean().optional(),
  rpe: z.union([z.number().finite().min(1).max(10), z.null()]).optional(),
});

const exerciseSchema = z.object({
  id: z.string().max(128).nullish(),
  name: z.string().max(500).nullish(),
  note: z.string().max(4000).nullish(),
  sets: z.array(setSchema).min(0).max(200),
});

const bodySchema = z.object({
  title: z.string().min(0).max(200).optional().nullable(),
  startedAt: z.number().finite().optional().nullable(),
  endedAt: z.number().finite().optional().nullable(),
  cardioMinutes: z.number().finite().min(0).max(24 * 60).optional().nullable(),
  workoutPlanId: z.string().min(1).max(128).optional().nullable(),
  exercises: z.array(exerciseSchema).max(200).optional().nullable(),
});

function parseCompletedWorkout(json: string): {
  kind?: string;
  startedAt?: number;
  exercises?: unknown;
} | null {
  try {
    const o = JSON.parse(json) as unknown;
    if (!o || typeof o !== "object") return null;
    return o as { kind?: string; startedAt?: number; exercises?: unknown };
  } catch {
    return null;
  }
}

function safeSessionVolume(exercises: unknown): number {
  if (!Array.isArray(exercises)) return 0;
  return sessionVolume(
    exercises as ReadonlyArray<{
      sets: ReadonlyArray<{ reps: number | null; weight: number }>;
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

export async function POST(req: Request) {
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
      }
      return passThroughJavaResponse(javaRes);
    }
  }

  const title = String(parsed.data.title ?? "Sesja").trim() || "Sesja";
  const cardioMinutes = Number(parsed.data.cardioMinutes ?? 0);
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

  // Strength proxy + pełne porównanie vs poprzedni trening z tego samego planu.
  let strengthDeltaPercent: number | null = null;
  let planCompare: WorkoutPlanComparePayload | null = null;
  const currentVol = safeSessionVolume(parsed.data.exercises ?? null);
  const currentStartedAtMs = startedAt.getTime();
  const currentJson = completedSessionJsonForCompare({
    title,
    startedAtMs: currentStartedAtMs,
    endedAtMs: endedAt.getTime(),
    workoutPlanId: rawPlanId,
    exercises: parsed.data.exercises ?? null,
    cardioMinutes,
  });

  if (rawPlanId) {
    const [planRow] = await db
      .select({ planJson: workoutPlans.planJson })
      .from(workoutPlans)
      .where(and(eq(workoutPlans.id, rawPlanId), eq(workoutPlans.userId, session.user.id)))
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
      .select({ exercises: workouts.exercises, date: workouts.date })
      .from(workouts)
      .where(and(eq(workouts.userId, session.user.id), eq(workouts.workoutPlanId, rawPlanId)))
      .orderBy(desc(workouts.date))
      .limit(12);

    let prevJson: string | null = null;
    let prevDate: string | null = null;
    let prevVol: number | null = null;
    for (const r of recent) {
      const prevParsed = parseCompletedWorkout(r.exercises);
      if (!prevParsed || prevParsed.kind !== "completed_session") continue;
      const prevStartedAtMs =
        typeof prevParsed.startedAt === "number" ? prevParsed.startedAt : null;
      if (prevStartedAtMs == null || !Number.isFinite(prevStartedAtMs)) continue;
      if (prevStartedAtMs >= currentStartedAtMs) continue;
      prevJson = r.exercises;
      prevDate = dateKeyFromStartedAt(prevStartedAtMs, new Date(`${r.date}T12:00:00`));
      prevVol = safeSessionVolume(prevParsed.exercises);
      break;
    }

    if (prevVol != null) {
      strengthDeltaPercent = deltaPct(currentVol, prevVol);
    }

    planCompare = buildWorkoutPlanCompare({
      currentExercisesJson: currentJson,
      previousExercisesJson: prevJson,
      currentDate: calendarDateKey(startedAt),
      previousDate: prevDate,
      workoutPlanId: rawPlanId,
      planLabel,
    });
  } else {
    planCompare = buildWorkoutPlanCompare({
      currentExercisesJson: currentJson,
      previousExercisesJson: null,
      currentDate: calendarDateKey(startedAt),
      previousDate: null,
      workoutPlanId: null,
      planLabel: title,
    });
  }

  const dateKey = calendarDateKey(startedAt);
  await db.insert(workouts).values({
    userId: session.user.id,
    workoutPlanId: rawPlanId,
    date: dateKey,
    cardioMinutes: Math.max(0, Math.round(cardioMinutes)),
    exercises: currentJson,
  });

  revalidatePath("/");
  revalidatePath("/reports");
  revalidatePath("/active-workout");
  revalidatePath("/workout-history");

  return NextResponse.json({ ok: true, strengthDeltaPercent, planCompare });
}

