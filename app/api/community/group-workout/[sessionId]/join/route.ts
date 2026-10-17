import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import { joinGroupWorkoutSession } from "@/lib/community/group-workout";
import { UserMessages } from "@/lib/user-facing-errors";

export async function POST(
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
    rateLimitKey("group-workout-join", req),
    RATE.workoutComplete.limit,
    RATE.workoutComplete.windowMs,
  );
  if (!limited.ok) {
    return NextResponse.json({ error: UserMessages.rateLimited }, { status: 429 });
  }

  const { sessionId } = await ctx.params;
  const result = await joinGroupWorkoutSession({
    userId: session.user.id,
    sessionId,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    sessionId: result.sessionId,
    teamId: result.teamId,
    teamName: result.teamName,
  });
}
