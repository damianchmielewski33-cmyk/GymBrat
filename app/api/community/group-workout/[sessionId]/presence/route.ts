import { withApiErrors } from "@/lib/errors/api";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import {
  leaveGroupWorkoutSession,
  listGroupWorkoutPresence,
  updateGroupWorkoutPresence,
} from "@/lib/community/group-workout";
import { UserMessages } from "@/lib/user-facing-errors";

async function handleGET(
  _req: Request,
  ctx: { params: Promise<{ sessionId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: UserMessages.sessionExpired }, { status: 401 });
  }
  const { sessionId } = await ctx.params;
  const participants = await listGroupWorkoutPresence(sessionId, session.user.id);
  return NextResponse.json({
    participants,
    serverTime: Date.now(),
  });
}

const presenceSchema = z.object({
  displayName: z.string().min(1).max(80),
  exerciseName: z.string().max(200),
  exerciseId: z.string().max(128).nullable(),
  setIndex: z.number().int().min(1).max(50),
  setTotal: z.number().int().min(1).max(50),
  reps: z.number().int().min(0).max(500).nullable(),
  weight: z.number().min(0).max(2000),
  elapsedSeconds: z.number().int().min(0).max(24 * 3600),
  restRemaining: z.number().int().min(0).max(3600).nullable(),
  progressPercent: z.number().int().min(0).max(100),
  phase: z.enum(["working", "rest", "done"]),
});

async function handlePUT(
  req: Request,
  ctx: { params: Promise<{ sessionId: string }> },
) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: UserMessages.sessionExpired }, { status: 401 });
  }

  /** Presence <1s — wyższy limit niż zwykły write. */
  const limited = await checkRateLimitAsync(
    rateLimitKey("group-workout-presence", req),
    120,
    60_000,
  );
  if (!limited.ok) {
    return NextResponse.json({ error: UserMessages.rateLimited }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }
  const parsed = presenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Presence nie przeszła walidacji." }, { status: 400 });
  }

  const { sessionId } = await ctx.params;
  const result = await updateGroupWorkoutPresence({
    userId: session.user.id,
    sessionId,
    presence: parsed.data,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

async function handleDELETE(
  req: Request,
  ctx: { params: Promise<{ sessionId: string }> },
) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: UserMessages.sessionExpired }, { status: 401 });
  }

  const limited = await checkRateLimitAsync(
    rateLimitKey("group-workout-leave", req),
    RATE.workoutComplete.limit,
    RATE.workoutComplete.windowMs,
  );
  if (!limited.ok) {
    return NextResponse.json({ error: UserMessages.rateLimited }, { status: 429 });
  }

  const { sessionId } = await ctx.params;
  await leaveGroupWorkoutSession({
    userId: session.user.id,
    sessionId,
  });
  return NextResponse.json({ ok: true });
}

export const GET = withApiErrors(handleGET);
export const PUT = withApiErrors(handlePUT);
export const DELETE = withApiErrors(handleDELETE);
