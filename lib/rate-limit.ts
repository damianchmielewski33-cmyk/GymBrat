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

export function rateLimitKey(label: string, req: Request): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  return `${label}:${ip}`;
}

export const RATE = {
  pageView: { limit: 120, windowMs: 60_000 },
  adminUnlock: { limit: 8, windowMs: 10 * 60_000 },
  bodyReportImport: { limit: 12, windowMs: 60_000 },
  userExport: { limit: 12, windowMs: 60 * 60_000 },
  accountDelete: { limit: 5, windowMs: 24 * 60 * 60_000 },
} as const;
