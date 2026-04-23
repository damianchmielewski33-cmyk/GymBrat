import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { pageViews, users } from "@/db/schema";
import { getAnalyticsDeployment } from "@/lib/analytics-deployment";
import { getScreenFromPathname } from "@/lib/analytics-screen";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import { assertAnalyticsOrigin } from "@/lib/csrf";

export const runtime = "nodejs";

const bodySchema = z.object({
  pathname: z.string().min(1).max(512),
  visitorId: z.string().min(8).max(80),
});

export async function POST(req: Request) {
  const originGate = assertAnalyticsOrigin(req);
  if (originGate) return originGate;

  const rl = await checkRateLimitAsync(
    rateLimitKey("page-view", req),
    RATE.pageView.limit,
    RATE.pageView.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 });
  }
  const { pathname, visitorId } = parsed.data;
  const screen = getScreenFromPathname(pathname);
  if (!screen) {
    return new NextResponse(null, { status: 204 });
  }

  const session = await auth();
  const db = getDb();

  let userId: string | null = session?.user?.id ?? null;
  if (userId) {
    const [exists] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!exists) userId = null;
  }

  const createdAt = new Date().toISOString();
  await db.insert(pageViews).values({
    screenKey: screen.key,
    pathname: pathname.slice(0, 512),
    userId,
    visitorId: visitorId.slice(0, 80),
    deploymentEnv: getAnalyticsDeployment(),
    createdAt,
  });

  return new NextResponse(null, { status: 204 });
}
