import { DEFAULT_BACKEND_PORT, DEFAULT_FRONTEND_PORT } from "@appwithai/generator/generators/ports";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_API_PORT,
  DEFAULT_APP_PORT,
  nextAvailableAppPort,
  PORTS_PER_PROJECT,
} from "@/lib/generated-ports";

describe("generated ports", () => {
  // The web app restates these because @appwithai/generator is server-only in
  // this bundling setup, and the numbers are needed in a client component. A
  // restatement that drifts is worse than none — the UI would promise a port
  // the generated code does not bind to.
  it("matches what the generator actually writes", () => {
    expect(DEFAULT_APP_PORT).toBe(DEFAULT_FRONTEND_PORT);
    expect(DEFAULT_API_PORT).toBe(DEFAULT_BACKEND_PORT);
  });

  it("puts the API directly above the app", () => {
    expect(DEFAULT_API_PORT).toBe(DEFAULT_APP_PORT + 1);
    expect(PORTS_PER_PROJECT).toBe(2);
  });

  describe("nextAvailableAppPort", () => {
    it("starts at the default when nothing is allocated", () => {
      expect(nextAvailableAppPort([])).toBe(DEFAULT_APP_PORT);
    });

    it("leaves room for the API of the project before it", () => {
      // The old allocator stepped by one and handed out 4001 next, which is the
      // API port of the project already on 4000.
      expect(nextAvailableAppPort([4000])).toBe(4002);
      expect(nextAvailableAppPort([4000, 4002])).toBe(4004);
    });

    it("skips a pair whose API port is taken", () => {
      // A project allocated under the old scheme can sit on an odd port.
      expect(nextAvailableAppPort([4001])).toBe(4002);
    });

    it("ignores gaps that are genuinely free", () => {
      expect(nextAvailableAppPort([4002])).toBe(4000);
    });

    it("tolerates missing ports on older projects", () => {
      expect(nextAvailableAppPort([undefined, null, 4000])).toBe(4002);
    });
  });
});
