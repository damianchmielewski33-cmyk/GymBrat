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

export function buildPollinationsGenImageUrl(args: {
  prompt: string;
  seed: number;
  width: number;
  height: number;
  model?: string;
}): string {
  const model = (args.model ?? "flux").trim() || "flux";
  const params = new URLSearchParams({
    model,
    width: String(Math.max(64, Math.min(1280, Math.round(args.width)))),
    height: String(Math.max(64, Math.min(1280, Math.round(args.height)))),
    seed: String(Math.max(0, Math.round(args.seed))),
    nologo: "true",
  });
  return `${POLLINATIONS_GEN_BASE}/image/${encodeURIComponent(args.prompt)}?${params.toString()}`;
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
    seed: String(args.seed),
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
    "4k",
    "no people",
    "no text",
    "no watermark",
  ]
    .filter(Boolean)
    .join(", ");
}
