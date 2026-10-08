import { NextResponse } from "next/server";
import {
  composeFoodImagePrompt,
  createFetchTimeoutSignal,
  fetchPollinationsImage,
  getPollinationsApiKey,
  POLLINATIONS_FOOD_MODEL,
  sanitizePollinationsErrorDetail,
} from "@/lib/pollinations-image";
import { RECIPE_IMAGE_FALLBACK } from "@/lib/recipe-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Pro / Fluid: więcej czasu na AI; Hobby i tak obetnie wcześniej — stąd szybki model + timeout. */
export const maxDuration = 60;

const FETCH_TIMEOUT_MS = 22_000;

function wantsJson(req: Request, url: URL): boolean {
  if (url.searchParams.get("format") === "json") return true;
  const accept = req.headers.get("accept") ?? "";
  return accept.includes("application/json") && !accept.includes("image/");
}

function fallbackSvgResponse(reason: string): NextResponse {
  const raw = RECIPE_IMAGE_FALLBACK.startsWith("data:image/svg+xml,")
    ? decodeURIComponent(RECIPE_IMAGE_FALLBACK.slice("data:image/svg+xml,".length))
    : `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect fill="#121214" width="640" height="400"/></svg>`;
  return new NextResponse(raw, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=60",
      "X-GymBrat-Image": "fallback",
      "X-GymBrat-Image-Error": reason.slice(0, 120),
    },
  });
}

function jsonError(
  status: number,
  error: string,
  detail?: string,
): NextResponse {
  return NextResponse.json(
    {
      error,
      ...(detail ? { detail: detail.slice(0, 400) } : {}),
    },
    { status },
  );
}

/**
 * Proxy grafik przepisów → gen.pollinations.ai + POLLINATIONS_API_KEY.
 * GET /image najpierw (szybciej), potem POST /v1/images/generations.
 * Przy błędzie AI: SVG fallback (żeby <img> nie dostawało JSON 502), albo JSON przy format=json.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const asJson = wantsJson(req, url);
  const promptRaw = (url.searchParams.get("p") ?? url.searchParams.get("prompt") ?? "").trim();
  if (!promptRaw || promptRaw.length < 3) {
    return asJson
      ? jsonError(400, "Brak promptu.")
      : fallbackSvgResponse("missing_prompt");
  }

  const key = getPollinationsApiKey();
  if (!key) {
    const msg =
      "Brak POLLINATIONS_API_KEY — ustaw klucz z https://enter.pollinations.ai/keys w env Vercel i zrób Redeploy.";
    return asJson ? jsonError(503, msg) : fallbackSvgResponse("missing_api_key");
  }

  const title = (url.searchParams.get("title") ?? "").trim();
  const mode = (url.searchParams.get("mode") ?? "food").trim().toLowerCase();
  const seed = Number(url.searchParams.get("seed") ?? "1");
  const width = Number(url.searchParams.get("w") ?? url.searchParams.get("width") ?? "640");
  const height = Number(url.searchParams.get("h") ?? url.searchParams.get("height") ?? "400");
  const modelRaw =
    (url.searchParams.get("model") ?? POLLINATIONS_FOOD_MODEL).trim() ||
    POLLINATIONS_FOOD_MODEL;
  // Stare URL-e katalogu mają model=flux — na Vercel często timeout; food → zimage.
  const model =
    mode !== "raw" && (modelRaw === "flux" || modelRaw === "flux.1-schnell")
      ? POLLINATIONS_FOOD_MODEL
      : modelRaw;

  const fullPrompt =
    mode === "raw"
      ? promptRaw.slice(0, 1200)
      : composeFoodImagePrompt({ title, prompt: promptRaw });

  const timed = createFetchTimeoutSignal(FETCH_TIMEOUT_MS);
  try {
    const result = await fetchPollinationsImage({
      apiKey: key,
      prompt: fullPrompt,
      seed: Number.isFinite(seed) ? seed : 1,
      width: Number.isFinite(width) ? width : 640,
      height: Number.isFinite(height) ? height : 400,
      model,
      signal: timed.signal,
    });

    if (!result.ok) {
      const reason =
        result.status === 402
          ? "no_pollen"
          : result.status === 401 || result.status === 403
            ? "bad_api_key"
            : `upstream_${result.status}`;
      if (asJson) {
        const status =
          result.status === 401 || result.status === 402 || result.status === 403
            ? result.status
            : 502;
        return jsonError(
          status,
          result.status === 402
            ? "Brak Pollen na koncie Pollinations — doładuj saldo na enter.pollinations.ai."
            : result.status === 401 || result.status === 403
              ? "Nieprawidłowy POLLINATIONS_API_KEY."
              : `Pollinations HTTP ${result.status}`,
          result.detail,
        );
      }
      return fallbackSvgResponse(reason);
    }

    return new NextResponse(Buffer.from(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": result.contentType.startsWith("image/")
          ? result.contentType
          : "image/jpeg",
        "Cache-Control":
          "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
        "X-GymBrat-Image": "pollinations",
      },
    });
  } catch (e) {
    const detail = sanitizePollinationsErrorDetail(e);
    if (asJson) {
      return jsonError(502, "Nie udało się pobrać grafiki AI.", detail);
    }
    return fallbackSvgResponse(detail);
  } finally {
    timed.clear();
  }
}
