import { NextResponse } from "next/server";
import { z } from "zod";
import { assertCsrf } from "@/lib/csrf";
import { requireAdminApi } from "@/lib/admin-api";
import { getAppSettings, setAiGloballyDisabled } from "@/lib/app-settings";
import { logAdminAction } from "@/lib/admin-audit";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  disabled: z.boolean(),
});

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;
  const settings = await getAppSettings();
  return NextResponse.json({ ok: true, aiGloballyDisabled: settings.aiGloballyDisabled });
}

export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const rl = await checkRateLimitAsync(
    rateLimitKey("admin-mutation", req),
    RATE.adminMutation.limit,
    RATE.adminMutation.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Rate limit" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const before = await getAppSettings();
  await setAiGloballyDisabled(parsed.data.disabled);
  const actorId = admin.session.user!.id!;
  await logAdminAction({
    actorUserId: actorId,
    action: "app_settings.ai_globally_disabled",
    meta: {
      before: before.aiGloballyDisabled,
      after: parsed.data.disabled,
    },
  });
  return NextResponse.json({ ok: true });
}

