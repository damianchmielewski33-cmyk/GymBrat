/**
 * Pollinations gen API (wymaga klucza).
 * Legacy image.pollinations.ai zwraca 402 (kolejka IP / płatność) — nie używamy go.
 */

export const POLLINATIONS_GEN_BASE = "https://gen.pollinations.ai";

export function getPollinationsApiKey(): string | null {
  const key =
    process.env.POLLINATIONS_API_KEY?.trim() ||
    process.env.POLLINATIONS_KEY?.trim() ||
    "";
  return key || null;
}

export function clampPollinationsSeed(seed: number): number {
  if (!Number.isFinite(seed)) return 1;
  const n = Math.round(seed);
  if (n < 0) return 0;
  /** Pollinations docs: -1…2147483647 */
  return Math.min(n, 2_147_483_647);
}

export function buildPollinationsGenImageUrl(args: {
  prompt: string;
  seed: number;
  width: number;
  height: number;
  model?: string;
  apiKey?: string | null;
}): string {
  const model = (args.model ?? "flux").trim() || "flux";
  const params = new URLSearchParams({
    model,
    width: String(Math.max(64, Math.min(1280, Math.round(args.width)))),
    height: String(Math.max(64, Math.min(1280, Math.round(args.height)))),
    seed: String(clampPollinationsSeed(args.seed)),
    nologo: "true",
  });
  const key = args.apiKey?.trim();
  if (key) params.set("key", key);
  return `${POLLINATIONS_GEN_BASE}/image/${encodeURIComponent(args.prompt)}?${params.toString()}`;
}

export type PollinationsImageResult =
  | { ok: true; bytes: Uint8Array; contentType: string }
  | { ok: false; status: number; detail: string };

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: "image/*,application/json,*/*",
    "User-Agent": "GymBrat-RecipeImage-Proxy",
  };
}

function decodeDataUrlOrB64(raw: string): { bytes: Uint8Array; contentType: string } | null {
  const trimmed = raw.trim();
  const dataMatch = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(trimmed);
  if (dataMatch) {
    const contentType = dataMatch[1]!;
    const b64 = dataMatch[2]!;
    return { bytes: Uint8Array.from(Buffer.from(b64, "base64")), contentType };
  }
  try {
    const bytes = Uint8Array.from(Buffer.from(trimmed, "base64"));
    if (bytes.length < 32) return null;
    return { bytes, contentType: "image/jpeg" };
  } catch {
    return null;
  }
}

/**
 * Preferowane: OpenAI-compatible POST (bez limitu długości ścieżki GET).
 */
export async function fetchPollinationsImageViaGenerations(args: {
  apiKey: string;
  prompt: string;
  seed: number;
  width: number;
  height: number;
  model?: string;
  signal?: AbortSignal;
}): Promise<PollinationsImageResult> {
  const model = (args.model ?? "flux").trim() || "flux";
  const width = Math.max(64, Math.min(1280, Math.round(args.width)));
  const height = Math.max(64, Math.min(1280, Math.round(args.height)));
  const seed = clampPollinationsSeed(args.seed);

  const res = await fetch(`${POLLINATIONS_GEN_BASE}/v1/images/generations`, {
    method: "POST",
    headers: {
      ...authHeaders(args.apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: args.prompt.slice(0, 3200),
      model,
      n: 1,
      size: `${width}x${height}`,
      response_format: "b64_json",
      // Pollinations extension — seed for flux/zimage
      seed,
    }),
    signal: args.signal,
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      detail: text.slice(0, 400) || `HTTP ${res.status}`,
    };
  }

  try {
    const json = JSON.parse(text) as {
      data?: Array<{ b64_json?: string; url?: string }>;
      error?: { message?: string };
    };
    const b64 = json.data?.[0]?.b64_json?.trim();
    if (b64) {
      const decoded = decodeDataUrlOrB64(b64);
      if (decoded) {
        return { ok: true, bytes: decoded.bytes, contentType: decoded.contentType };
      }
    }
    const url = json.data?.[0]?.url?.trim();
    if (url) {
      return fetchPollinationsImageBytes({
        apiKey: args.apiKey,
        url,
        signal: args.signal,
      });
    }
    return {
      ok: false,
      status: 502,
      detail: json.error?.message?.slice(0, 400) || "Brak b64_json w odpowiedzi Pollinations.",
    };
  } catch {
    return {
      ok: false,
      status: 502,
      detail: `Nieparsowalna odpowiedź generations: ${text.slice(0, 200)}`,
    };
  }
}

