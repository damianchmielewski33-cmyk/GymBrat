import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getAdminPin } from "@/lib/admin-config";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import {
  ADMIN_UNLOCK_COOKIE,
  isAdminEligible,
  signAdminUnlockToken,
} from "@/lib/admin-session";
import { timingSafeEqual } from "node:crypto";
import { assertCsrf } from "@/lib/csrf";

export const runtime = "nodejs";

const bodySchema = z.object({
  pin: z.string().min(3).max(32),
});

export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const rl = await checkRateLimitAsync(
    rateLimitKey("admin-unlock", req),
    RATE.adminUnlock.limit,
    RATE.adminUnlock.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const eligible = await isAdminEligible(session);
  if (!eligible) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Stałoczasowe porównanie (minimalizuje side-channel timing).
  const expected = getAdminPin();
  const a = Buffer.from(parsed.data.pin);
  const b = Buffer.from(expected);
  const ok =
    a.length === b.length &&
    (() => {
      try {
        return timingSafeEqual(a, b);
      } catch {
        return false;
      }
    })();

  if (!ok) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  const token = signAdminUnlockToken(session.user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_UNLOCK_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 12 * 60 * 60,
  });
  return res;
}
