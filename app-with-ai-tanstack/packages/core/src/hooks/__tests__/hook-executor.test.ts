import { afterEach, describe, expect, it } from "vitest";
import type { Hook } from "../../types/hook.types";
import { HookExecutor } from "../hook-executor";
import { globalHookRegistry } from "../hook-registry";

// Use the real global registry but clean up after each test
afterEach(() => {
  globalHookRegistry.clear();
});

const executor = new HookExecutor();

describe("HookExecutor", () => {
  describe("execute", () => {
    it("returns data unchanged when no hooks are registered", async () => {
      const data = { name: "John", age: 30 };
      const result = await executor.execute("Patient", "beforeCreate", data);
      expect(result).toEqual(data);
    });

    it("passes data through a hook that transforms it", async () => {
      const hook: Hook = {
        name: "uppercase",
        lifecycle: "beforeCreate",
        priority: 100,
        execute: async (ctx) => {
          const d = ctx.data as { name: string };
          return { ...d, name: d.name.toUpperCase() };
        },
      };
      globalHookRegistry.register("Patient", hook);

      const result = await executor.execute("Patient", "beforeCreate", { name: "john" });
      expect(result).toEqual({ name: "JOHN" });
    });

    it("chains multiple hooks in priority order", async () => {
      const order: number[] = [];

      const hook1: Hook = {
        name: "first",
        lifecycle: "beforeCreate",
        priority: 10,
        execute: async (ctx) => {
          order.push(1);
          return ctx.data;
        },
      };
      const hook2: Hook = {
        name: "second",
        lifecycle: "beforeCreate",
        priority: 20,
        execute: async (ctx) => {
          order.push(2);
          return ctx.data;
        },
      };
      globalHookRegistry.register("Patient", hook2); // register in reverse order
      globalHookRegistry.register("Patient", hook1);

      await executor.execute("Patient", "beforeCreate", {});
      expect(order).toEqual([1, 2]); // priority 10 before 20
    });

    it("preserves data when hook returns void (side-effect only)", async () => {
      const originalData = { name: "John" };

      const sideEffectHook: Hook = {
        name: "sideEffect",
        lifecycle: "afterCreate",
        priority: 100,
        execute: async () => {
          // side effect only — no return
        },
      };
      globalHookRegistry.register("Patient", sideEffectHook);

      const result = await executor.execute("Patient", "afterCreate", originalData);
      expect(result).toEqual(originalData);
    });

    it("passes updated data between chained hooks", async () => {
      const addAge: Hook = {
        name: "addAge",
        lifecycle: "beforeCreate",
        priority: 10,
        execute: async (ctx) => ({ ...(ctx.data as object), age: 25 }),
      };
      const addEmail: Hook = {
        name: "addEmail",
        lifecycle: "beforeCreate",
        priority: 20,
        execute: async (ctx) => ({ ...(ctx.data as object), email: "test@example.com" }),
      };
      globalHookRegistry.register("User", addAge);
      globalHookRegistry.register("User", addEmail);

      const result = await executor.execute("User", "beforeCreate", { name: "Alice" });
      expect(result).toEqual({ name: "Alice", age: 25, email: "test@example.com" });
    });

    it("only executes hooks for the matching entity and lifecycle", async () => {
      const executed: string[] = [];

      globalHookRegistry.register("Patient", {
        name: "patientBefore",
        lifecycle: "beforeCreate",
        priority: 100,
        execute: async () => {
          executed.push("patientBefore");
        },
      });
      globalHookRegistry.register("Doctor", {
        name: "doctorBefore",
        lifecycle: "beforeCreate",
        priority: 100,
        execute: async () => {
          executed.push("doctorBefore");
        },
      });
      globalHookRegistry.register("Patient", {
        name: "patientAfter",
        lifecycle: "afterCreate",
        priority: 100,
        execute: async () => {
          executed.push("patientAfter");
        },
      });

      await executor.execute("Patient", "beforeCreate", {});
      expect(executed).toEqual(["patientBefore"]);
    });
  });
});
