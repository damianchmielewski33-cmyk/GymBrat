import { NextResponse } from "next/server";
import {
  composeFoodImagePrompt,
  fetchPollinationsImage,
  getPollinationsApiKey,
} from "@/lib/pollinations-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Proxy grafik przepisów → gen.pollinations.ai + POLLINATIONS_API_KEY.
 * Preferuje POST /v1/images/generations (b64), fallback GET /image/{prompt}.
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
          "Brak POLLINATIONS_API_KEY — ustaw klucz z https://enter.pollinations.ai/keys w env Vercel i zrób Redeploy.",
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

  try {
    const result = await fetchPollinationsImage({
      apiKey: key,
      prompt: fullPrompt,
      seed: Number.isFinite(seed) ? seed : 1,
      width: Number.isFinite(width) ? width : 640,
      height: Number.isFinite(height) ? height : 400,
      model,
      signal: AbortSignal.timeout(55_000),
    });

    if (!result.ok) {
      const status =
        result.status === 401 || result.status === 402 || result.status === 403
          ? result.status
          : 502;
      return NextResponse.json(
        {
          error:
            result.status === 402
              ? "Brak Pollen na koncie Pollinations — doładuj saldo na enter.pollinations.ai."
              : result.status === 401 || result.status === 403
                ? "Nieprawidłowy POLLINATIONS_API_KEY."
                : `Pollinations HTTP ${result.status}`,
          ...(process.env.NODE_ENV !== "production"
            ? { detail: result.detail }
            : {}),
        },
        { status },
      );
    }

    return new NextResponse(Buffer.from(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": result.contentType.startsWith("image/")
          ? result.contentType
          : "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: "Nie udało się pobrać grafiki AI.",
        ...(process.env.NODE_ENV !== "production"
          ? { detail: e instanceof Error ? e.message : String(e) }
          : {}),
      },
      { status: 502 },
    );
  }
}
