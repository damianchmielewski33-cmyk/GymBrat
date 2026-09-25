import { NextResponse } from "next/server";
import { resolveAndroidVersion } from "@/lib/android-version";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import { UserMessages } from "@/lib/user-facing-errors";
import { fetchJavaApi, isJavaApiEnabled, passThroughJavaResponse } from "@/lib/java-api";

export const runtime = "nodejs";

const PUBLIC_HEADERS = {
  "Cache-Control": "public, max-age=60, s-maxage=60",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cross-Origin-Resource-Policy": "cross-origin",
};

/**
 * Publiczny JSON dla aplikacji Android — bez sesji.
 * Przy JAVA_API_BASE_URL proxy do Spring Boot.
 */
export async function GET(req: Request) {
  const rl = await checkRateLimitAsync(
    rateLimitKey("android-version", req),
    RATE.androidVersion.limit,
    RATE.androidVersion.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: UserMessages.rateLimited },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  if (isJavaApiEnabled()) {
    const javaRes = await fetchJavaApi("/api/android/version");
    if (javaRes) {
      return passThroughJavaResponse(javaRes);
    }
  }

  const info = await resolveAndroidVersion();
  return NextResponse.json(
    {
      ...info,
      downloadPath: "/api/android/download?source=in-app-update",
    },
    { headers: PUBLIC_HEADERS },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: PUBLIC_HEADERS });
}
