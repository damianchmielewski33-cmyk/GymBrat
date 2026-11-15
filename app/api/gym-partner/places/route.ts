import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { isValidCoord } from "@/lib/gym-partner/geo";
import { searchNearbyGyms } from "@/lib/gym-partner/places";

const query = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radius: z.coerce.number().min(500).max(10_000).default(5000),
});

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const rl = await checkRateLimitAsync(`gym-places:${userId}`, 30, 10 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }
  const parsed = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success || !isValidCoord(parsed.data.lat, parsed.data.lng)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  try {
    const places = await searchNearbyGyms(parsed.data.lat, parsed.data.lng, parsed.data.radius);
    return NextResponse.json({ places }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
}
