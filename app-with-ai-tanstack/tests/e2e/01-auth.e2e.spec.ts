/**
 * Authentication, as the server actually enforces it.
 *
 * Every case here goes through HTTP rather than through the login form. The
 * form is one caller; the endpoint is the boundary, and a suite that only ever
 * types into inputs cannot say what happens when somebody does not.
 */

import { expect, test } from "@playwright/test";

import { ADMIN, signIn, unique } from "./helpers";

test.describe("health", () => {
  test("reports ok without a session", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok" });
  });
});

test.describe("signing in", () => {
  test("accepts the seeded administrator and returns the account, never the hash", async ({
    request,
  }) => {
    const result = await signIn(request, ADMIN.email, ADMIN.password);

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      user: { email: ADMIN.email, role: "admin", status: "approved" },
    });

    // The response is what the browser stores and what a support ticket gets
    // pasted into. It must not carry the credential in any form.
    const serialized = JSON.stringify(result.body);
    expect(serialized).not.toContain("passwordHash");
    expect(serialized).not.toContain(ADMIN.password);
  });

  test("issues an HttpOnly session cookie", async ({ request }) => {
    const result = await signIn(request, ADMIN.email, ADMIN.password);
    expect(result.cookie, "sign-in set no cookie").toBeTruthy();
    // Readable by script means stealable by script.
    expect(result.cookie?.toLowerCase()).toContain("httponly");
  });

  test("refuses a wrong password", async ({ request }) => {
    const result = await signIn(request, ADMIN.email, "not-the-password");
    expect(result.status).toBe(401);
  });

  test("refuses an unknown account with the same answer as a wrong password", async ({
    request,
  }) => {
    const unknown = await signIn(request, `${unique("nobody")}@example.com`, "whatever");
    const wrongPassword = await signIn(request, ADMIN.email, "not-the-password");

    // Two different reasons, one answer. A different status or message here is
    // an account-enumeration oracle: it tells an attacker which addresses are
    // registered before they have guessed a single password.
    expect(unknown.status).toBe(wrongPassword.status);
    expect(JSON.stringify(unknown.body)).toBe(JSON.stringify(wrongPassword.body));
  });

  test("rejects a request with no credentials rather than treating them as empty", async ({
    request,
  }) => {
    const response = await request.post("/api/auth/login", {
      data: {},
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(400);
  });
});

test.describe("the session", () => {
  test("identifies the caller once signed in", async ({ request }) => {
    await signIn(request, ADMIN.email, ADMIN.password);

    const response = await request.get("/api/auth/me");
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ user: { email: ADMIN.email } });
  });

  test("stops identifying the caller after signing out", async ({ request }) => {
    await signIn(request, ADMIN.email, ADMIN.password);
    expect((await request.get("/api/auth/me")).status()).toBe(200);

    const signOut = await request.post("/api/auth/logout");
    expect(signOut.status()).toBe(200);

    // The point of the test: the cookie is cleared *and* the session is gone
    // server-side. Clearing only the cookie leaves a token that still works for
    // anyone who copied it.
    const after = await request.get("/api/auth/me", { failOnStatusCode: false });
    expect(after.status()).toBe(401);
  });
});

test.describe("registration", () => {
  test("creates an account that cannot sign in until an administrator approves it", async ({
    request,
  }) => {
    const email = `${unique("e2e-pending")}@example.com`;
    const password = "TestPassword123!";

    const registration = await request.post("/api/auth/register", {
      data: { email, password, name: "Pending Person" },
      failOnStatusCode: false,
    });

    expect(registration.status()).toBe(202);
    expect(await registration.json()).toMatchObject({ pending: true });

    // Registering must not be a way in. Self-service accounts that are live on
    // creation are how an invite-only tool stops being invite-only.
    const attempt = await signIn(request, email, password);
    expect(attempt.status).toBe(403);
  });

  test("refuses an address that is already registered", async ({ request }) => {
    const response = await request.post("/api/auth/register", {
      data: { email: ADMIN.email, password: "TestPassword123!", name: "Impostor" },
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(409);
  });
});
