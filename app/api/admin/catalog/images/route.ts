import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { logAdminAction } from "@/lib/admin-audit";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import { generateMissingCatalogImages } from "@/lib/meal-catalog-images";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Dokończ generację grafik AI po dużym imporcie JSON (paczki). */
export async function POST(req: Request) {
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

  let mealIds: string[] | undefined;
  let limit = 8;
  try {
    const body = (await req.json().catch(() => null)) as {
      mealIds?: unknown;
      limit?: unknown;
    } | null;
    if (Array.isArray(body?.mealIds)) {
      mealIds = body.mealIds
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim())
        .slice(0, 200);
    }
    if (typeof body?.limit === "number" && Number.isFinite(body.limit)) {
      limit = Math.max(1, Math.min(40, Math.round(body.limit)));
    }
  } catch {
    /* defaults */
  }

  const images = await generateMissingCatalogImages({
    mealIds,
    limit,
    concurrency: 2,
    actorUserId: gate.session.user!.id!,
  });

  await logAdminAction({
    actorUserId: gate.session.user!.id!,
    action: "catalog.generate_images",
    meta: images,
  });

  return NextResponse.json({ ok: true, images });
}
