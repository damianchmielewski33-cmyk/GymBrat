import { withApiErrors } from "@/lib/errors/api";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import {
  createGroupWorkoutSession,
  listUserTeamsForGroupStart,
} from "@/lib/community/group-workout";
import { UserMessages } from "@/lib/user-facing-errors";

async function handleGET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: UserMessages.sessionExpired }, { status: 401 });
  }
  const teams = await listUserTeamsForGroupStart(session.user.id);
  return NextResponse.json({ teams });
}

const createSchema = z.object({
  teamId: z.string().uuid().or(z.string().min(8).max(64)),
  title: z.string().trim().max(120).optional(),
});

async function handlePOST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: UserMessages.sessionExpired }, { status: 401 });
  }

  const limited = await checkRateLimitAsync(
    rateLimitKey("group-workout-create", req),
    RATE.workoutComplete.limit,
    RATE.workoutComplete.windowMs,
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
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Wybierz grupę." }, { status: 400 });
  }

  const result = await createGroupWorkoutSession({
    hostUserId: session.user.id,
    teamId: parsed.data.teamId,
    title: parsed.data.title,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, sessionId: result.sessionId });
}

export const GET = withApiErrors(handleGET);
export const POST = withApiErrors(handlePOST);
