import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { lookupOpenFoodFacts } from "@/lib/open-food-facts";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import { UserMessages } from "@/lib/user-facing-errors";

const schema = z.object({
  barcode: z.string().min(8).max(20),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: UserMessages.sessionExpired }, { status: 401 });
  }

  const rl = await checkRateLimitAsync(
    rateLimitKey("food-barcode", req),
    RATE.progressExercise.limit,
    RATE.progressExercise.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: UserMessages.rateLimited },
      { status: 429 },
    );
  }

  const url = new URL(req.url);
  const parsed = schema.safeParse({ barcode: url.searchParams.get("barcode") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Nieprawidłowy kod kreskowy" }, { status: 400 });
  }

  try {
    const product = await lookupOpenFoodFacts(parsed.data.barcode);
    if (!product) {
      return NextResponse.json(
        { ok: false, error: "Nie znaleziono produktu w Open Food Facts" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, product });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Błąd połączenia z bazą produktów" },
      { status: 502 },
    );
  }
}
