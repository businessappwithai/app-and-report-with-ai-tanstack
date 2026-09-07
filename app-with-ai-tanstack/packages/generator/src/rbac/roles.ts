/**
 * Functional roles, the users who hold them, and what each one can see.
 *
 * `%%rbac` compiles to per-operation rules, which is enough to *refuse* a
 * request and not enough to build an application around. Three things were
 * still missing, and all three have to be answered the same way in both stacks
 * or the demonstration contradicts itself:
 *
 * - **Which roles exist.** A model naming `role:sales_manager` has to produce a
 *   role somebody can be given, or the restriction it wrote can never be
 *   satisfied by anyone but the administrator.
 * - **Who holds them.** An application seeded with one administrator can only
 *   ever be looked at as an administrator, and an administrator bypasses every
 *   rule — so the access control the model declared is invisible in the one
 *   account that exists. One user per role is what makes it observable: sign in
 *   as `sales@…` and the application *is* the sales application.
 * - **What each role may look at.** `read` is the operation that decides
 *   whether an entity belongs to a role at all, and it is the only one that may
 *   narrow the navigation.
 *
 * ## Only `read` narrows visibility
 *
 * This is the constraint the whole file turns on, and it is deliberate.
 * `packages/generator/src/rbac/index.ts` explains why `%%rbac` must not write
 * the dictionary's grant table wholesale: a model restricting *deletion* of
 * `Order` to admins would otherwise hide the Order window from everybody,
 * turning a restriction on deleting into a restriction on looking.
 *
 * A restriction on `read` is the one case where those two coincide. A role that
 * may not read an entity has no use for a menu item that 403s, so
 * `entityVisibility` is derived from `read` rules alone and every other
 * operation leaves the navigation exactly as it was. A model that declares no
 * `read` restriction anywhere gets the behaviour it had before this file
 * existed: every signed-in user sees every entity.
 */

import type { CompiledRbac } from "./index";

/** A role the application seeds, whether declared by the model or built in. */
export interface DerivedRole {
  /** Title-cased for display: `sales_manager` -> `Sales Manager`. */
  name: string;
  /** The spelling the model used, which is what the guards match on. */
  declaredAs: string;
  description: string;
  isAdmin: boolean;
  /** `S` for a system role, `U` for an ordinary one. */
  userLevel: string;
}

/** One seeded account, so every role can actually be signed in as. */
export interface DerivedUser {
  email: string;
  name: string;
  /** The role's display name, matching `DerivedRole.name`. */
  roleName: string;
  description: string;
  isAdmin: boolean;
}

/** Which roles may read an entity. Absent entity = readable by anyone. */
export type EntityVisibility = Record<string, string[]>;

export interface DerivedAccess {
  roles: DerivedRole[];
  users: DerivedUser[];
  /** Entity name -> the roles its `read` rule admits. Empty when none declared. */
  entityVisibility: EntityVisibility;
  /**
   * Role display name -> how many entities it may read.
   *
   * Computed here rather than at each screen because it is the one number that
   * makes a list of seeded accounts worth reading: `Support Agent · 5 of 17`
   * says what signing in as that role will do, where an address alone says
   * nothing. Both stacks print it, so it has to be one calculation.
   */
  entityCounts: Record<string, number>;
  /** True when at least one entity is restricted, so navigation must be scoped. */
  scoped: boolean;
}

