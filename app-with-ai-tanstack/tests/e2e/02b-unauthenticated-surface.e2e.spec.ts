/**
 * Every API route, driven by nobody.
 *
 * `02` enumerates the project-scoped routes from a hand-written list, and that
 * list is the limit of what it can notice: `/api/projects/:id/workflows` served
 * both verbs to anybody for as long as it was missing from it. So this file
 * does not keep a list. It reads the route directory, works out the path and
 * the verbs each file serves, and calls every one of them with no session.
 *
 * A route added tomorrow is covered tomorrow, without anyone remembering to add
 * it here — which is the only version of this check that stays true.
 *
 * Three endpoints are public by nature and named below. Everything else must
 * refuse. The placeholders in the paths refer to nothing that exists, so a
 * route that answers rather than refusing does no damage on the way to failing
 * this test.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { type APIRequestContext, expect, test } from "@playwright/test";

import { anonymousContext } from "./helpers";

/** Where the route files live, relative to the repository root. */
const ROUTES_DIR = join(process.cwd(), "packages", "web", "src", "routes", "api");

/**
 * The routes that must answer without a session.
 *
 * Sign-in and registration cannot require one, and the health endpoint is what
 * a load balancer calls. Everything absent from this set is expected to refuse.
 */
const PUBLIC_ROUTES = new Set(["/api/auth/login", "/api/auth/register", "/api/health"]);

/** Values for dynamic segments — well-formed, and naming nothing. */
const PLACEHOLDERS: Record<string, string> = {
  id: "proj_does_not_exist",
  versionId: "erd_does_not_exist",
  automationId: "auto_does_not_exist",
  ruleId: "rule_does_not_exist",
  workflowId: "wf_does_not_exist",
  serviceName: "NothingService",
  fileName: "nothing.ts",
  filename: "nothing.mmd",
  userId: "user_does_not_exist",
};

type Verb = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RouteUnderTest {
  /** Path as it appears on the wire, with placeholders substituted. */
  path: string;
  /** The file it came from, so a failure names something greppable. */
  file: string;
  verbs: Verb[];
}

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...walk(full));
    } else if (entry.endsWith(".ts") && !full.includes(`${sep}__tests__${sep}`)) {
      found.push(full);
    }
  }
  return found;
}

/**
 * The URL a route file serves.
 *
 * `index` means the directory itself, a `$name` segment is a parameter, a bare
 * `$` is the splat, and a dot inside the final segment is a path separator —
 * `eml.download.ts` is `/eml/download`. All four conventions are the router's,
 * not this file's invention.
 */
function pathOf(file: string): string {
  const relativePath = relative(ROUTES_DIR, file).replace(/\.ts$/, "");
  const segments = relativePath.split(sep).flatMap((segment) => segment.split("."));

  const rendered = segments
    .filter((segment) => segment !== "index")
    .map((segment) => {
      if (segment === "$") return "splat";
      if (segment.startsWith("$")) {
        const name = segment.slice(1);
        return PLACEHOLDERS[name] ?? `${name}_does_not_exist`;
      }
      return segment;
    });

  return `/api${rendered.length ? `/${rendered.join("/")}` : ""}`;
}

/** The verbs a route file actually handles. */
function verbsOf(file: string): Verb[] {
  const source = readFileSync(file, "utf8");
  const verbs: Verb[] = [];
  for (const verb of ["GET", "POST", "PUT", "PATCH", "DELETE"] as const) {
    // Both route styles in the tree declare a handler the same way:
    // `GET: async ({ … }) =>`, either inside `server.handlers` or directly.
    if (new RegExp(`^\\s*${verb}:\\s*async`, "m").test(source)) verbs.push(verb);
  }
  return verbs;
}

/** The public path a file serves, before placeholders — used for the allowlist. */
function isPublic(path: string): boolean {
  return PUBLIC_ROUTES.has(path);
}

function collectRoutes(): RouteUnderTest[] {
  return walk(ROUTES_DIR)
    .map((file) => ({
      path: pathOf(file),
      file: relative(process.cwd(), file),
      verbs: verbsOf(file),
    }))
    .filter((route) => route.verbs.length > 0 && !isPublic(route.path))
    .sort((a, b) => a.path.localeCompare(b.path));
}

async function call(request: APIRequestContext, verb: Verb, path: string): Promise<number> {
  const options = { failOnStatusCode: false, timeout: 30_000 } as const;
  switch (verb) {
    case "GET":
      return (await request.get(path, options)).status();
    case "POST":
      return (await request.post(path, { ...options, data: {} })).status();
    case "PUT":
      return (await request.put(path, { ...options, data: {} })).status();
    case "PATCH":
      return (await request.patch(path, { ...options, data: {} })).status();
    case "DELETE":
      return (await request.delete(path, options)).status();
  }
}

test.describe("the API surface, as seen by nobody", () => {
  let anonymous: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    anonymous = await anonymousContext(playwright);
  });

  test.afterAll(async () => {
    await anonymous.dispose();
  });

  test("finds the route files to drive", () => {
    const routes = collectRoutes();

    // A path derivation that silently produced nothing would make every
    // assertion below vacuous, and the file would go on passing while testing
    // no routes at all.
    expect(routes.length).toBeGreaterThan(20);
    expect(routes.map((route) => route.path)).toContain("/api/rules");
  });

  test("every route that is not deliberately public refuses a caller with no session", async () => {
    test.setTimeout(180_000);

    const served: string[] = [];

    for (const route of collectRoutes()) {
      for (const verb of route.verbs) {
        const status = await call(anonymous, verb, route.path);

        // Anything below 400 means the route did the work for an anonymous
        // caller. 404 is an acceptable refusal — several routes answer that
        // way rather than confirm an id exists — and 405 means the verb was
        // read from the file but the router does not serve it.
        if (status < 400) served.push(`${verb} ${route.path} -> ${status} (${route.file})`);
      }
    }

    expect(served, "these routes served a caller with no session").toEqual([]);
  });

  test("the public three still answer", async () => {
    // The counterweight: a guard applied to sign-in would make the test above
    // pass and the product unusable.
    expect((await anonymous.get("/api/health", { failOnStatusCode: false })).status()).toBe(200);

    // Wrong credentials, but reachable — 401 is the endpoint working.
    const login = await anonymous.post("/api/auth/login", {
      data: { email: "nobody@example.com", password: "not-a-password" },
      failOnStatusCode: false,
    });
    expect(login.status()).toBe(401);

    // Registration answers 400 to an empty body rather than refusing the caller.
    const register = await anonymous.post("/api/auth/register", {
      data: {},
      failOnStatusCode: false,
    });
    expect(register.status()).toBeLessThan(500);
    expect(register.status()).not.toBe(401);
  });
});
