import { NextResponse } from "next/server";
import {
  buildPollinationsGenImageUrl,
  composeFoodImagePrompt,
  getPollinationsApiKey,
} from "@/lib/pollinations-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxy grafik przepisów → gen.pollinations.ai + POLLINATIONS_API_KEY.
 * Legacy image.pollinations.ai zwraca 402 bez płatnego dostępu / przy kolejce IP.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const promptRaw = (url.searchParams.get("p") ?? url.searchParams.get("prompt") ?? "").trim();
  if (!promptRaw || promptRaw.length < 3) {
    return NextResponse.json({ error: "Brak promptu." }, { status: 400 });
  }

  const key = getPollinationsApiKey();
  if (!key) {
    return NextResponse.json(
      {
        error:
          "Brak POLLINATIONS_API_KEY — ustaw klucz z https://enter.pollinations.ai w env Vercel.",
      },
      { status: 503 },
    );
  }

  const title = (url.searchParams.get("title") ?? "").trim();
  const mode = (url.searchParams.get("mode") ?? "food").trim().toLowerCase();
  const seed = Number(url.searchParams.get("seed") ?? "1");
  const width = Number(url.searchParams.get("w") ?? url.searchParams.get("width") ?? "640");
  const height = Number(url.searchParams.get("h") ?? url.searchParams.get("height") ?? "400");
  const model = (url.searchParams.get("model") ?? "flux").trim() || "flux";

  const fullPrompt =
    mode === "raw"
      ? promptRaw.slice(0, 1200)
      : composeFoodImagePrompt({ title, prompt: promptRaw });
  const upstream = buildPollinationsGenImageUrl({
    prompt: fullPrompt,
    seed: Number.isFinite(seed) ? seed : 1,
    width: Number.isFinite(width) ? width : 640,
    height: Number.isFinite(height) ? height : 400,
    model,
  });

  try {
    const res = await fetch(upstream, {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "image/*,*/*",
        "User-Agent": "GymBrat-RecipeImage-Proxy",
      },
      signal: AbortSignal.timeout(90_000),
      cache: "no-store",
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Pollinations HTTP ${res.status}`,
          detail: text.slice(0, 280),
        },
        { status: res.status === 402 ? 402 : 502 },
      );
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    return new NextResponse(res.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: "Nie udało się pobrać grafiki AI.",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 502 },
    );
  }
}
