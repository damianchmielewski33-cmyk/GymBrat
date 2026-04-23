import { NextResponse } from "next/server";
import { CSRF_COOKIE_NAME } from "@/lib/csrf-constants";
import { newCsrfToken } from "@/lib/csrf";

export const runtime = "nodejs";

/** Ustawia cookie double-submit; wywołaj z przeglądarki przed pierwszym POST/PATCH/DELETE. */
export async function GET() {
  const token = newCsrfToken();
  const secure = process.env.NODE_ENV === "production";
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return res;
}
