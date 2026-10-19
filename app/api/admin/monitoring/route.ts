import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { collectMonitoringSnapshot } from "@/lib/monitoring/collect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live limity Render + Turso (+ lokalny soft storage). */
export async function GET(req: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  const snapshot = await collectMonitoringSnapshot({ force });
  const res = NextResponse.json({ ok: true, ...snapshot });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
