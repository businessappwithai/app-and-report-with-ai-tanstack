/**
 * The project itself — created, listed, read, edited, removed.
 *
 * A project is the container everything else in this tool hangs off: the model,
 * its versions, its automations, its rules, its generated output. So the
 * assertions here are about the container's contract rather than its contents:
 * who sees a project in their list, which fields a client may change, and which
 * ones it may not.
 *
 * Everything runs as an ordinary approved account, not as the administrator.
 * That is not a stylistic choice — the project routes refuse a caller whose
 * role is `admin` ("Admins cannot modify projects"), so a suite that drove them
 * as the bootstrap account would be asserting against 403s of its own making
 * and would never reach the behaviour underneath.
 */

import { type APIRequestContext, expect, test } from "@playwright/test";

import {
  ADMIN,
  adminContext,
  createProject,
  createUserSession,
  SAMPLE_EML,
  type UserSession,
  unique,
} from "./helpers";

interface ProjectRow {
  id: string;
  name: string;
  description?: string | null;
  status?: string;
  ownerId?: string;
  isDeleted?: boolean;
  erdCode?: string;
}

async function listProjects(request: APIRequestContext): Promise<ProjectRow[]> {
  const response = await request.get("/api/projects", { failOnStatusCode: false });
  expect(response.status(), "listing projects failed").toBe(200);
  const { projects } = (await response.json()) as { projects: ProjectRow[] };
  return projects;
}

async function readProject(
  request: APIRequestContext,
  id: string
): Promise<{ status: number; project: ProjectRow | null }> {
  const response = await request.get(`/api/projects/${id}`, { failOnStatusCode: false });
  if (!response.ok()) return { status: response.status(), project: null };
  const body = (await response.json()) as { project: ProjectRow };
  return { status: response.status(), project: body.project };
}

