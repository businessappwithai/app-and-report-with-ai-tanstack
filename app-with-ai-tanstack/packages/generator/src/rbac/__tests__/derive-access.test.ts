/**
 * Tests for the roles, users and visibility both stacks seed.
 *
 * The properties worth holding are the ones a reader can check by signing in:
 * every declared role exists, every role has an account, and an entity is
 * hidden from a role only when the model restricted *reading* it.
 */

import { describe, expect, it } from "vitest";
import { compileRbac } from "../index";
import { deriveAccess } from "../roles";

const compile = (lines: string[]) =>
  compileRbac(lines.join("\n"), ["Lead", "Account", "SupportCase", "Order"]);

const derive = (lines: string[]) => deriveAccess(compile(lines), { projectId: "acme-crm" });

describe("derived access", () => {
  it("always seeds an administrator and a role-less user", () => {
    const access = derive([]);
    expect(access.roles.map((role) => role.name)).toEqual(["Administrator", "User"]);
    expect(access.roles[0]?.isAdmin).toBe(true);
    expect(access.users[0]?.email).toBe("admin@admin.com");
  });

  it("seeds a role for every role the model names, once", () => {
    const access = derive([
      "%%rbac role:sales_rep|sales_manager on Lead.*",
      "%%rbac role:sales_manager on Lead.delete",
      "%%rbac role:support_agent on SupportCase.*",
    ]);
    expect(access.roles.map((role) => role.name)).toEqual([
      "Administrator",
      "User",
      "Sales Manager",
      "Sales Rep",
      "Support Agent",
    ]);
  });

  it("does not seed a second Administrator when the model names one", () => {
    const access = derive(["%%rbac role:administrator on Order.delete"]);
    expect(access.roles.filter((role) => role.name === "Administrator")).toHaveLength(1);
  });

  it("gives every role exactly one account, on the project's domain", () => {
    const access = derive(["%%rbac role:sales_rep on Lead.*"]);
    expect(access.users).toHaveLength(access.roles.length);
    const sales = access.users.find((user) => user.roleName === "Sales Rep");
    /* A dot, not an underscore: it is a sign-in box, and every directory in the
       world spells an address this way. */
    expect(sales?.email).toBe("sales.rep@acme-crm.example.com");
    expect(sales?.isAdmin).toBe(false);
  });

  it("makes an entity visible only to the roles allowed to read it", () => {
    const access = derive([
      "%%rbac role:sales_rep|sales_manager on Lead.*",
      "%%rbac role:support_agent on SupportCase.read",
    ]);
    expect(access.entityVisibility.Lead).toEqual(["sales_manager", "sales_rep"]);
    expect(access.entityVisibility.SupportCase).toEqual(["support_agent"]);
    expect(access.scoped).toBe(true);
  });

  it("leaves navigation alone for a restriction that is not about reading", () => {
    /* The whole reason visibility is derived from `read` and nothing else: a
       model protecting deletion must not thereby hide the window. */
    const access = derive([
      "%%rbac role:administrator on Order.delete",
      "%%rbac role:sales_manager on Lead.update",
    ]);
    expect(access.entityVisibility).toEqual({});
    expect(access.scoped).toBe(false);
    /* …but the roles it named still have to exist and be signable-in. */
    expect(access.roles.map((role) => role.name)).toContain("Sales Manager");
  });

  it("merges two directives that both grant read on one entity", () => {
    const access = derive([
      "%%rbac role:sales_rep on Account.read",
      "%%rbac role:support_agent on Account.read",
    ]);
    expect(access.entityVisibility.Account).toEqual(["sales_rep", "support_agent"]);
  });
});
