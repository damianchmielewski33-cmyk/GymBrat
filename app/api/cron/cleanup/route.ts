import { NextResponse } from "next/server";
import { runDbCleanup } from "@/lib/db-retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const hdr =
    req.headers.get("authorization") ??
    req.headers.get("x-cron-secret") ??
    "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice("Bearer ".length) : hdr;
  return token === secret;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const result = await runDbCleanup();
  return NextResponse.json({ ok: true, ...result });
}

