import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { listAdminAuditLogs } from "@/lib/admin-audit";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const rl = await checkRateLimitAsync(
    rateLimitKey("admin-audit-read", req),
    RATE.adminMutation.limit,
    RATE.adminMutation.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const limit = Math.min(
    500,
    Math.max(1, Number(new URL(req.url).searchParams.get("limit") ?? "200") || 200),
  );
  const entries = await listAdminAuditLogs(limit);
  return NextResponse.json({ ok: true, entries });
}
