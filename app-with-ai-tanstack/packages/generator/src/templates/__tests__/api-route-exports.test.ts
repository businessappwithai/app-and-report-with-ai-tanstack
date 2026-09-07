/**
 * Regression: ISSUE-004 — every /api call in a generated app answered 500.
 *
 * The three API proxy route templates each ended with `export const APIRoute =
 * Route`, an alias of the export above it. Two consumers read these files and
 * they want opposite things:
 *
 *   - TanStack's route-tree generator parses the file and requires `Route` to
 *     be initialised by a CallExpression directly. Assigning it from a local
 *     const fails the generate, and a failed generate leaves no
 *     `routeTree.gen.ts` for the rest of the frontend to import.
 *   - The dev server imports the same file as `?pick=APIRoute`, which strips
 *     every other export. An `APIRoute` written as `= Route` is then left
 *     pointing at a binding that is gone, and the module throws
 *     `ReferenceError: Route is not defined` before a single request is served.
 *
 * So a freshly generated application could not sign in — `POST
 * /api/auth/sign-in/email` answered 500 while the NestJS backend answered that
 * exact request with 200 and a session cookie. Nothing in the generated app
 * worked in a browser.
 *
 * Two calls over one shared, non-exported handlers object satisfies both. This
 * pins that shape: each export is its own CallExpression, and neither reads the
 * other.
 *
 * Found by /qa on 2026-09-01
 * Report: .gstack/qa-reports/qa-report-dance-studio-qa-2026-09-01.md
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const API_ROUTES = join(
  import.meta.dirname,
  "../../../templates/tanstack-start-nestjs/frontend/src/routes/api"
);

const TEMPLATES = ["$.ts.hbs", "auth/$.ts.hbs", "copilotkit/$.ts.hbs"];

describe.each(TEMPLATES)("api route template %s", (name) => {
  const source = readFileSync(join(API_ROUTES, name), "utf8");

  it("exports both names the two readers look for", () => {
    expect(source).toMatch(/^export const Route = /m);
    expect(source).toMatch(/^export const APIRoute = /m);
  });

  it("initialises each export with its own call, never an alias of the other", () => {
    // `= Route` / `= APIRoute` is the exact shape that broke: it satisfies one
    // reader and is erased out from under the other.
    expect(source).not.toMatch(/^export const APIRoute = Route\s*$/m);
    expect(source).not.toMatch(/^export const Route = APIRoute\s*$/m);
    expect(source).toMatch(/^export const Route = createAPIFileRoute\(/m);
    expect(source).toMatch(/^export const APIRoute = createAPIFileRoute\(/m);
  });

  it("gives both exports the same route path and the same handlers", () => {
    const paths = [...source.matchAll(/createAPIFileRoute\('([^']+)'\)/g)].map((m) => m[1]);
    expect(paths).toHaveLength(2);
    expect(new Set(paths).size).toBe(1);

    const bodies = [...source.matchAll(/createAPIFileRoute\('[^']+'\)\((\w+)\)/g)].map((m) => m[1]);
    expect(bodies).toEqual(["handlers", "handlers"]);
  });
});
