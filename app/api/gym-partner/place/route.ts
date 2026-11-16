import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { withApiErrors } from "@/lib/errors/api";
import { consumeBudget } from "@/lib/gym-partner/budget";
import { getPlaceDetails } from "@/lib/gym-partner/places";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { requirePremium } from "@/lib/user-package";

/** Godziny otwarcia i strona www jednej siłowni (płatne pole Places — tylko Premium, z budżetem). */
async function handleGET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await requirePremium(userId);
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(id)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const rl = await checkRateLimitAsync(`gym-place:${userId}`, 40, 10 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }
  if (!(await consumeBudget("details"))) {
    return NextResponse.json({ error: "budget_exhausted" }, { status: 429 });
  }
  try {
    const details = await getPlaceDetails(id);
    return NextResponse.json({ details }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
}

export const GET = withApiErrors(handleGET);
