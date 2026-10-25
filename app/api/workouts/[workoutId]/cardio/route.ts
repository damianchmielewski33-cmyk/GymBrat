import { withApiErrors } from "@/lib/errors/api";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { workouts } from "@/db/schema";
import { patchCardioInCompletedSessionJson } from "@/lib/workout-plan-compare";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import { UserMessages } from "@/lib/user-facing-errors";
import { z } from "zod";

/**
 * Patch cardio po zapisie treningu (ADR 0004 p. 2, LR-4). Wartości absolutne (cały stan),
 * nie delty. Autoryzacja właściciela sprawdzana przed zapisem, 404 (nie 403) przy cudzym
 * rekordzie — zgodnie ze wzorcem `workoutPlanMismatch`/`cardio-photo`, żeby nie ujawniać
 * istnienia cudzego wiersza. Celowo bez proxy do Javy (Java nie ma trwałego magazynu
 * treningów — p. 9 ADR), działa wyłącznie przez Drizzle/TypeScript niezależnie od
 * `JAVA_API_BASE_URL`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ workoutId: string }> };

const cardioPatchSchema = z.object({
  cardioMinutes: z.number().finite().min(0).max(24 * 60),
  cardio: z
    .object({
      distanceKm: z.number().finite().min(0).max(500).nullable().optional(),
      avgHr: z.number().finite().min(0).max(250).nullable().optional(),
      maxHr: z.number().finite().min(0).max(250).nullable().optional(),
      calories: z.number().finite().min(0).max(20000).nullable().optional(),
      caloriesBurned: z.number().finite().min(0).max(20000).nullable().optional(),
      steps: z.number().finite().min(0).max(500000).nullable().optional(),
      paceMinPerKm: z.number().finite().min(0).max(120).nullable().optional(),
      cardioType: z
        .enum(["walk", "treadmill", "bike", "elliptical", "stairs", "run", "swim", "other"])
        .nullable()
        .optional(),
      effortScore: z.number().finite().min(1).max(10).nullable().optional(),
      heartRateZone: z.number().int().min(1).max(5).nullable().optional(),
    })
    .nullable()
    .optional(),
});

async function handlePATCH(req: Request, ctx: Ctx) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const rl = await checkRateLimitAsync(
    rateLimitKey("workout-cardio-patch", req),
    RATE.workoutCardioPatch.limit,
    RATE.workoutCardioPatch.windowMs,
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

  const { workoutId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: UserMessages.workoutJsonBroken },
      { status: 400 },
    );
  }

  const parsed = cardioPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: UserMessages.workoutCardioPatchInvalid },
      { status: 400 },
    );
  }

  const db = getDb();
  const [row] = await db
    .select({ id: workouts.id, userId: workouts.userId, exercises: workouts.exercises })
    .from(workouts)
    .where(eq(workouts.id, workoutId))
    .limit(1);

  // 404 (nie 403) przy cudzym rekordzie — nie ujawniamy, że wiersz istnieje (LR-4).
  if (!row || row.userId !== session.user.id) {
    return NextResponse.json(
      { ok: false, error: UserMessages.workoutNotFound },
      { status: 404 },
    );
  }

  const minutes = Math.max(0, Math.round(parsed.data.cardioMinutes));
  const nextExercisesJson = patchCardioInCompletedSessionJson(
    row.exercises,
    minutes > 0 ? parsed.data.cardio ?? null : null,
    minutes,
  );

  // Jeden `UPDATE` jednego wiersza na dwa pola naraz — atomowe z natury SQLite/libSQL,
  // bez narzutu `db.transaction` po HTTP (ADR p. 2, konsekwencje).
  await db
    .update(workouts)
    .set({ cardioMinutes: minutes, exercises: nextExercisesJson })
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, session.user.id)));

  revalidatePath("/reports");
  revalidatePath("/workout-history");

  return NextResponse.json({ ok: true, cardioMinutes: minutes });
}

export const PATCH = withApiErrors(handlePATCH);
