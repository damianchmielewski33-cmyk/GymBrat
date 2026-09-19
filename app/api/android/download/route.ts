import { NextResponse } from "next/server";
import { defaultApkUrl, resolveAndroidVersion } from "@/lib/android-version";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import { UserMessages } from "@/lib/user-facing-errors";

export const runtime = "nodejs";

const PUBLIC_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cross-Origin-Resource-Policy": "cross-origin",
};

/**
 * Start pobierania APK — publiczny redirect (aplikacja Android / baner).
 */
export async function GET(req: Request) {
  const rl = await checkRateLimitAsync(
    rateLimitKey("android-download", req),
    RATE.androidDownload.limit,
    RATE.androidDownload.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: UserMessages.rateLimited },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const info = await resolveAndroidVersion();
  const target = info.apkUrl || defaultApkUrl();
  const res = NextResponse.redirect(target, 302);
  for (const [k, v] of Object.entries(PUBLIC_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: PUBLIC_HEADERS });
}
