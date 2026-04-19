const buckets = new Map<string, { n: number; reset: number }>();

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
} as const;
