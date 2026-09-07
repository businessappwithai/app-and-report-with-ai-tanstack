/**
 * Generation, driven the way the wizard drives it.
 *
 * The CLI path is covered by CI's own generate-and-build jobs. This is the
 * other caller: the design step posts a project id and reads a stream of log
 * frames until one says the application is written. Everything between — the
 * project lookup, the model resolution, the `.mmd` written beside the output,
 * the CLI invocation, the row updated afterwards — only ever runs here.
 *
 * It asserts on what landed on disk rather than on what the stream said about
 * it. A run that reports success and writes nothing is the failure worth
 * catching, and the log frames are the least reliable witness to it.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { type APIRequestContext, expect, test } from "@playwright/test";

import {
  adminContext,
  BEHAVIOUR_EML,
  createProject,
  createUserSession,
  saveModel,
  type UserSession,
  unique,
} from "./helpers";

/**
 * Where the generated application landed, taken from the run that produced it.
 *
 * Not computed here from `process.cwd()`: the server's working directory is
 * `packages/web` (that is where Vite runs), so the same expression means two
 * different directories in the test process and in the handler. Reading the
 * path off the completion frame asserts the relationship that matters — the
 * project row agrees with the run, and the files are where both of them say.
 */
function outputDirOf(frames: StreamFrame[], projectId: string): string {
  const completion = frames.find((frame) => frame.complete);
  expect(completion, "the stream never reported completion").toBeTruthy();

  const path = String(completion?.path ?? "");
  expect(path).toContain(join("generated-projects", projectId));
  return path;
}

interface StreamFrame {
  log?: string;
  level?: string;
  error?: string;
  complete?: boolean;
  path?: string;
  model?: string;
}

/** Read a whole server-sent-event response into its frames. */
function framesOf(body: string): StreamFrame[] {
  return body
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => {
      try {
        return JSON.parse(line.slice("data: ".length)) as StreamFrame;
      } catch {
        return {} as StreamFrame;
      }
    });
}

async function generate(
  request: APIRequestContext,
  projectId: string
): Promise<{ status: number; frames: StreamFrame[] }> {
  const response = await request.post("/api/generate", {
    data: { projectId },
    failOnStatusCode: false,
    // Generation spawns the CLI; a cold first run also builds nothing but is
    // still slower than the default 30s action timeout allows for.
    timeout: 300_000,
  });

  return { status: response.status(), frames: framesOf(await response.text()) };
}

test.describe("generating an application", () => {
  let admin: APIRequestContext;
  let owner: UserSession;

  test.beforeAll(async ({ playwright }) => {
    admin = await adminContext(playwright);
    owner = await createUserSession(playwright, admin, "e2e-generator");
  });

  test.afterAll(async () => {
    await owner.request.dispose();
    await admin.dispose();
  });

  test("writes a complete application from the project's model", async () => {
    test.setTimeout(300_000);

    const projectId = await createProject(owner.request, unique("e2e-generate"));
    await saveModel(owner.request, projectId, BEHAVIOUR_EML);

    const { status, frames } = await generate(owner.request, projectId);
    expect(status).toBe(200);

    const failures = frames.filter((frame) => frame.error);
    expect(failures.map((frame) => frame.error)).toEqual([]);

    const outputDir = outputDirOf(frames, projectId);
    const completion = frames.find((frame) => frame.complete);

    // The three halves of a generated project: the API, the app, and the suite
    // that drives them. A generator that quietly stopped emitting one of them
    // would still finish, and the stream would still say so.
    for (const relative of [
      "package.json",
      "backend/package.json",
      "backend/src",
      "frontend/package.json",
      "tests/run.ts",
      "tests/harness/model.ts",
      "frontend/public/manual.html",
    ]) {
      expect(existsSync(join(outputDir, relative)), `${relative} was not generated`).toBe(true);
    }

    // The model that produced it sits beside it, so the application and its
    // source are never separated.
    expect(completion?.model).toBeTruthy();
    expect(existsSync(String(completion?.model))).toBe(true);
    expect(readFileSync(String(completion?.model), "utf8")).toBe(BEHAVIOUR_EML);
  });

  test("carries the model's own entities into the generated suite", async () => {
    test.setTimeout(300_000);

    const projectId = await createProject(owner.request, unique("e2e-generate-entities"));
    await saveModel(owner.request, projectId, BEHAVIOUR_EML);

    const { frames } = await generate(owner.request, projectId);
    const outputDir = outputDirOf(frames, projectId);

    // A per-entity CRUD file for each entity the model declares. This is the
    // link between the two halves of the deliverable: the model names Customer
    // and Order, so the generated application has a suite that drives both.
    for (const entity of ["customer", "order"]) {
      expect(
        existsSync(join(outputDir, "tests", "suites", `03-crud.${entity}.test.ts`)),
        `no CRUD suite for ${entity}`
      ).toBe(true);
    }

    // And the harness carries the model's own vocabulary rather than reading it
    // back out of the application the same generator wrote.
    const model = readFileSync(join(outputDir, "tests", "harness", "model.ts"), "utf8");
    expect(model).toContain("OrderStatus");
    for (const value of ["draft", "submitted", "shipped"]) {
      expect(model).toContain(`"${value}"`);
    }
  });

  test("records the result on the project", async () => {
    test.setTimeout(300_000);

    const projectId = await createProject(owner.request, unique("e2e-generate-record"));
    await saveModel(owner.request, projectId, BEHAVIOUR_EML);

    const before = await owner.request.get(`/api/projects/${projectId}`);
    expect(
      ((await before.json()) as { project: { generatedPath?: string } }).project.generatedPath
    ).toBeFalsy();

    const { frames } = await generate(owner.request, projectId);
    const outputDir = outputDirOf(frames, projectId);

    // The wizard reads these two to decide whether a project has been
    // generated. When the update silently failed, the page offered the stack
    // picker again over a finished application.
    const after = await owner.request.get(`/api/projects/${projectId}`);
    const project = (
      (await after.json()) as {
        project: { generatedPath?: string; deploymentStatus?: string };
      }
    ).project;

    expect(project.generatedPath).toBe(outputDir);
    expect(project.deploymentStatus).toBe("completed");
  });

  test("refuses a project that has no model yet", async () => {
    const projectId = await createProject(owner.request, unique("e2e-generate-empty"));

    const { frames } = await generate(owner.request, projectId);

    const error = frames.find((frame) => frame.error);
    expect(error?.error).toContain("ERD");

    // No completion frame, and nothing to report a path for — a run that
    // refused has written nothing to point at.
    expect(frames.find((frame) => frame.complete)).toBeFalsy();
    expect(frames.some((frame) => frame.path)).toBe(false);
  });

  test("refuses a request with no project id at all", async () => {
    const response = await owner.request.post("/api/generate", {
      data: {},
      failOnStatusCode: false,
    });

    // A status, not a stream: nothing has been started, so there is nothing to
    // report progress about.
    expect(response.status()).toBe(400);
  });

  test("refuses a project id that does not exist", async () => {
    const response = await owner.request.post("/api/generate", {
      data: { projectId: "proj_does_not_exist" },
      failOnStatusCode: false,
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.headers()["content-type"] ?? "").not.toContain("text/event-stream");
  });
});
