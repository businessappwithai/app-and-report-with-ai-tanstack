/**
 * Sharing a project — the half of authorization that says yes.
 *
 * Until this file existed the suite only proved refusals: an owner reaches
 * their project, everybody else is turned away. That leaves the product's
 * actual collaboration story untested in both directions — a read-only share
 * that silently grants writes, and a share that grants nothing at all, both
 * pass a suite made only of 404s.
 *
 * So every case here is a pair. The member can do the thing their permission
 * allows, and cannot do the thing above it; and when the share is removed, they
 * can do neither.
 */

import { type APIRequestContext, expect, test } from "@playwright/test";

import {
  adminContext,
  BEHAVIOUR_EML,
  createProject,
  createUserSession,
  SAMPLE_EML,
  saveModel,
  type UserSession,
  unique,
} from "./helpers";

interface MemberRow {
  id: string;
  user_id: string;
  permission: string;
  email: string;
}

async function share(
  owner: APIRequestContext,
  projectId: string,
  email: string,
  permission: "read_only" | "read_write"
): Promise<MemberRow> {
  const response = await owner.post(`/api/projects/${projectId}/members`, {
    data: { email, permission },
    failOnStatusCode: false,
  });
  expect(response.status(), `sharing with ${email} answered ${response.status()}`).toBe(201);
  return ((await response.json()) as { member: MemberRow }).member;
}

async function members(owner: APIRequestContext, projectId: string): Promise<MemberRow[]> {
  const response = await owner.get(`/api/projects/${projectId}/members`, {
    failOnStatusCode: false,
  });
  expect(response.status(), "listing members failed").toBe(200);
  return ((await response.json()) as { members: MemberRow[] }).members;
}

/** Every write a member might attempt, with the status each answered. */
async function writeAttempts(
  request: APIRequestContext,
  projectId: string
): Promise<Array<{ what: string; status: number }>> {
  const attempts: Array<{ what: string; status: number }> = [];

  attempts.push({
    what: "save a model version",
    status: (
      await request.post(`/api/projects/${projectId}/erd-versions`, {
        data: { mermaidCode: SAMPLE_EML, description: unique("member-edit") },
        failOnStatusCode: false,
      })
    ).status(),
  });

  attempts.push({
    what: "merge rules into the model",
    status: (
      await request.put(`/api/projects/${projectId}/eml`, {
        data: { rules: [] },
        failOnStatusCode: false,
      })
    ).status(),
  });

  attempts.push({
    what: "create an automation",
    status: (
      await request.post(`/api/projects/${projectId}/automations`, {
        data: {
          name: unique("member-automation"),
          entity: "Order",
          mermaid: "flowchart TD\n  a[Start] --> b[Step]",
        },
        failOnStatusCode: false,
      })
    ).status(),
  });

  attempts.push({
    what: "record a deployment",
    status: (
      await request.post(`/api/projects/${projectId}/deployment`, {
        data: { status: "running", port: 4000 },
        failOnStatusCode: false,
      })
    ).status(),
  });

  return attempts;
}