export async function fetchPollinationsImageBytes(args: {
  apiKey: string;
  url: string;
  signal?: AbortSignal;
}): Promise<PollinationsImageResult> {
  const res = await fetch(args.url, {
    headers: authHeaders(args.apiKey),
    signal: args.signal,
    cache: "no-store",
    redirect: "follow",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      detail: text.slice(0, 400) || `HTTP ${res.status}`,
    };
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length < 32) {
    return { ok: false, status: 502, detail: "Pusta odpowiedź obrazu." };
  }
  const contentType = res.headers.get("content-type") || "image/jpeg";
  if (contentType.includes("application/json") || contentType.includes("text/")) {
    const detail = new TextDecoder().decode(buf.slice(0, 400));
    return { ok: false, status: 502, detail };
  }
  return { ok: true, bytes: buf, contentType };
}

/** Fallback GET /image/{prompt}?key=… */
export async function fetchPollinationsImageViaGet(args: {
  apiKey: string;
  prompt: string;
  seed: number;
  width: number;
  height: number;
  model?: string;
  signal?: AbortSignal;
}): Promise<PollinationsImageResult> {
  const url = buildPollinationsGenImageUrl({
    prompt: args.prompt.slice(0, 900),
    seed: args.seed,
    width: args.width,
    height: args.height,
    model: args.model,
    apiKey: args.apiKey,
  });
  return fetchPollinationsImageBytes({
    apiKey: args.apiKey,
    url,
    signal: args.signal,
  });
}

export async function fetchPollinationsImage(args: {
  apiKey: string;
  prompt: string;
  seed: number;
  width: number;
  height: number;
  model?: string;
  signal?: AbortSignal;
}): Promise<PollinationsImageResult> {
  const viaPost = await fetchPollinationsImageViaGenerations(args);
  if (viaPost.ok) return viaPost;
  /** 401/402 — nie ma sensu retry GET tym samym kluczem/saldem */
  if (viaPost.status === 401 || viaPost.status === 402 || viaPost.status === 403) {
    return viaPost;
  }
  const viaGet = await fetchPollinationsImageViaGet(args);
  if (viaGet.ok) return viaGet;
  return {
    ok: false,
    status: viaGet.status || viaPost.status,
    detail: `POST: ${viaPost.detail} | GET: ${viaGet.detail}`,
  };
}

/** Same-origin proxy — klucz zostaje na serwerze. */
export function buildAppRecipeImageProxyUrl(args: {
  prompt: string;
  title?: string | null;
  seed: number;
  width?: number;
  height?: number;
  model?: string;
  /** food = prompt dania (+ framing); raw = dokładny prompt (np. NOWY MAX). */
  mode?: "food" | "raw";
}): string {
  const params = new URLSearchParams({
    p: args.prompt.slice(0, args.mode === "raw" ? 900 : 500),
    seed: String(clampPollinationsSeed(args.seed)),
    w: String(args.width ?? 640),
    h: String(args.height ?? 400),
    model: args.model ?? "flux",
    mode: args.mode ?? "food",
  });
  const title = (args.title ?? "").trim();
  if (title && (args.mode ?? "food") === "food") {
    params.set("title", title.slice(0, 160));
  }
  return `/api/recipe-image?${params.toString()}`;
}

export function isLegacyPollinationsImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname === "image.pollinations.ai" ||
      u.hostname === "gen.pollinations.ai" ||
      u.hostname.endsWith(".pollinations.ai")
    );
  } catch {
    return /pollinations\.ai/i.test(url);
  }
}

export function composeFoodImagePrompt(args: {
  title?: string | null;
  prompt: string;
}): string {
  const title = (args.title ?? "").trim();
  const prompt = args.prompt.trim() || "healthy fitness meal plated";
  return [
    title ? `Dish: ${title}` : null,
    `Exact food: ${prompt}`,
    "only this dish on a plate or in a bowl",
    "professional food photography",
    "realistic",
    "no people",
    "no text",
    "no watermark",
  ]
    .filter(Boolean)
    .join(", ");
}
