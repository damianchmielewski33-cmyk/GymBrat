import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { logAdminAction } from "@/lib/admin-audit";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import {
  listExerciseTechniqueAdminRows,
  upsertExerciseTechniqueLink,
} from "@/lib/exercise-technique-store";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const rows = await listExerciseTechniqueAdminRows();
  const withUrl = rows.filter((r) => r.youtubeUrl).length;
  return NextResponse.json({ rows, withUrl, total: rows.length });
}

export async function PUT(req: Request) {
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

  const catalogId =
    body && typeof body === "object"
      ? String((body as { catalogId?: unknown }).catalogId ?? "").trim()
      : "";
  const youtubeUrl =
    body && typeof body === "object"
      ? String((body as { youtubeUrl?: unknown }).youtubeUrl ?? "")
      : "";

  if (!catalogId) {
    return NextResponse.json({ error: "Brak catalogId." }, { status: 400 });
  }

  try {
    const result = await upsertExerciseTechniqueLink(
      catalogId,
      youtubeUrl,
      gate.session.user!.id!,
    );
    await logAdminAction({
      actorUserId: gate.session.user!.id!,
      action: result.youtubeUrl
        ? "exercise_technique.upsert"
        : "exercise_technique.clear",
      meta: { catalogId: result.catalogId, hasUrl: Boolean(result.youtubeUrl) },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Zapis nie powiódł się.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
