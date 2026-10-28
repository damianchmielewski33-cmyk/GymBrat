import { withApiErrors } from "@/lib/errors/api";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdminApi } from "@/lib/admin-api";
import { logAdminAction } from "@/lib/admin-audit";
import { assertCsrf } from "@/lib/csrf";
import {
  createAdminExercise,
  listAdminExercises,
} from "@/lib/exercises/exercise-admin";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";

export const runtime = "nodejs";

async function handleGET(req: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const query = url.searchParams.get("q") ?? undefined;
  const categoryId = url.searchParams.get("category") ?? undefined;
  const onlyMissingDescription =
    url.searchParams.get("missingDescription") === "1";
  const includeInactive = url.searchParams.get("inactive") === "1";
  const limit = Math.min(
    500,
    Math.max(1, Number(url.searchParams.get("limit") ?? 40) || 40),
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);

  const result = await listAdminExercises({
    query,
    categoryId,
    onlyMissingDescription,
    includeInactive,
    limit,
    offset,
  });
  return NextResponse.json(result);
}

async function handlePOST(req: Request) {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Niepoprawny JSON" }, { status: 400 });
  }

  try {
    const row = await createAdminExercise(
      body as Parameters<typeof createAdminExercise>[0],
      gate.session.user!.id!,
    );
    await logAdminAction({
      actorUserId: gate.session.user!.id!,
      action: "exercises.create",
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
    const msg = e instanceof Error ? e.message : "Nie udało się dodać ćwiczenia.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export const GET = withApiErrors(handleGET);
export const POST = withApiErrors(handlePOST);
