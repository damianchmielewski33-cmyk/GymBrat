import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { checkRateLimitAsync, clientIpFromHeaders } from "@/lib/rate-limit";
import { confirmWaitlistSignup } from "@/lib/waitlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function back(req: Request, status: "ok" | "expired"): Response {
  const raw = process.env.NEXT_PUBLIC_LANDING_URL?.trim();
  let target: URL;
  try {
    target = new URL(raw || "/", raw ? undefined : req.url);
  } catch {
    target = new URL("/", req.url);
  }
  target.pathname = "/";
  target.search = `?waitlist=${status}`;
  return NextResponse.redirect(target, { status: 303, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

/** Link z e-maila (double opt-in): potwierdza zapis i odsyła na landing. */
export async function GET(req: Request) {
  const rl = await checkRateLimitAsync(`waitlist-confirm:${clientIpFromHeaders(req.headers)}`, 20, 60 * 60_000);
  if (!rl.ok) return back(req, "expired");
  const token = new URL(req.url).searchParams.get("token") ?? "";
  try {
    await ensureCriticalSchema();
    const ok = await confirmWaitlistSignup(getDb(), token);
    return back(req, ok ? "ok" : "expired");
  } catch {
    return back(req, "expired");
  }
}
