import { NextResponse } from "next/server";
import { defaultApkUrl, resolveAndroidVersion } from "@/lib/android-version";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import { UserMessages } from "@/lib/user-facing-errors";
import { fetchJavaApi, isJavaApiEnabled, passThroughJavaResponse } from "@/lib/java-api";

export const runtime = "nodejs";

const PUBLIC_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cross-Origin-Resource-Policy": "cross-origin",
};

function withPublicHeaders(res: NextResponse) {
  for (const [k, v] of Object.entries(PUBLIC_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

function sameOriginApkPath(versionName: string, versionCode: number): string {
  const safe =
    typeof versionName === "string" && /^[0-9A-Za-z._-]+$/.test(versionName.trim())
      ? versionName.trim()
      : "download";
  // Unikalna ścieżka + query — omija utknięte pobieranie „gymbrat.apk” w Chrome Android.
  return `/gymbrat-${safe}.apk?v=${versionCode}`;
}

/**
 * Start pobierania APK.
 * Domyślnie same-origin `/gymbrat-{version}.apk` (Chrome Android nie wisi jak przy GitHubie
 * ani przy powtórnym gymbrat.apk).
 * `?source=github-fallback` → GitHub Release.
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

  const url = new URL(req.url);
  const githubFallback = url.searchParams.get("source") === "github-fallback";

  if (!githubFallback) {
    const info = await resolveAndroidVersion();
    const path = sameOriginApkPath(info.versionName, info.versionCode);
    return withPublicHeaders(NextResponse.redirect(new URL(path, url.origin), 302));
  }

  if (isJavaApiEnabled()) {
    const javaRes = await fetchJavaApi("/api/android/download?source=github-fallback");
    if (javaRes) {
      return passThroughJavaResponse(javaRes);
    }
  }

  const info = await resolveAndroidVersion();
  const target = info.apkUrl || defaultApkUrl();
  return withPublicHeaders(NextResponse.redirect(target, 302));
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: PUBLIC_HEADERS });
}
