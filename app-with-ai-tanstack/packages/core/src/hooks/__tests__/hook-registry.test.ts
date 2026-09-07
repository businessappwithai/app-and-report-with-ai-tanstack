import { beforeEach, describe, expect, it } from "vitest";
import type { Hook } from "../../types/hook.types";
import { HookRegistry } from "../hook-registry";

describe("HookRegistry", () => {
  let registry: HookRegistry;

  beforeEach(() => {
    registry = new HookRegistry();
  });

  describe("register", () => {
    it("registers a hook for an entity and lifecycle", () => {
      const hook: Hook = {
        name: "validate",
        lifecycle: "beforeCreate",
        priority: 100,
        execute: async () => {},
      };

      registry.register("Patient", hook);
      const hooks = registry.getHooks("Patient", "beforeCreate");
      expect(hooks).toHaveLength(1);
      expect(hooks[0]?.name).toBe("validate");
    });

    it("registers multiple hooks for same entity+lifecycle", () => {
      const hook1: Hook = {
        name: "h1",
        lifecycle: "beforeCreate",
        priority: 100,
        execute: async () => {},
      };
      const hook2: Hook = {
        name: "h2",
        lifecycle: "beforeCreate",
        priority: 200,
        execute: async () => {},
      };

      registry.register("Patient", hook1);
      registry.register("Patient", hook2);

      const hooks = registry.getHooks("Patient", "beforeCreate");
      expect(hooks).toHaveLength(2);
    });

    it("sorts hooks by priority (ascending)", () => {
      const low: Hook = {
        name: "low",
        lifecycle: "beforeCreate",
        priority: 300,
        execute: async () => {},
      };
      const high: Hook = {
        name: "high",
        lifecycle: "beforeCreate",
        priority: 10,
        execute: async () => {},
      };
      const mid: Hook = {
        name: "mid",
        lifecycle: "beforeCreate",
        priority: 100,
        execute: async () => {},
      };

      registry.register("Patient", low);
      registry.register("Patient", high);
      registry.register("Patient", mid);

      const hooks = registry.getHooks("Patient", "beforeCreate");
      expect(hooks[0]?.name).toBe("high");
      expect(hooks[1]?.name).toBe("mid");
      expect(hooks[2]?.name).toBe("low");
    });

    it("keeps hooks for different entities separate", () => {
      const hook: Hook = {
        name: "h",
        lifecycle: "beforeCreate",
        priority: 100,
        execute: async () => {},
      };
      registry.register("Patient", hook);

      const patientHooks = registry.getHooks("Patient", "beforeCreate");
      const doctorHooks = registry.getHooks("Doctor", "beforeCreate");
      expect(patientHooks).toHaveLength(1);
      expect(doctorHooks).toHaveLength(0);
    });

    it("keeps hooks for different lifecycles separate", () => {
      const hook: Hook = {
        name: "h",
        lifecycle: "beforeCreate",
        priority: 100,
        execute: async () => {},
      };
      registry.register("Patient", hook);

      expect(registry.getHooks("Patient", "beforeCreate")).toHaveLength(1);
      expect(registry.getHooks("Patient", "afterCreate")).toHaveLength(0);
    });
  });

  describe("getHooks", () => {
    it("returns empty array when no hooks registered", () => {
      const hooks = registry.getHooks("Unknown", "beforeCreate");
      expect(hooks).toEqual([]);
    });
  });

  describe("clear", () => {
    it("clears all hooks when called without entity", () => {
      const hook: Hook = {
        name: "h",
        lifecycle: "beforeCreate",
        priority: 100,
        execute: async () => {},
      };
      registry.register("Patient", hook);
      registry.register("Doctor", hook);

      registry.clear();

      expect(registry.getHooks("Patient", "beforeCreate")).toHaveLength(0);
      expect(registry.getHooks("Doctor", "beforeCreate")).toHaveLength(0);
    });

    it("clears only hooks for specified entity", () => {
      const hook: Hook = {
        name: "h",
        lifecycle: "beforeCreate",
        priority: 100,
        execute: async () => {},
      };
      registry.register("Patient", hook);
      registry.register("Doctor", hook);

      registry.clear("Patient");

      expect(registry.getHooks("Patient", "beforeCreate")).toHaveLength(0);
      expect(registry.getHooks("Doctor", "beforeCreate")).toHaveLength(1);
    });

    it("clears all lifecycles for the given entity", () => {
      const h1: Hook = {
        name: "h1",
        lifecycle: "beforeCreate",
        priority: 100,
        execute: async () => {},
      };
      const h2: Hook = {
        name: "h2",
        lifecycle: "afterCreate",
        priority: 100,
        execute: async () => {},
      };
      registry.register("Patient", h1);
      registry.register("Patient", h2);

      registry.clear("Patient");

      expect(registry.getHooks("Patient", "beforeCreate")).toHaveLength(0);
      expect(registry.getHooks("Patient", "afterCreate")).toHaveLength(0);
    });
  });
});