/** `sales_manager` -> `Sales Manager`. */
export function titleCaseRole(name: string): string {
  return name
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * `sales_manager` -> `sales.manager`, so the address is readable and routable.
 *
 * Underscores are legal in the local part of an address and read badly in a
 * sign-in box next to nine others; a dot is the convention every directory uses.
 */
function localPart(name: string): string {
  return name
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .join(".");
}

const ADMIN_ROLE = "Administrator";

/**
 * Roles the model does not have to declare.
 *
 * `Administrator` is the master role every guard bypasses for, and the one
 * account whose address is fixed — `admin@admin.com` is what the generated
 * sign-in screen, the CLI's closing message and every chapter of the guide
 * print. `User` is the floor: an account holding no functional role at all,
 * which is what proves a restriction restricts.
 */
const BUILT_IN: DerivedRole[] = [
  {
    name: ADMIN_ROLE,
    declaredAs: "administrator",
    description: "Full access to every entity, and bypasses every restriction",
    isAdmin: true,
    userLevel: "S",
  },
  {
    name: "User",
    declaredAs: "user",
    description: "Signed in, holding no functional role",
    isAdmin: false,
    userLevel: "U",
  },
];

export interface DeriveAccessOptions {
  /** Domain for the seeded addresses, e.g. `acme-crm`. */
  projectId: string;
  /** Every entity the model declares, so the counts have a denominator. */
  entities?: string[];
  /** The administrator's address; defaults to `admin@admin.com`. */
  adminEmail?: string;
  /** The administrator's display name. */
  adminName?: string;
}

/**
 * Turn compiled `%%rbac` into the roles, users and visibility both stacks seed.
 *
 * Pure, and deliberately so: the NestJS build renders it into a Handlebars seed
 * and the browser build writes it into `model.json`, and neither may reach a
 * filesystem or a database to work out what the other will do.
 */
export function deriveAccess(compiled: CompiledRbac, options: DeriveAccessOptions): DerivedAccess {
  const declared = new Map<string, string>();
  const remember = (role: string) => {
    const key = role.toLowerCase();
    if (!declared.has(key)) declared.set(key, role);
  };
  for (const rule of compiled.operations) for (const role of rule.roles) remember(role);
  for (const rule of compiled.transitions) for (const role of rule.roles) remember(role);

  const roles: DerivedRole[] = BUILT_IN.map((role) => ({ ...role }));
  const taken = new Set(roles.map((role) => role.name.toLowerCase()));

  for (const key of [...declared.keys()].sort()) {
    const spelling = declared.get(key) as string;
    const name = titleCaseRole(spelling);
    /* A model that writes `role:administrator` means the built-in one. Adding a
       second role of the same name would seed two rows and give the account
       whichever the lookup returned first. */
    if (taken.has(name.toLowerCase())) continue;
    taken.add(name.toLowerCase());
    roles.push({
      name,
      declaredAs: spelling,
      description: `Declared by %%rbac as ${spelling}`,
      isAdmin: false,
      userLevel: "U",
    });
  }

  const adminEmail = options.adminEmail?.trim() || "admin@admin.com";
  const domain = `${options.projectId || "app"}.example.com`;

  const users: DerivedUser[] = roles.map((role) =>
    role.isAdmin
      ? {
          email: adminEmail,
          name: options.adminName?.trim() || "Administrator",
          roleName: role.name,
          description: "Bypasses every restriction — the account to compare the others against",
          isAdmin: true,
        }
      : {
          email: `${localPart(role.declaredAs)}@${domain}`,
          name: role.name,
          roleName: role.name,
          description: `Holds ${role.name} and nothing else`,
          isAdmin: false,
        }
  );

  const entityVisibility: EntityVisibility = {};
  for (const rule of compiled.operations) {
    if (rule.operation !== "read") continue;
    const existing = entityVisibility[rule.entity] ?? [];
    entityVisibility[rule.entity] = [...new Set([...existing, ...rule.roles])].sort();
  }

  /* Counted over the model's entities rather than over the visibility map: an
     entity nobody restricted is readable by everyone and still belongs in the
     total, and leaving it out would make an unrestricted model report every
     role as seeing nothing. */
  const allEntities =
    options.entities && options.entities.length > 0
      ? options.entities
      : Object.keys(entityVisibility);
  const normalize = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
  const entityCounts: Record<string, number> = {};
  for (const role of roles) {
    entityCounts[role.name] = role.isAdmin
      ? allEntities.length
      : allEntities.filter((entity) => {
          const allowed = entityVisibility[entity];
          if (!allowed || allowed.length === 0) return true;
          return allowed.some((name) => normalize(name) === normalize(role.declaredAs));
        }).length;
  }

  return {
    roles,
    users,
    entityVisibility,
    entityCounts,
    scoped: Object.keys(entityVisibility).length > 0,
  };
}