test.describe("sharing a project", () => {
  let admin: APIRequestContext;
  let owner: UserSession;
  let member: UserSession;
  let outsider: UserSession;

  test.beforeAll(async ({ playwright }) => {
    admin = await adminContext(playwright);
    owner = await createUserSession(playwright, admin, "e2e-share-owner");
    member = await createUserSession(playwright, admin, "e2e-share-member");
    outsider = await createUserSession(playwright, admin, "e2e-share-outsider");
  });

  test.afterAll(async () => {
    await owner.request.dispose();
    await member.request.dispose();
    await outsider.request.dispose();
    await admin.dispose();
  });

  test("a read-only share is visible to the member and refuses their writes", async () => {
    const projectId = await createProject(owner.request, unique("e2e-read-only"));
    await saveModel(owner.request, projectId, BEHAVIOUR_EML);

    await share(owner.request, projectId, member.email, "read_only");

    // Visible: the project, its model, its history.
    const project = await member.request.get(`/api/projects/${projectId}`, {
      failOnStatusCode: false,
    });
    expect(project.status()).toBe(200);

    const eml = await member.request.get(`/api/projects/${projectId}/eml`, {
      failOnStatusCode: false,
    });
    expect(eml.status()).toBe(200);
    expect(((await eml.json()) as { eml: string }).eml).toBe(BEHAVIOUR_EML);

    // And in their own list, which is how they would find it at all.
    const listing = await member.request.get("/api/projects");
    const ids = ((await listing.json()) as { projects: Array<{ id: string }> }).projects.map(
      (row) => row.id
    );
    expect(ids).toContain(projectId);

    // Refused: everything that changes it.
    const attempts = await writeAttempts(member.request, projectId);
    expect(
      attempts.filter((attempt) => attempt.status < 400),
      "a read-only member was allowed to write"
    ).toEqual([]);

    // The model is exactly as the owner left it.
    const after = await owner.request.get(`/api/projects/${projectId}/eml`);
    expect(((await after.json()) as { eml: string }).eml).toBe(BEHAVIOUR_EML);
  });

  test("a read-write share accepts the writes a read-only one refused", async () => {
    const projectId = await createProject(owner.request, unique("e2e-read-write"));
    await saveModel(owner.request, projectId, BEHAVIOUR_EML);

    await share(owner.request, projectId, member.email, "read_write");

    const attempts = await writeAttempts(member.request, projectId);
    expect(
      attempts.filter((attempt) => attempt.status >= 400),
      "a read-write member was refused a write they are entitled to"
    ).toEqual([]);

    // And the edit is really there, under the owner's eyes.
    const versions = await owner.request.get(`/api/projects/${projectId}/erd-versions`);
    const rows = ((await versions.json()) as { versions: Array<{ description?: string | null }> })
      .versions;
    expect(rows.some((row) => (row.description ?? "").includes("member-edit"))).toBe(true);
  });

  test("upgrading a share turns a refusal into an acceptance", async () => {
    const projectId = await createProject(owner.request, unique("e2e-upgrade"));
    await saveModel(owner.request, projectId, BEHAVIOUR_EML);
    await share(owner.request, projectId, member.email, "read_only");

    const before = await member.request.post(`/api/projects/${projectId}/erd-versions`, {
      data: { mermaidCode: SAMPLE_EML, description: "before the upgrade" },
      failOnStatusCode: false,
    });
    expect(before.status()).toBe(403);

    const upgrade = await owner.request.patch(`/api/projects/${projectId}/members/${member.id}`, {
      data: { permission: "read_write" },
      failOnStatusCode: false,
    });
    expect(upgrade.status()).toBe(200);

    const after = await member.request.post(`/api/projects/${projectId}/erd-versions`, {
      data: { mermaidCode: SAMPLE_EML, description: "after the upgrade" },
      failOnStatusCode: false,
    });
    expect(after.status()).toBe(201);
  });

  test("removing a share revokes the access it granted", async () => {
    const projectId = await createProject(owner.request, unique("e2e-revoke"));
    await saveModel(owner.request, projectId, BEHAVIOUR_EML);
    await share(owner.request, projectId, member.email, "read_write");

    expect((await member.request.get(`/api/projects/${projectId}`)).status()).toBe(200);

    const removal = await owner.request.delete(`/api/projects/${projectId}/members/${member.id}`, {
      failOnStatusCode: false,
    });
    expect(removal.status()).toBe(200);

    // Gone, and gone the same way a stranger's request is refused — not with a
    // different status that would confirm they used to have access.
    const project = await member.request.get(`/api/projects/${projectId}`, {
      failOnStatusCode: false,
    });
    expect(project.status()).toBe(403);

    const eml = await member.request.get(`/api/projects/${projectId}/eml`, {
      failOnStatusCode: false,
    });
    expect(eml.status()).toBe(404);

    const listing = await member.request.get("/api/projects");
    const ids = ((await listing.json()) as { projects: Array<{ id: string }> }).projects.map(
      (row) => row.id
    );
    expect(ids).not.toContain(projectId);
  });

  test("only the owner manages the member list", async () => {
    const projectId = await createProject(owner.request, unique("e2e-member-admin"));
    await share(owner.request, projectId, member.email, "read_write");

    // A read-write member may edit the project. Deciding who else can is a
    // different power, and one a share does not hand over.
    const listAttempt = await member.request.get(`/api/projects/${projectId}/members`, {
      failOnStatusCode: false,
    });
    expect(listAttempt.status()).toBe(403);

    const addAttempt = await member.request.post(`/api/projects/${projectId}/members`, {
      data: { email: outsider.email, permission: "read_write" },
      failOnStatusCode: false,
    });
    expect(addAttempt.status()).toBe(403);

    const removeAttempt = await member.request.delete(
      `/api/projects/${projectId}/members/${member.id}`,
      { failOnStatusCode: false }
    );
    expect(removeAttempt.status()).toBe(403);

    // Nobody was added, nobody was removed.
    const rows = await members(owner.request, projectId);
    expect(rows.map((row) => row.email)).toEqual([member.email]);
  });

  test("reports the members it has, with their permissions", async () => {
    const projectId = await createProject(owner.request, unique("e2e-member-list"));
    await share(owner.request, projectId, member.email, "read_only");
    await share(owner.request, projectId, outsider.email, "read_write");

    const rows = await members(owner.request, projectId);
    expect(rows).toHaveLength(2);
    expect(Object.fromEntries(rows.map((row) => [row.email, row.permission]))).toEqual({
      [member.email]: "read_only",
      [outsider.email]: "read_write",
    });
  });

  test("refuses a share that cannot mean anything", async () => {
    const projectId = await createProject(owner.request, unique("e2e-bad-shares"));

    const unknown = await owner.request.post(`/api/projects/${projectId}/members`, {
      data: { email: `${unique("nobody")}@example.com`, permission: "read_only" },
      failOnStatusCode: false,
    });
    expect(unknown.status()).toBe(404);

    const self = await owner.request.post(`/api/projects/${projectId}/members`, {
      data: { email: owner.email, permission: "read_write" },
      failOnStatusCode: false,
    });
    expect(self.status()).toBe(400);

    const noEmail = await owner.request.post(`/api/projects/${projectId}/members`, {
      data: { permission: "read_only" },
      failOnStatusCode: false,
    });
    expect(noEmail.status()).toBe(400);

    await share(owner.request, projectId, member.email, "read_only");
    const twice = await owner.request.post(`/api/projects/${projectId}/members`, {
      data: { email: member.email, permission: "read_write" },
      failOnStatusCode: false,
    });
    // A second share is a permission change, and saying so is better than
    // quietly inserting a second row and leaving which one wins to the query
    // planner.
    expect(twice.status()).toBe(409);
  });

  test("a share of one project is not a share of another", async () => {
    const shared = await createProject(owner.request, unique("e2e-shared-one"));
    const private_ = await createProject(owner.request, unique("e2e-private-one"));
    await share(owner.request, shared, member.email, "read_write");

    expect((await member.request.get(`/api/projects/${shared}`)).status()).toBe(200);

    const other = await member.request.get(`/api/projects/${private_}`, {
      failOnStatusCode: false,
    });
    expect(other.status()).toBeGreaterThanOrEqual(400);
  });
});
