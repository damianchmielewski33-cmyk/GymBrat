import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const buckets = new Map<string, { n: number; reset: number }>();

const upstashLimiterCache = new Map<string, Ratelimit>();

function getUpstashLimiter(limit: number, windowMs: number): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const cacheKey = `${limit}:${windowMs}`;
  let lim = upstashLimiterCache.get(cacheKey);
  if (!lim) {
    const redis = new Redis({ url, token });
    const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
    lim = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      analytics: false,
      prefix: `gymbrat_rl:${cacheKey}`,
    });
    upstashLimiterCache.set(cacheKey, lim);
  }
  return lim;
}

/**
 * Limit żądań: przy skonfigurowanym Upstash Redis używa limitu rozproszonego,
 * w przeciwnym razie — bufora w pamięci procesu (single-instance).
 */
export async function checkRateLimitAsync(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const lim = getUpstashLimiter(limit, windowMs);
  if (!lim) {
    return checkRateLimit(key, limit, windowMs);
  }
  const result = await lim.limit(key);
  if (!result.success) {
    const resetMs =
      typeof result.reset === "number" ? result.reset : Date.now() + windowMs;
    const retryAfterSec = Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
    return { ok: false, retryAfterSec };
  }
  return { ok: true };
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return { ok: true };
  }
  if (b.n >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.reset - now) / 1000)) };
  }
  b.n += 1;
  return { ok: true };
}

/** Adres klienta z nagłówków proxy (Vercel / Render / Cloudflare ustawiają je po swojej stronie). */
export function clientIpFromHeaders(headers: Pick<Headers, "get">): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "local"
  );
}

export function rateLimitKey(label: string, req: Request): string {
  return `${label}:${clientIpFromHeaders(req.headers)}`;
}

export const RATE = {
  version: { limit: 60, windowMs: 60_000 },
  pageView: { limit: 120, windowMs: 60_000 },
  cspReport: { limit: 60, windowMs: 60_000 },
  clientErrors: { limit: 30, windowMs: 60_000 },
  /** Logowanie hasłem: osobno na adres IP i na konto (e-mail). */
  loginIp: { limit: 30, windowMs: 10 * 60_000 },
  loginEmail: { limit: 20, windowMs: 15 * 60_000 },
  /** Rejestracja: wysyłka kodu e-mail i weryfikacja kodu. */
  registerSendCodeIp: { limit: 10, windowMs: 60 * 60_000 },
  registerSendCodeEmail: { limit: 5, windowMs: 60 * 60_000 },
  registerSubmitIp: { limit: 20, windowMs: 60 * 60_000 },
  registerSubmitEmail: { limit: 15, windowMs: 60 * 60_000 },
  /** Wszystkie akcje serwerowe (ogólny budżet): na adres IP i na sesję. */
  actionIp: { limit: 600, windowMs: 60_000 },
  actionSession: { limit: 180, windowMs: 60_000 },
  /** Proxy grafik AI (płatny klucz Pollinations) — liczone tylko przy realnym wywołaniu AI. */
  recipeImageIp: { limit: 90, windowMs: 60_000 },
  recipeImageUser: { limit: 40, windowMs: 60_000 },
  /** Twardy dzienny sufit generacji w całej aplikacji (nadpisz env `POLLINATIONS_DAILY_LIMIT`). */
  recipeImageDaily: { limit: 1500, windowMs: 24 * 60 * 60_000 },
  workoutComplete: { limit: 30, windowMs: 60_000 },
  adminUnlock: { limit: 8, windowMs: 10 * 60_000 },
  adminMutation: { limit: 120, windowMs: 60_000 },
  bodyReportImport: { limit: 12, windowMs: 60_000 },
  bodyReportCreate: { limit: 24, windowMs: 60_000 },
  bugReportCreate: { limit: 12, windowMs: 60_000 },
  progressExercise: { limit: 60, windowMs: 60_000 },
  activeWorkoutSession: { limit: 90, windowMs: 60_000 },
  userExport: { limit: 12, windowMs: 60 * 60_000 },
  accountDelete: { limit: 5, windowMs: 24 * 60 * 60_000 },
  androidVersion: { limit: 120, windowMs: 60_000 },
  androidDownload: { limit: 60, windowMs: 60 * 60_000 },
} as const;
