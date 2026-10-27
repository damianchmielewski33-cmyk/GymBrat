import { withApiErrors } from "@/lib/errors/api";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { workoutPlans } from "@/db/schema";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import {
  MAX_EXERCISES_PER_PLAN,
  MAX_PLANS_PER_USER,
  validateWorkoutPlanPayload,
} from "@/lib/workout-plan/plan-validation";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const confirmSchema = z.object({
  days: z
    .array(
      z.object({
        version: z.literal(2),
        path: z.literal("custom"),
        planName: z.string(),
        exercises: z.array(z.unknown()).max(MAX_EXERCISES_PER_PLAN),
        userCustomExerciseNames: z.array(z.string()).optional(),
      }),
    )
    .min(1)
    .max(MAX_PLANS_PER_USER),
});

async function handlePOST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Brak sesji." }, { status: 401 });
  }

  const rl = await checkRateLimitAsync(
    rateLimitKey("workout-plan-import-confirm", req),
    RATE.workoutPlanImport.limit,
    RATE.workoutPlanImport.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Zbyt wiele prób. Spróbuj za chwilę." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Nieprawidłowy JSON." },
      { status: 400 },
    );
  }

  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Zaznacz co najmniej jeden dzień do zapisu." },
      { status: 400 },
    );
  }

  const plans = [];
  for (const day of parsed.data.days) {
    const validated = validateWorkoutPlanPayload({
      ...day,
      userCustomExerciseNames: day.userCustomExerciseNames ?? [],
    });
    if (!validated.ok) {
      return NextResponse.json(
        { ok: false, error: validated.error },
        { status: 400 },
      );
    }
    plans.push(validated.plan);
  }

  const db = getDb();
  const userId = session.user.id;
  const now = new Date();
  const insertedIds: string[] = [];

  for (const plan of plans) {
    const id = crypto.randomUUID();
    await db.insert(workoutPlans).values({
      id,
      userId,
      planJson: JSON.stringify(plan),
      createdAt: now,
      updatedAt: now,
    });
    insertedIds.push(id);
  }

  revalidatePath("/plany");
  revalidatePath("/workout-plan");
  revalidatePath("/");

  return NextResponse.json({
    ok: true,
    imported: insertedIds.length,
    ids: insertedIds,
  });
}

export const POST = withApiErrors(handlePOST);
