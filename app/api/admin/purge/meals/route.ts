import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { mealLogs } from "@/db/schema";
import { ensureMealLogsTableOncePerProcess } from "@/db/ensure-schema";
import { requireAdminApi } from "@/lib/admin-api";
import { assertCsrf } from "@/lib/csrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  await ensureMealLogsTableOncePerProcess();
  const db = getDb();

  const removed = await db.delete(mealLogs).returning({ id: mealLogs.id });

  const res = NextResponse.json({
    ok: true,
    deleted: { mealLogs: removed.length },
  });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

