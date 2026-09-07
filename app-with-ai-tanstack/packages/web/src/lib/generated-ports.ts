/**
 * Where a generated application listens.
 *
 * These mirror `DEFAULT_FRONTEND_PORT` / `DEFAULT_BACKEND_PORT` in
 * `packages/generator/src/generators/ports.ts`, which is the source of truth
 * for what generated code actually binds to. They are restated here because
 * this module is imported by client components, and `@appwithai/generator` is
 * a server-only package in this app's bundling setup. A unit test asserts the
 * two stay equal, so the copy cannot drift silently.
 */

/** The application itself — the address someone opens. */
export const DEFAULT_APP_PORT = 4000;

/** The API beside it. */
export const DEFAULT_API_PORT = 4001;

/**
 * Every project needs two adjacent ports, not one.
 *
 * Allocating one port per project and letting the API take `port + 1` meant
 * consecutive projects overlapped: project A's API and project B's app were
 * both 4002, and whichever started second failed to bind. Stepping by two
 * hands each project a pair it owns outright.
 */
export const PORTS_PER_PROJECT = 2;

/**
 * The next free app port, given the app ports already handed out.
 *
 * Returns the app port; the API is that plus one.
 */
export function nextAvailableAppPort(usedPorts: Array<number | undefined | null>): number {
  const taken = new Set(usedPorts.filter((port): port is number => typeof port === "number"));
  let candidate = DEFAULT_APP_PORT;
  // A project already on 4000 also occupies 4001, so a pair is free only when
  // neither of its ports has been claimed by an earlier project.
  while (taken.has(candidate) || taken.has(candidate + 1)) {
    candidate += PORTS_PER_PROJECT;
  }
  return candidate;
}
