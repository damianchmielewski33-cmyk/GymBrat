import { NextResponse } from "next/server";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import { isAllowedRequestOrigin } from "@/lib/csrf";

export const runtime = "nodejs";

async function maybeCaptureToSentry(payload: unknown): Promise<void> {
  const dsn =
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
    process.env.SENTRY_DSN?.trim();
  if (!dsn) return;
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureMessage("CSP report", {
      level: "warning",
      extra: { payload },
    });
  } catch {
    // ignore
  }
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && !isAllowedRequestOrigin(origin)) {
    return NextResponse.json({ error: "Niedozwolone Origin" }, { status: 403 });
  }

  const rl = await checkRateLimitAsync(
    rateLimitKey("csp-report", req),
    RATE.cspReport.limit,
    RATE.cspReport.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let payload: unknown = null;
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  try {
    if (contentType.includes("application/json") || contentType.includes("application/csp-report")) {
      payload = await req.json();
    } else {
      const text = await req.text();
      payload = text ? { raw: text } : null;
    }
  } catch {
    payload = { error: "invalid-body" };
  }

  if (process.env.NODE_ENV !== "production") {
    // W dev nie zasypujemy logów
    return new NextResponse(null, { status: 204 });
  }

  // Minimalne logowanie; lepiej agregować w Sentry.
  console.warn("[csp-report]", payload);
  await maybeCaptureToSentry(payload);

  return new NextResponse(null, { status: 204 });
}

