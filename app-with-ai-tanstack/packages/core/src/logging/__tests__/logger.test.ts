/**
 * What the logger promises, held to it.
 *
 * Every case here reads the JSON the logger actually wrote rather than spying
 * on Pino. A logging layer that is asserted through its own mock passes just as
 * happily when it emits nothing at all, which is the failure mode that matters:
 * nobody notices missing logs until the night they are needed.
 */

import { Writable } from "node:stream";
import { beforeEach, describe, expect, it } from "vitest";

import { clearLoggerCache, getLogger } from "../logger";
import { findEvent, logSpec, profileFor, resolveLevel } from "../spec";

/** Collects the newline-delimited JSON Pino writes, one object per line. */
function capture(): { stream: Writable; lines: () => Array<Record<string, unknown>> } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });
  return {
    stream,
    lines: () =>
      chunks
        .join("")
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

const PROD = { NODE_ENV: "production" } as NodeJS.ProcessEnv;

beforeEach(() => {
  clearLoggerCache();
});

describe("the spec drives the line", () => {
  it("takes level, message and channel from the spec, not the call site", () => {
    const sink = capture();
    const log = getLogger("pipeline", { env: PROD, destination: sink.stream });

    log.event("pipeline.generation.completed", { project: "acme", files: 413, durationMs: 1200 });

    const [line] = sink.lines();
    const declared = findEvent("pipeline.generation.completed");
    expect(declared).toBeDefined();
    expect(line).toMatchObject({
      level: declared?.level,
      msg: declared?.message,
      channel: "pipeline",
      event: "pipeline.generation.completed",
      project: "acme",
      files: 413,
    });
  });

  it("emits the level names, not Pino's numbers", () => {
    const sink = capture();
    getLogger("app", { env: PROD, destination: sink.stream }).event("app.started", {
      url: "http://localhost:4001",
      port: 4001,
      env: "production",
    });

    expect(sink.lines()[0]?.level).toBe("info");
  });

  it("writes an ISO-8601 timestamp", () => {
    const sink = capture();
    getLogger("app", { env: PROD, destination: sink.stream }).event("app.started", {
      url: "u",
      port: 1,
      env: "production",
    });

    const time = sink.lines()[0]?.time;
    expect(typeof time).toBe("string");
    expect(new Date(String(time)).toISOString()).toBe(time);
  });

  it("covers error, warning and informational events from one catalogue", () => {
    const sink = capture();
    const http = getLogger("http", { env: PROD, destination: sink.stream });

    http.event("http.request.completed", {
      method: "GET",
      path: "/api/bus/account",
      status: 200,
      durationMs: 12,
      requestId: "r1",
    });
    http.event("http.request.client_error", {
      method: "POST",
      path: "/api/bus/account",
      status: 422,
      durationMs: 8,
      requestId: "r2",
      reason: "validation",
    });
    http.event("http.request.failed", {
      method: "POST",
      path: "/api/bus/account",
      status: 500,
      durationMs: 30,
      requestId: "r3",
      err: new Error("boom"),
    });

    expect(sink.lines().map((line) => line.level)).toEqual(["info", "warn", "error"]);
  });
});

describe("a mistake in a call site is loud, never silent", () => {
  it("reports an undeclared event id at warn and keeps the fields", () => {
    const sink = capture();
    getLogger("app", { env: PROD, destination: sink.stream }).event("app.no.such.event", {
      port: 4001,
    });

    const [line] = sink.lines();
    expect(line).toMatchObject({
      level: "warn",
      logSpecViolation: "unknown-event-id",
      event: "app.no.such.event",
      port: 4001,
    });
  });

  it("still emits when a declared field is missing, and marks the gap", () => {
    const sink = capture();
    getLogger("http", { env: PROD, destination: sink.stream }).event("http.request.completed", {
      method: "GET",
      path: "/api/health",
    });

    const [line] = sink.lines();
    expect(line?.level).toBe("info");
    expect(line?.logSpecMissingFields).toEqual(["status", "durationMs", "requestId"]);
  });
});

describe("redaction", () => {
  it("censors a credential wherever it appears in the payload", () => {
    const sink = capture();
    getLogger("auth", { env: PROD, destination: sink.stream }).event("auth.signin.failed", {
      email: "user@example.com",
      ip: "10.0.0.1",
      reason: "bad-credentials",
      password: "hunter2",
      token: "eyJhbGciOi",
    });

    const [line] = sink.lines();
    expect(line?.password).toBe(logSpec.redact.censor);
    expect(line?.token).toBe(logSpec.redact.censor);
    // The fields that make the line worth having survive.
    expect(line?.email).toBe("user@example.com");
    expect(line?.reason).toBe("bad-credentials");
    expect(JSON.stringify(line)).not.toContain("hunter2");
  });

  it("censors nested credentials", () => {
    const sink = capture();
    getLogger("http", { env: PROD, destination: sink.stream }).event("http.request.failed", {
      method: "POST",
      path: "/api/auth/sign-in/email",
      status: 500,
      durationMs: 5,
      requestId: "r1",
      body: { password: "hunter2", email: "user@example.com" },
    });

    expect(JSON.stringify(sink.lines()[0])).not.toContain("hunter2");
  });
});

describe("levels resolve from the spec and the environment", () => {
  it("clamps a debug channel to info in production", () => {
    expect(resolveLevel("rules", { NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe("info");
  });

  it("gives a debug channel its detail in development", () => {
    expect(resolveLevel("rules", { NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe("debug");
  });

  it("keeps an info-only channel quiet even in development", () => {
    expect(resolveLevel("http", { NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe("info");
  });

  it("lets an operator turn one channel up without touching the rest", () => {
    const env = { NODE_ENV: "production", LOG_LEVEL_DB: "debug" } as NodeJS.ProcessEnv;
    expect(resolveLevel("db", env)).toBe("debug");
    expect(resolveLevel("http", env)).toBe("info");
  });

  it("treats an unknown NODE_ENV as production rather than development", () => {
    const profile = profileFor("qa-sandbox");
    expect(profile).toEqual(logSpec.environments.production);
  });

  it("is silent under test, so a suite is not drowned by its own subject", () => {
    expect(resolveLevel("http", { NODE_ENV: "test" } as NodeJS.ProcessEnv)).toBe("silent");
  });

  it("actually drops a line below the resolved level", () => {
    const sink = capture();
    const log = getLogger("rules", {
      env: { NODE_ENV: "production" } as NodeJS.ProcessEnv,
      destination: sink.stream,
    });

    // debug in the spec, clamped to info by production.
    log.event("rules.evaluated", { entity: "Order", event: "beforeCreate", matched: 1 });
    log.event("rules.write.prevented", { entity: "Order", rule: "minTotal", reason: "too small" });

    expect(sink.lines().map((line) => line.event)).toEqual(["rules.write.prevented"]);
  });
});

describe("child loggers", () => {
  it("carries its bindings onto every line", () => {
    const sink = capture();
    const request = getLogger("http", { env: PROD, destination: sink.stream }).child({
      requestId: "abc-123",
      userId: "u-1",
    });

    request.event("http.request.completed", {
      method: "GET",
      path: "/api/health",
      status: 200,
      durationMs: 3,
      requestId: "abc-123",
    });

    expect(sink.lines()[0]).toMatchObject({ requestId: "abc-123", userId: "u-1" });
  });
});
