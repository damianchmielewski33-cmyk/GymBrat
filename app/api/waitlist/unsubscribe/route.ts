import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { checkRateLimitAsync, clientIpFromHeaders } from "@/lib/rate-limit";
import { unsubscribeWaitlist, verifyUnsubscribeToken } from "@/lib/waitlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function unsubscribe(req: Request): Promise<boolean> {
  const rl = await checkRateLimitAsync(`waitlist-unsub:${clientIpFromHeaders(req.headers)}`, 20, 60 * 60_000);
  if (!rl.ok) return false;
  const params = new URL(req.url).searchParams;
  const email = (params.get("email") ?? "").trim().toLowerCase();
  const token = params.get("token") ?? "";
  if (!email || email.length > 254 || !verifyUnsubscribeToken(email, token)) return false;
  await ensureCriticalSchema();
  await unsubscribeWaitlist(getDb(), email);
  return true;
}

/** Wypis jednym kliknięciem z linku w e-mailu; odsyła na landing. */
export async function GET(req: Request) {
  let ok = false;
  try {
    ok = await unsubscribe(req);
  } catch {
    ok = false;
  }
  const raw = process.env.NEXT_PUBLIC_LANDING_URL?.trim();
  let target: URL;
  try {
    target = new URL(raw || "/", raw ? undefined : req.url);
  } catch {
    target = new URL("/", req.url);
  }
  target.pathname = "/";
  target.search = `?waitlist=${ok ? "unsub" : "expired"}`;
  return NextResponse.redirect(target, { status: 303, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

/** RFC 8058 (List-Unsubscribe-Post): wypis bez przekierowania. */
export async function POST(req: Request) {
  let ok = false;
  try {
    ok = await unsubscribe(req);
  } catch {
    ok = false;
  }
  return NextResponse.json({ ok }, { status: ok ? 200 : 400, headers: { "Cache-Control": "no-store" } });
}
