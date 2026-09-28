import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { workouts } from "@/db/schema";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import { isWorkoutEditable } from "@/lib/workout-edit-window";
import { UserMessages } from "@/lib/user-facing-errors";

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

const setSchema = z.object({
  reps: z.preprocess(
    preprocessReps,
    z.number().int().min(0).max(500).nullable().optional(),
  ),
  weight: z.preprocess(preprocessWeightKg, z.number().min(0).max(2000)),
  done: z.boolean().optional(),
  rpe: z.union([z.number().finite().min(1).max(10), z.null()]).optional(),
  rir: z.union([z.number().finite().min(0).max(5), z.null()]).optional(),
  tempo: z.union([z.string().max(32), z.null()]).optional(),
});

const exerciseSchema = z.object({
  id: z.string().max(128).nullish(),
  name: z.string().max(500).nullish(),
  note: z.string().max(4000).nullish(),
  tempo: z.union([z.string().max(32), z.null()]).optional(),
  videoUrl: z.union([z.string().max(2000), z.null()]).optional(),
  catalogId: z.union([z.string().max(128), z.null()]).optional(),
  supersetGroupId: z.union([z.string().max(128), z.null()]).optional(),
  sets: z.array(setSchema).min(0).max(200),
});

const bodySchema = z.object({
  title: z.string().min(0).max(200).optional().nullable(),
  cardioMinutes: z.number().finite().min(0).max(24 * 60).optional().nullable(),
  exercises: z.array(exerciseSchema).max(200),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, error: UserMessages.sessionExpired }, { status: 401 });
  }

  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const rl = await checkRateLimitAsync(
    rateLimitKey("workout-edit", req),
    RATE.workoutComplete.limit,
    RATE.workoutComplete.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: UserMessages.rateLimited },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ ok: false, error: "Brak id treningu" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Nieprawidłowy JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Nieprawidłowe dane treningu" },
      { status: 400 },
    );
  }

  const db = getDb();
  const [row] = await db
    .select({
      id: workouts.id,
      date: workouts.date,
      exercises: workouts.exercises,
      workoutPlanId: workouts.workoutPlanId,
      cardioMinutes: workouts.cardioMinutes,
    })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.id, id)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ ok: false, error: "Nie znaleziono treningu" }, { status: 404 });
  }

  if (!isWorkoutEditable(row.date)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Edycja możliwa tylko do 7 dni od daty treningu",
      },
      { status: 403 },
    );
  }

  let previous: Record<string, unknown> = {};
  try {
    const o = JSON.parse(row.exercises) as unknown;
    if (o && typeof o === "object") previous = o as Record<string, unknown>;
  } catch {
    previous = { kind: "completed_session" };
  }

  const title =
    parsed.data.title?.trim() ||
    (typeof previous.title === "string" ? previous.title : "Trening");

  const nextPayload = {
    ...previous,
    kind: "completed_session",
    title,
    exercises: parsed.data.exercises,
    editedAt: Date.now(),
  };

  await db
    .update(workouts)
    .set({
      exercises: JSON.stringify(nextPayload),
      cardioMinutes:
        parsed.data.cardioMinutes != null
          ? Math.round(parsed.data.cardioMinutes)
          : row.cardioMinutes,
    })
    .where(and(eq(workouts.userId, userId), eq(workouts.id, id)));

  return NextResponse.json({ ok: true });
}
