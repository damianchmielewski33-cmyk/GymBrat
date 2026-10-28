import { withApiErrors } from "@/lib/errors/api";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdminApi } from "@/lib/admin-api";
import { logAdminAction } from "@/lib/admin-audit";
import { assertCsrf } from "@/lib/csrf";
import { patchAdminExercise } from "@/lib/exercises/exercise-admin";
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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Niepoprawny JSON" }, { status: 400 });
  }

  try {
    const row = await patchAdminExercise(
      id,
      body as Parameters<typeof patchAdminExercise>[1],
      gate.session.user!.id!,
    );
    await logAdminAction({
      actorUserId: gate.session.user!.id!,
      action: "exercises.patch",
      meta: { id: row.id },
    });
    return NextResponse.json({ ok: true, row });
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: e.issues[0]?.message ?? "Niepoprawne dane." },
        { status: 400 },
      );
    }
    const msg = e instanceof Error ? e.message : "Nie udało się zapisać.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export const PATCH = withApiErrors(handlePATCH);
