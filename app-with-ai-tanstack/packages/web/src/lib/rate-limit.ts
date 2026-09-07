/**
 * In-memory fixed-window rate limiter for TanStack Start server handlers.
 *
 * The auth routes are Web `Request`/`Response` handlers, not Express middleware,
 * so `express-rate-limit` does not apply. This is a dependency-free equivalent.
 *
 * Scope: single server process. Counters live in module state, so they reset on
 * restart and are not shared across instances. Swap `buckets` for Redis if this
 * is ever deployed behind more than one node.
 *
 * Defaults come from the env vars already declared in `.env.example`:
 *   RATE_LIMIT_WINDOW_MS    window length in ms (default 900000 = 15 min)
 *   RATE_LIMIT_MAX_REQUESTS max requests per window (default 100)
 */

import { getLogger } from "@appwithai/core/logging";

export interface RateLimitOptions {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Maximum requests permitted per key per window. */
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Configured maximum for the window. */
  limit: number;
  /** Requests still permitted in the current window (never negative). */
  remaining: number;
  /** Epoch milliseconds at which the current window expires. */
  resetAt: number;
  /** Whole seconds until the window expires — the `Retry-After` value. */
  retryAfterSeconds: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Sweep expired buckets so the map does not grow without bound. */
function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60_000;

/**
 * Default limits, read from the environment at call time so tests and
 * deployments can change them without reloading the module.
 */
export function defaultRateLimitOptions(): RateLimitOptions {
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS);
  const max = Number(process.env.RATE_LIMIT_MAX_REQUESTS);

  return {
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 900_000,
    max: Number.isFinite(max) && max > 0 ? max : 100,
  };
}

/**
 * Record a hit against `key` and report whether it is permitted.
 *
 * Fixed window: the first request starts a window of `windowMs`; every request
 * in that window increments the counter. Requests beyond `max` are rejected
 * until the window expires.
 */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();

  if (now - lastSweep > SWEEP_INTERVAL_MS) {
    sweep(now);
    lastSweep = now;
  }

  const existing = buckets.get(key);
  const bucket =
    existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + options.windowMs };

  bucket.count += 1;
  buckets.set(key, bucket);

  const allowed = bucket.count <= options.max;

  return {
    allowed,
    limit: options.max,
    remaining: Math.max(0, options.max - bucket.count),
    resetAt: bucket.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

/** Clear all counters. Intended for tests. */
export function resetRateLimits(): void {
  buckets.clear();
  lastSweep = 0;
}

/**
 * Best-effort client IP for a request.
 *
 * Trusts `x-forwarded-for` / `x-real-ip`, which are set by the reverse proxy in
 * front of the app. Direct-to-app requests have no reliable peer address at this
 * layer, so they share the `"unknown"` bucket — deliberately conservative:
 * unattributable traffic is rate-limited as a single client rather than not at all.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Standard rate-limit headers to attach to a response. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

/**
 * Apply a rate limit to an incoming request.
 *
 * Returns a ready-to-send 429 `Response` when the limit is exceeded, or `null`
 * when the request may proceed. `scope` separates counters per endpoint so a
 * burst of logins does not consume the registration budget.
 *
 * @example
 * const limited = enforceRateLimit(request, "auth:login", { windowMs: 60_000, max: 10 });
 * if (limited) return limited;
 */
export function enforceRateLimit(
  request: Request,
  scope: string,
  options: RateLimitOptions
): Response | null {
  const ip = getClientIp(request);
  const result = checkRateLimit(`${scope}:${ip}`, options);

  if (result.allowed) return null;

  // The refusal is the interesting half. A limiter that silently returns 429 is
  // indistinguishable, from outside, from an endpoint that is merely slow — and
  // a run of these on one bucket is what credential stuffing looks like before
  // anyone notices it any other way.
  getLogger("auth").event("auth.ratelimit.exceeded", {
    bucket: scope,
    ip,
    limit: options.max,
    windowMs: options.windowMs,
  });

  return new Response(
    JSON.stringify({
      error: "RATE_LIMITED",
      message: `Too many requests. Try again in ${result.retryAfterSeconds} seconds.`,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfterSeconds),
        ...rateLimitHeaders(result),
      },
    }
  );
}

/**
 * Limits for the authentication endpoints: 10 sign-in attempts per minute per
 * IP, 3 registrations per minute per IP.
 *
 * Overridable by environment, and defaulting to the values they have always
 * had. A limit that can only be changed by editing and redeploying is one that
 * gets loosened permanently the first time it inconveniences someone — and an
 * office behind a single NAT address is one shared bucket, so the right number
 * is not the same everywhere. An unparsable or non-positive value is ignored
 * rather than obeyed: a typo in configuration must not be a way to turn the
 * limiter off.
 */
function limitFromEnv(key: string, fallback: number): number {
  const raw = Number(process.env[key]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

export const AUTH_LOGIN_LIMIT: RateLimitOptions = {
  windowMs: 60_000,
  max: limitFromEnv("AUTH_LOGIN_MAX_PER_MINUTE", 10),
};

export const AUTH_REGISTER_LIMIT: RateLimitOptions = {
  windowMs: 60_000,
  max: limitFromEnv("AUTH_REGISTER_MAX_PER_MINUTE", 3),
};
