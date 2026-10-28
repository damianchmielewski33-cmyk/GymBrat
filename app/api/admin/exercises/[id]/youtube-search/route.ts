import { withApiErrors } from "@/lib/errors/api";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAdminApi } from "@/lib/admin-api";
import { assertCsrf } from "@/lib/csrf";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { exercises } from "@/db/schema";
import { searchYoutubeTechniqueCandidates } from "@/lib/exercises/youtube-search";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";

export const runtime = "nodejs";

async function handlePOST(
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
  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .select()
    .from(exercises)
    .where(eq(exercises.id, id))
    .limit(1);
  if (!row) {
    return NextResponse.json(
      { error: "Nie znaleziono ćwiczenia." },
      { status: 404 },
    );
  }

  let overrideQuery: string | undefined;
  try {
    const body = (await req.json()) as { query?: string };
    if (typeof body?.query === "string" && body.query.trim()) {
      overrideQuery = body.query.trim();
    }
  } catch {
    /* body opcjonalne */
  }

  const parts = [
    overrideQuery ?? row.name,
    ...(row.aliasesEn ?? []).slice(0, 2),
    ...(row.aliasesPl ?? []).slice(0, 2),
  ];
  const result = await searchYoutubeTechniqueCandidates(parts.join(" "));
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        missingConfig: result.missingConfig ?? false,
        candidates: [],
      },
      { status: result.missingConfig ? 200 : 502 },
    );
  }
  return NextResponse.json({ ok: true, candidates: result.candidates });
}

export const POST = withApiErrors(handlePOST);
