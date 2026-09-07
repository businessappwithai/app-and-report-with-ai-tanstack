/**
 * Rate limiting, in a file that runs last.
 *
 * The limiter is a fixed window keyed by IP, and every test in this suite comes
 * from the same one. Exhausting the sign-in budget is the whole point of the
 * test below, so it has to be the last thing that happens: run mid-suite, it
 * left every later spec unable to sign in, and they failed with a 401 that had
 * nothing to do with what they were asserting.
 *
 * The `09-` prefix is load-bearing. Playwright runs files in path order with a
 * single worker, so nothing that needs a session may sort after this.
 */

import { expect, test } from "@playwright/test";

import { AUTH_LOGIN_MAX_PER_MINUTE } from "../../playwright.config";
import { unique } from "./helpers";

test.describe("rate limiting", () => {
  test("refuses sign-in attempts past the limit, and says when to retry", async ({ request }) => {
    // The limit is per IP per minute, configurable, and the suite runs the
    // server with a raised one so its own sign-ins do not trip it. Read the same
    // value here: the assertion is that the limiter engages at whatever it is
    // configured to, not at a number written twice.
    const email = `${unique("bruteforce")}@example.com`;
    const statuses: number[] = [];
    const ceiling = AUTH_LOGIN_MAX_PER_MINUTE + 4;

    for (let attempt = 0; attempt < ceiling; attempt++) {
      const response = await request.post("/api/auth/login", {
        data: { email, password: `guess-${attempt}` },
        failOnStatusCode: false,
      });
      statuses.push(response.status());

      if (response.status() === 429) {
        // A 429 without this header tells a well-behaved client nothing about
        // when to come back, so it either gives up or hammers.
        expect(response.headers()["retry-after"]).toBeTruthy();
        break;
      }
    }

    expect(statuses, "the limiter never engaged — sign-in is open to unlimited guessing").toContain(
      429
    );
  });
});
