import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ADMIN_UNLOCK_COOKIE } from "@/lib/admin-session";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_UNLOCK_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
  return res;
}