test.describe("projects", () => {
  let admin: APIRequestContext;
  let owner: UserSession;
  let stranger: UserSession;

  test.beforeAll(async ({ playwright }) => {
    admin = await adminContext(playwright);
    owner = await createUserSession(playwright, admin, "e2e-owner");
    stranger = await createUserSession(playwright, admin, "e2e-outsider");
  });

  test.afterAll(async () => {
    await owner.request.dispose();
    await stranger.request.dispose();
    await admin.dispose();
  });

  test("creating one puts it in the owner's list and nobody else's", async () => {
    const name = unique("e2e-visible");
    const id = await createProject(owner.request, name);

    const mine = await listProjects(owner.request);
    expect(mine.map((project) => project.id)).toContain(id);
    expect(mine.find((project) => project.id === id)?.name).toBe(name);

    // The listing is the tool's front door. A project appearing in a stranger's
    // is a disclosure that no per-route check downstream can undo.
    const theirs = await listProjects(stranger.request);
    expect(theirs.map((project) => project.id)).not.toContain(id);
  });

  test("reports the fields the client's Project type declares", async () => {
    const id = await createProject(owner.request);
    const { status, project } = await readProject(owner.request, id);

    expect(status).toBe(200);
    // Not an exhaustive shape check — the point is the fields the wizard reads
    // to decide which step a project is on. `deploymentStatus` in particular:
    // when the mapper dropped it, a generated project showed the stack picker
    // again as though nothing had been generated.
    expect(project).toMatchObject({ id, ownerId: owner.id, status: "draft" });
    expect(project).toHaveProperty("deploymentStatus");
    expect(project).toHaveProperty("erdCode");
  });

  test("refuses a project with no name", async () => {
    const response = await owner.request.post("/api/projects", {
      data: { description: "nameless" },
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(400);
  });

  test("refuses to create one for an unauthenticated caller", async ({ playwright }) => {
    const anonymous = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    });
    const response = await anonymous.post("/api/projects", {
      data: { name: unique("e2e-should-not-exist") },
      failOnStatusCode: false,
    });
    await anonymous.dispose();

    expect(response.status()).toBe(401);
  });

  test("keeps a model supplied at creation", async () => {
    const response = await owner.request.post("/api/projects", {
      data: { name: unique("e2e-with-model"), erdCode: SAMPLE_EML },
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(201);

    const { project } = (await response.json()) as { project: ProjectRow };
    expect(project.id).toBeTruthy();

    // The model is stored as version 1 rather than on the project row, and it
    // used to be accepted and dropped — a project imported with a complete
    // document opened the design step with an empty canvas.
    const reread = await readProject(owner.request, project.id);
    expect(reread.project?.erdCode).toContain("erDiagram");

    const versions = await owner.request.get(`/api/projects/${project.id}/erd-versions`);
    expect(versions.status()).toBe(200);
    const { versions: rows } = (await versions.json()) as { versions: Array<{ id: string }> };
    expect(rows.length).toBe(1);
  });

  test("renames a project", async () => {
    const id = await createProject(owner.request);
    const renamed = unique("e2e-renamed");

    const response = await owner.request.patch(`/api/projects/${id}`, {
      data: { name: renamed, description: "edited by the suite" },
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(200);

    const { project } = await readProject(owner.request, id);
    expect(project?.name).toBe(renamed);
    expect(project?.description).toBe("edited by the suite");
  });

  test("ignores fields that are not the client's to set", async () => {
    const id = await createProject(owner.request);

    // Ownership and the delete flag are the two that matter: an unfiltered
    // spread over the request body would let an editor hand the project to
    // somebody else, or make it vanish, through the ordinary rename form.
    const response = await owner.request.patch(`/api/projects/${id}`, {
      data: { ownerId: stranger.id, isDeleted: true, id: "proj_hijacked" },
      failOnStatusCode: false,
    });

    // Nothing in that body is editable, so there is nothing to do with it.
    expect(response.status()).toBe(400);

    const { project } = await readProject(owner.request, id);
    expect(project?.id).toBe(id);
    expect(project?.ownerId).toBe(owner.id);

    // And it is still the owner's, in their list, undeleted.
    expect((await listProjects(owner.request)).map((row) => row.id)).toContain(id);
    expect((await listProjects(stranger.request)).map((row) => row.id)).not.toContain(id);
  });

  test("refuses an edit from a signed-in stranger", async () => {
    const id = await createProject(owner.request);

    const response = await stranger.request.patch(`/api/projects/${id}`, {
      data: { name: unique("e2e-hijack") },
      failOnStatusCode: false,
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);

    const { project } = await readProject(owner.request, id);
    expect(project?.name).not.toContain("e2e-hijack");
  });

  test("refuses an edit from the administrator", async () => {
    const id = await createProject(owner.request);

    // Deliberate: in this tool the administrator approves accounts, and is not
    // a super-editor of everybody's work. Asserted rather than assumed, because
    // it is the reason every other test in this file runs as an ordinary user.
    const response = await admin.patch(`/api/projects/${id}`, {
      data: { name: unique("e2e-admin-edit") },
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(403);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("Admins") });
  });

  test("deleting one takes it out of the listing", async () => {
    const id = await createProject(owner.request);
    expect((await listProjects(owner.request)).map((row) => row.id)).toContain(id);

    const response = await owner.request.delete(`/api/projects/${id}`, { failOnStatusCode: false });
    expect(response.status()).toBe(200);

    expect((await listProjects(owner.request)).map((row) => row.id)).not.toContain(id);
  });

  test("refuses a delete from a signed-in stranger", async () => {
    const id = await createProject(owner.request);

    const response = await stranger.request.delete(`/api/projects/${id}`, {
      failOnStatusCode: false,
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);

    // Still there for the owner — the refusal has to be a refusal, not a
    // 403 returned after the row was already gone.
    expect((await listProjects(owner.request)).map((row) => row.id)).toContain(id);
  });

  test("searches by name without reaching another owner's projects", async () => {
    const marker = unique("e2e-needle");
    const id = await createProject(owner.request, marker);

    const found = await owner.request.get(`/api/projects?search=${encodeURIComponent(marker)}`);
    expect(found.status()).toBe(200);
    const mine = ((await found.json()) as { projects: ProjectRow[] }).projects;
    expect(mine.map((row) => row.id)).toContain(id);

    // The same search, run by somebody else, must find nothing. A search that
    // is applied after the ownership filter is fine; one applied instead of it
    // is a directory of every project name in the system.
    const theirs = await stranger.request.get(`/api/projects?search=${encodeURIComponent(marker)}`);
    expect(theirs.status()).toBe(200);
    expect(((await theirs.json()) as { projects: ProjectRow[] }).projects).toEqual([]);
  });

  test("the administrator's own account still works after all of that", async () => {
    // A canary: several tests above assert 403s against the admin context, and
    // a fixture that had quietly lost its session would produce exactly the
    // same 403s while proving nothing.
    const response = await admin.get("/api/auth/me", { failOnStatusCode: false });
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ user: { email: ADMIN.email } });
  });
});
