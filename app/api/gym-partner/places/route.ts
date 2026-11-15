import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { haversineMeters, isValidCoord } from "@/lib/gym-partner/geo";
import { searchGymsByText, searchNearbyGyms } from "@/lib/gym-partner/places";

const query = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radius: z.coerce.number().min(500).max(30_000).default(5000),
  q: z.string().trim().max(60).optional(),
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
  // Globalny budżet kosztów (płatne API): ochrona przed masowym użyciem z wielu kont.
  const budget = await checkRateLimitAsync("gym-places:global", 3000, 24 * 60 * 60_000);
  if (!budget.ok) {
    return NextResponse.json({ error: "busy" }, { status: 429, headers: { "Retry-After": String(budget.retryAfterSec) } });
  }
  const parsed = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success || !isValidCoord(parsed.data.lat, parsed.data.lng)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  try {
    const { lat, lng, radius, q } = parsed.data;
    const raw = q
      ? await searchGymsByText(q, lat, lng, radius)
      : await searchNearbyGyms(lat, lng, radius);
    const places = q
      ? raw
          .map((p) => ({
            ...p,
            distanceKm: Math.round(haversineMeters({ lat, lng }, p) / 100) / 10,
          }))
          .sort((a, b) => a.distanceKm - b.distanceKm)
          .slice(0, 10)
      : raw;
    return NextResponse.json({ places }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
}
