import { HttpError } from "./http-error";

/**
 * Tiny in-memory sliding-window rate limiter.
 *
 * Note: this is per-process. On a multi-instance/serverless deployment you would
 * back it with Redis, but for a single Node server it provides meaningful
 * protection for the mutation endpoints. It is deliberately dependency-free.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  // Housekeeping at most once a minute so the map cannot grow unbounded.
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function clientIdentifier(request: Request, scope = "global"): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return `${scope}:${ip}`;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

/** Throws a 429 HttpError when the limit is exceeded. */
export function enforceRateLimit(
  request: Request,
  options: { scope: string; limit: number; windowMs: number }
): void {
  const key = clientIdentifier(request, options.scope);
  const result = checkRateLimit(key, options.limit, options.windowMs);
  if (!result.allowed) {
    const seconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    throw new HttpError(
      429,
      `Too many requests. Please try again in ${seconds} second${seconds === 1 ? "" : "s"}.`,
      "RATE_LIMITED"
    );
  }
}

/** Sensible defaults for write endpoints. */
export const WRITE_LIMIT = { limit: 60, windowMs: 60_000 } as const;
export const READ_LIMIT = { limit: 240, windowMs: 60_000 } as const;