import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { logAdminAction } from "@/lib/admin-audit";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import {
  clearDbCatalogMeals,
  importCatalogMealsFromJson,
  listDbCatalogMeals,
  loadMergedMealCatalog,
} from "@/lib/meal-catalog-store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const [dbMeals, merged] = await Promise.all([
    listDbCatalogMeals(),
    loadMergedMealCatalog(),
  ]);

  return NextResponse.json({
    dbCount: dbMeals.length,
    mergedCount: merged.length,
    dbMeals,
  });
}

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

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Niepoprawny JSON" }, { status: 400 });
  }

  try {
    const result = await importCatalogMealsFromJson(json, gate.session.user!.id!);
    await logAdminAction({
      actorUserId: gate.session.user!.id!,
      action: "catalog.import",
      meta: {
        mode: result.mode,
        upserted: result.upserted,
        removed: result.removed,
        totalMerged: result.totalMerged,
      },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Import nie powiódł się.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
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

  const removed = await clearDbCatalogMeals();
  await logAdminAction({
    actorUserId: gate.session.user!.id!,
    action: "catalog.clear",
    meta: { removed },
  });
  return NextResponse.json({ ok: true, removed });
}
