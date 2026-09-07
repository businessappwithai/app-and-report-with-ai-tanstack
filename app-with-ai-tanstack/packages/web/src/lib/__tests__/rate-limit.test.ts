import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_LOGIN_LIMIT,
  AUTH_REGISTER_LIMIT,
  checkRateLimit,
  defaultRateLimitOptions,
  enforceRateLimit,
  getClientIp,
  resetRateLimits,
} from "../rate-limit";

const OPTIONS = { windowMs: 60_000, max: 3 };

function requestFrom(ip?: string, header = "x-forwarded-for"): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: ip ? { [header]: ip } : {},
  });
}

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("allows requests up to the limit and rejects the next one", () => {
    for (let i = 0; i < OPTIONS.max; i++) {
      expect(checkRateLimit("key", OPTIONS).allowed).toBe(true);
    }
    expect(checkRateLimit("key", OPTIONS).allowed).toBe(false);
  });

  it("counts down remaining and never reports a negative value", () => {
    expect(checkRateLimit("key", OPTIONS).remaining).toBe(2);
    expect(checkRateLimit("key", OPTIONS).remaining).toBe(1);
    expect(checkRateLimit("key", OPTIONS).remaining).toBe(0);
    expect(checkRateLimit("key", OPTIONS).remaining).toBe(0);
  });

  it("tracks keys independently", () => {
    for (let i = 0; i < OPTIONS.max; i++) checkRateLimit("a", OPTIONS);

    expect(checkRateLimit("a", OPTIONS).allowed).toBe(false);
    expect(checkRateLimit("b", OPTIONS).allowed).toBe(true);
  });

  it("starts a fresh window once the previous one expires", () => {
    vi.useFakeTimers();
    try {
      for (let i = 0; i < OPTIONS.max; i++) checkRateLimit("key", OPTIONS);
      expect(checkRateLimit("key", OPTIONS).allowed).toBe(false);

      vi.advanceTimersByTime(OPTIONS.windowMs + 1);

      const result = checkRateLimit("key", OPTIONS);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(OPTIONS.max - 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a positive retry-after within the window", () => {
    const result = checkRateLimit("key", OPTIONS);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(60);
  });
});

describe("getClientIp", () => {
  it("uses the first entry of x-forwarded-for", () => {
    expect(getClientIp(requestFrom("203.0.113.5, 198.51.100.1"))).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip", () => {
    expect(getClientIp(requestFrom("203.0.113.9", "x-real-ip"))).toBe("203.0.113.9");
  });

  it("returns 'unknown' when no forwarding header is present", () => {
    expect(getClientIp(requestFrom())).toBe("unknown");
  });
});

describe("enforceRateLimit", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("returns null while under the limit", () => {
    expect(enforceRateLimit(requestFrom("203.0.113.1"), "test", OPTIONS)).toBeNull();
  });

  it("returns a 429 with Retry-After once exceeded", async () => {
    const request = requestFrom("203.0.113.2");
    for (let i = 0; i < OPTIONS.max; i++) enforceRateLimit(request, "test", OPTIONS);

    const response = enforceRateLimit(request, "test", OPTIONS);
    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
    expect(Number(response?.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(response?.headers.get("RateLimit-Limit")).toBe(String(OPTIONS.max));
    expect(response?.headers.get("Content-Type")).toBe("application/json");

    await expect(response?.json()).resolves.toMatchObject({ error: "RATE_LIMITED" });
  });

  it("keeps separate budgets per scope", () => {
    const request = requestFrom("203.0.113.3");
    for (let i = 0; i < OPTIONS.max; i++) enforceRateLimit(request, "scope-a", OPTIONS);

    expect(enforceRateLimit(request, "scope-a", OPTIONS)).not.toBeNull();
    expect(enforceRateLimit(request, "scope-b", OPTIONS)).toBeNull();
  });

  it("keeps separate budgets per client IP", () => {
    for (let i = 0; i < OPTIONS.max; i++) {
      enforceRateLimit(requestFrom("203.0.113.4"), "test", OPTIONS);
    }

    expect(enforceRateLimit(requestFrom("203.0.113.4"), "test", OPTIONS)).not.toBeNull();
    expect(enforceRateLimit(requestFrom("203.0.113.5"), "test", OPTIONS)).toBeNull();
  });
});

describe("defaultRateLimitOptions", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env.RATE_LIMIT_WINDOW_MS = original.RATE_LIMIT_WINDOW_MS;
    process.env.RATE_LIMIT_MAX_REQUESTS = original.RATE_LIMIT_MAX_REQUESTS;
  });

  it("reads the configured values", () => {
    process.env.RATE_LIMIT_WINDOW_MS = "1000";
    process.env.RATE_LIMIT_MAX_REQUESTS = "5";
    expect(defaultRateLimitOptions()).toEqual({ windowMs: 1000, max: 5 });
  });

  it("falls back when the env vars are unset or invalid", () => {
    delete process.env.RATE_LIMIT_WINDOW_MS;
    process.env.RATE_LIMIT_MAX_REQUESTS = "not-a-number";
    expect(defaultRateLimitOptions()).toEqual({ windowMs: 900_000, max: 100 });
  });
});

describe("auth limits", () => {
  it("match the documented policy", () => {
    expect(AUTH_LOGIN_LIMIT).toEqual({ windowMs: 60_000, max: 10 });
    expect(AUTH_REGISTER_LIMIT).toEqual({ windowMs: 60_000, max: 3 });
  });
});
