/**
 * Shared fixtures for the modelling tool's end-to-end suite.
 *
 * These tests drive the built application over HTTP and in a browser, against a
 * real PostgreSQL. They are deliberately API-heavy: the product's critical
 * surface is authorization and code generation, both of which are decided on the
 * server, and a click-through that asserts a button turned green proves less
 * about either than a request that asserts a 403.
 *
 * The seeded administrator is what `bun run seed:admin` creates. Its credentials
 * are fixed and known — that is the point of a bootstrap account — so the suite
 * uses it rather than registering a user it would then have to approve as
 * somebody else.
 */

import type { APIRequestContext, Page, PlaywrightWorkerArgs } from "@playwright/test";
import { expect } from "@playwright/test";

import { BASE_URL } from "../../playwright.config";

/** The bootstrap administrator, as `scripts/seed-admin-account.ts` writes it. */
export const ADMIN = {
  email: "admin@admin.com",
  password: "administrator",
} as const;

/**
 * A value no other run will produce.
 *
 * Every test in this suite leaves its rows behind — there is no teardown, and a
 * re-run against a populated database is the normal case — so anything that has
 * to be unique carries this.
 */
export function unique(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface SignInResult {
  status: number;
  body: unknown;
  /** The `Set-Cookie` value, when the sign-in produced a session. */
  cookie: string | null;
}

/** Sign in over the API and return the raw outcome, successful or not. */
export async function signIn(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<SignInResult> {
  const response = await request.post("/api/auth/login", {
    data: { email, password },
    failOnStatusCode: false,
  });

  return {
    status: response.status(),
    body: await response.json().catch(() => null),
    cookie: response.headers()["set-cookie"] ?? null,
  };
}

/**
 * Sign in as the administrator, failing the test loudly if that is not possible.
 *
 * A suite whose fixture silently failed to authenticate would go on to assert
 * 401s everywhere and pass, having tested nothing — so this asserts rather than
 * returning a null session.
 */
export async function signInAsAdmin(request: APIRequestContext): Promise<void> {
  const result = await signIn(request, ADMIN.email, ADMIN.password);
  expect(
    result.status,
    `could not sign in as ${ADMIN.email}. Run "bun run seed:admin" against the test database.`
  ).toBe(200);
}

/** Sign in through the browser, so the session cookie lands in the page context. */
export async function signInThroughBrowser(page: Page): Promise<void> {
  const response = await page.request.post("/api/auth/login", {
    data: { email: ADMIN.email, password: ADMIN.password },
    failOnStatusCode: false,
  });
  expect(response.status(), "browser sign-in failed").toBe(200);
}

/** Create a project and return its id. */
export async function createProject(
  request: APIRequestContext,
  name = unique("e2e-project")
): Promise<string> {
  const response = await request.post("/api/projects", {
    data: { name, description: "Created by the end-to-end suite" },
    failOnStatusCode: false,
  });

  expect(response.status(), `creating a project answered ${response.status()}`).toBeLessThan(300);

  const body = (await response.json()) as { id?: string; project?: { id?: string } };
  const id = body.id ?? body.project?.id;
  expect(id, "the create-project response carried no id").toBeTruthy();
  return id as string;
}

/**
 * A small but complete EML model.
 *
 * Inline rather than read from `examples/`, because a test that breaks when
 * somebody edits an example is a test about the example. Two entities and one
 * relationship is enough to exercise parse, validate and generate.
 */
export const SAMPLE_EML = `erDiagram
    Customer ||--o{ Order : places

    Customer {
        uuid id PK
        string name
        string email
    }

    Order {
        uuid id PK
        uuid customer_id FK
        string status
        decimal total
    }

%%meta name: E2E Sample
%%entity Customer help: Somebody who buys something.
%%entity Order help: One purchase made by a customer.
%%enum OrderStatus: draft, submitted, shipped
%%field Order.status enum: OrderStatus
`;

// ── Accounts ────────────────────────────────────────────────────────────────

/**
 * A registered, approved, signed-in account with its own cookie jar.
 *
 * Most of the modelling surface cannot be exercised as the administrator: the
 * project routes refuse a caller whose role is `admin` outright — "Admins
 * cannot modify projects" — because the administrator's job in this tool is to
 * approve people, not to build with them. So a suite that drives design, rules,
 * automations or sharing needs a real user, and usually two.
 */
export interface UserSession {
  email: string;
  password: string;
  /** The account's id, as the admin listing reports it. */
  id: string;
  /** A request context already carrying this account's session cookie. */
  request: APIRequestContext;
}

/** The password every account this suite creates is given. */
const PASSWORD = "TestPassword123!";

/** A request context pointed at the suite's server, with no session. */
export async function anonymousContext(
  playwright: PlaywrightWorkerArgs["playwright"]
): Promise<APIRequestContext> {
  return playwright.request.newContext({ baseURL: BASE_URL });
}

/**
 * Register an account, have the administrator approve it, and sign it in.
 *
 * Registration is approval-gated by design, so all three steps are needed
 * before the account can do anything — a suite that skipped the approval would
 * be asserting against a 403 it caused itself.
 *
 * `admin` is a context already signed in as the administrator; the returned
 * context is a separate cookie jar, so the two sessions never overwrite each
 * other. Dispose it with `session.request.dispose()`.
 */
export async function createUserSession(
  playwright: PlaywrightWorkerArgs["playwright"],
  admin: APIRequestContext,
  label = "e2e-user"
): Promise<UserSession> {
  const email = `${unique(label)}@example.com`;
  const request = await anonymousContext(playwright);

  const registration = await request.post("/api/auth/register", {
    data: { email, password: PASSWORD, name: label },
    failOnStatusCode: false,
  });
  expect(registration.status(), `registering ${email} answered ${registration.status()}`).toBe(202);

  const listing = await admin.get("/api/admin/users", { failOnStatusCode: false });
  expect(listing.status(), "the administrator could not list users").toBe(200);
  const { users } = (await listing.json()) as { users: Array<{ id: string; email: string }> };
  const created = users.find((user) => user.email === email);
  expect(created, `${email} did not appear in the admin listing`).toBeTruthy();

  const approval = await admin.post(`/api/admin/users/${created?.id}/approve`, {
    failOnStatusCode: false,
  });
  expect(approval.status(), `approving ${email} answered ${approval.status()}`).toBeLessThan(300);

  const signedIn = await signIn(request, email, PASSWORD);
  expect(signedIn.status, `${email} could not sign in after approval`).toBe(200);

  return { email, password: PASSWORD, id: String(created?.id), request };
}

/** An administrator context of its own, so a suite can approve accounts. */
export async function adminContext(
  playwright: PlaywrightWorkerArgs["playwright"]
): Promise<APIRequestContext> {
  const request = await anonymousContext(playwright);
  await signInAsAdmin(request);
  return request;
}

// ── Models ──────────────────────────────────────────────────────────────────

/**
 * Give a project a model, the way the design step does.
 *
 * A project is created without one; `erd_versions` is where the document lives,
 * and the current version is what every other route reads. Returns the version
 * id so a suite can restore or delete it.
 */
export async function saveModel(
  request: APIRequestContext,
  projectId: string,
  mermaidCode: string,
  description = "Saved by the end-to-end suite"
): Promise<string> {
  const response = await request.post(`/api/projects/${projectId}/erd-versions`, {
    data: { mermaidCode, description },
    failOnStatusCode: false,
  });
  expect(response.status(), `saving a model answered ${response.status()}`).toBe(201);

  const body = (await response.json()) as { version?: { id?: string } };
  expect(body.version?.id, "the saved version carried no id").toBeTruthy();
  return String(body.version?.id);
}

/**
 * The same model as `SAMPLE_EML`, carrying behaviour as well as structure.
 *
 * Rules, a state machine and a hook, so a suite can assert that what the design
 * phase writes survives a save, a version restore and a parse — the three
 * places a directive has historically been dropped.
 */
export const BEHAVIOUR_EML = `erDiagram
    Customer ||--o{ Order : places

    Customer {
        uuid id PK
        string name
        string email
    }

    Order {
        uuid id PK
        uuid customer_id FK
        string status
        decimal total
    }

%%meta name: E2E Behaviour
%%entity Customer help: Somebody who buys something.
%%entity Order help: One purchase made by a customer.
%%enum OrderStatus: draft, submitted, shipped
%%field Order.status enum: OrderStatus
%%workflow OrderLifecycle entity: Order kind: state
%%action rejectNegativeTotal validation-error when: total < 0 message: An order cannot be negative.
%%hook beforeCreate auditOrder on Order
%%rbac role:sales on Order.read
`;
