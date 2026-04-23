import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { runDbCleanup } from "@/lib/db-retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const result = await runDbCleanup();
  const res = NextResponse.json({ ok: true, ...result });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

