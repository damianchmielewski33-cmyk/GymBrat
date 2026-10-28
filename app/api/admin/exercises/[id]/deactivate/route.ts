import { withApiErrors } from "@/lib/errors/api";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { logAdminAction } from "@/lib/admin-audit";
import { assertCsrf } from "@/lib/csrf";
import { deactivateAdminExercise } from "@/lib/exercises/exercise-admin";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";

export const runtime = "nodejs";

async function handlePATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const rl = await checkRateLimitAsync(
    rateLimitKey("admin-mutation", req),
    RATE.adminMutation.limit,
    RATE.adminMutation.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { id } = await ctx.params;
  try {
    const row = await deactivateAdminExercise(id, gate.session.user!.id!);
    await logAdminAction({
      actorUserId: gate.session.user!.id!,
      action: "exercises.deactivate",
      meta: { id: row.id },
    });
    return NextResponse.json({ ok: true, row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Nie udało się dezaktywować.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export const PATCH = withApiErrors(handlePATCH);
