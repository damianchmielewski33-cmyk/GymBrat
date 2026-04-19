import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getAdminPin } from "@/lib/admin-config";
import {
  ADMIN_UNLOCK_COOKIE,
  isAdminEligible,
  signAdminUnlockToken,
} from "@/lib/admin-session";

export const runtime = "nodejs";

const bodySchema = z.object({
  pin: z.string().min(3).max(32),
});

export async function POST(req: Request) {
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

  if (parsed.data.pin !== getAdminPin()) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  const token = signAdminUnlockToken(session.user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_UNLOCK_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 12 * 60 * 60,
  });
  return res;
}
