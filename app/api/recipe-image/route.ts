import { auth } from "@/auth";
import { AppError } from "@/lib/errors/app-error";
import { withApiErrors } from "@/lib/errors/api";
import { checkRateLimitAsync, clientIpFromHeaders, RATE } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import {
  composeFoodImagePrompt,
  createFetchTimeoutSignal,
  fetchPollinationsImage,
  getPollinationsApiKey,
  POLLINATIONS_ALLOWED_MODELS,
  POLLINATIONS_FOOD_MODEL,
  POLLINATIONS_MAX_PROMPT_CHARS,
  POLLINATIONS_MAX_TITLE_CHARS,
  POLLINATIONS_RAW_PROMPT_PREFIX,
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

function clampDimension(raw: string | null, fallback: number): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(1024, Math.max(256, n));
}

function dailyLimit(): number {
  const fromEnv = Number(process.env.POLLINATIONS_DAILY_LIMIT);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? Math.floor(fromEnv) : RATE.recipeImageDaily.limit;
}

/** Zwraca opis przekroczonego limitu albo `null`, gdy wolno wywołać Pollinations. */
async function checkImageBudget(
  req: Request,
  userId: string,
): Promise<{ scope: "user" | "ip" | "daily"; retryAfterSec: number } | null> {
  const ip = clientIpFromHeaders(req.headers);
  const byUser = await checkRateLimitAsync(
    `recipe-image-user:${userId}`,
    RATE.recipeImageUser.limit,
    RATE.recipeImageUser.windowMs,
  );
  if (!byUser.ok) return { scope: "user", retryAfterSec: byUser.retryAfterSec };
  const byIp = await checkRateLimitAsync(
    `recipe-image-ip:${ip}`,
    RATE.recipeImageIp.limit,
    RATE.recipeImageIp.windowMs,
  );
  if (!byIp.ok) return { scope: "ip", retryAfterSec: byIp.retryAfterSec };
  const daily = await checkRateLimitAsync(
    "recipe-image-daily",
    dailyLimit(),
    RATE.recipeImageDaily.windowMs,
  );
  if (!daily.ok) return { scope: "daily", retryAfterSec: daily.retryAfterSec };
  return null;
}

function fallbackSvgResponse(
  reason: string,
  opts: { noStore?: boolean } = {},
): NextResponse {
  const raw = RECIPE_IMAGE_FALLBACK.startsWith("data:image/svg+xml,")
    ? decodeURIComponent(RECIPE_IMAGE_FALLBACK.slice("data:image/svg+xml,".length))
    : `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect fill="#121214" width="640" height="400"/></svg>`;
  return new NextResponse(raw, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": opts.noStore ? "no-store" : "private, max-age=60",
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
async function handleGET(req: Request) {
  const url = new URL(req.url);
  const asJson = wantsJson(req, url);
  const promptRaw = (url.searchParams.get("p") ?? url.searchParams.get("prompt") ?? "").trim();
  if (!promptRaw || promptRaw.length < 3) {
    return asJson
      ? jsonError(400, "Brak promptu.")
      : fallbackSvgResponse("missing_prompt");
  }

  // Endpoint zużywa płatny klucz — tylko zalogowani (proxy.ts też wymaga sesji; to druga warstwa).
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new AppError("UNAUTHORIZED");

  const key = getPollinationsApiKey();
  if (!key) {
    const msg =
      "Brak POLLINATIONS_API_KEY — ustaw klucz z https://enter.pollinations.ai/keys w env Vercel i zrób Redeploy.";
    return asJson ? jsonError(503, msg) : fallbackSvgResponse("missing_api_key");
  }

  const modeParam = (url.searchParams.get("mode") ?? "food").trim().toLowerCase();
  if (modeParam !== "food" && modeParam !== "raw") {
    return asJson ? jsonError(400, "Nieznany tryb grafiki.") : fallbackSvgResponse("bad_mode");
  }
  const mode: "food" | "raw" = modeParam;

  // Tryb raw służy wyłącznie grafice „NOWY MAX” — prompt musi mieć jej stały prefiks,
  // więc endpoint nie wygeneruje dowolnego obrazu na koszt właściciela klucza.
  if (
    mode === "raw" &&
    !promptRaw.toLowerCase().startsWith(POLLINATIONS_RAW_PROMPT_PREFIX.toLowerCase())
  ) {
    return asJson ? jsonError(400, "Niedozwolony prompt.") : fallbackSvgResponse("bad_prompt");
  }

  const title = (url.searchParams.get("title") ?? "")
    .trim()
    .slice(0, POLLINATIONS_MAX_TITLE_CHARS);
  const seedNum = Number(url.searchParams.get("seed") ?? "1");
  const seed = Number.isFinite(seedNum) ? seedNum : 1;
  const width = clampDimension(url.searchParams.get("w") ?? url.searchParams.get("width"), 640);
  const height = clampDimension(url.searchParams.get("h") ?? url.searchParams.get("height"), 400);
  const modelRaw = (url.searchParams.get("model") ?? "").trim();
  // Tylko modele z allowlisty; stare URL-e (flux / flux.1-schnell) → szybki model domyślny.
  const model =
    mode === "raw" && POLLINATIONS_ALLOWED_MODELS.has(modelRaw)
      ? modelRaw
      : POLLINATIONS_FOOD_MODEL;

  const fullPrompt =
    mode === "raw"
      ? promptRaw.slice(0, POLLINATIONS_MAX_PROMPT_CHARS.raw)
      : composeFoodImagePrompt({
          title,
          prompt: promptRaw.slice(0, POLLINATIONS_MAX_PROMPT_CHARS.food),
        });

  // Limity dopiero tuż przed wywołaniem płatnego API (powtórki z cache przeglądarki ich nie liczą).
  const blocked = await checkImageBudget(req, userId);
  if (blocked) {
    console.warn(`[recipe-image] limit: ${blocked.scope} (user=${userId})`);
    if (asJson) {
      throw new AppError("RATE_LIMITED", {
        message: `Limit generowania grafik AI (${blocked.scope})`,
        retryAfterSec: blocked.retryAfterSec,
      });
    }
    return fallbackSvgResponse("rate_limited", { noStore: true });
  }

  const timed = createFetchTimeoutSignal(FETCH_TIMEOUT_MS);
  try {
    const result = await fetchPollinationsImage({
      apiKey: key,
      prompt: fullPrompt,
      seed,
      width,
      height,
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
        // Odpowiedź tylko dla zalogowanych — bez współdzielonego cache CDN.
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
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

export const GET = withApiErrors(handleGET);
