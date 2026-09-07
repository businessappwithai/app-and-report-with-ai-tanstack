/**
 * Deploy a generated application by building it into an image.
 *
 * "Deploy" used to print three encouraging lines and a URL that nothing was
 * listening on. What it does now is the thing that is actually reusable: take
 * the generated project on disk and hand it to `docker build`, producing an
 * image that carries the whole application — API, web front end, migrations and
 * seeds — and can be run anywhere with a database.
 *
 * The build runs against whatever daemon the socket points at. In the container
 * image that is the host's, mounted in; there is no daemon inside.
 *
 * Output is streamed as it arrives rather than collected: an image build is
 * minutes long and a progress bar that only moves at the end is not progress.
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { createFileRoute } from "@tanstack/react-router";
import { requireProjectAccess } from "@/lib/project-access";

/** Docker tags are lowercase, and separators are limited. */
function toImageTag(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "");
  return slug || "generated-app";
}

/** Whether a docker daemon is actually reachable, and why not when it is not. */
async function dockerAvailable(): Promise<{ ok: boolean; reason?: string }> {
  return new Promise((resolve) => {
    const probe = spawn("docker", ["version", "--format", "{{.Server.Version}}"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    probe.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    probe.on("error", () =>
      resolve({ ok: false, reason: "the docker command is not installed in this environment" })
    );
    probe.on("close", (code) => {
      if (code === 0) return resolve({ ok: true });
      resolve({
        ok: false,
        reason:
          stderr.includes("Cannot connect") || stderr.includes("docker.sock")
            ? "no docker daemon is reachable — mount /var/run/docker.sock into this container"
            : stderr.trim() || "docker is not usable here",
      });
    });
  });
}

export const Route = createFileRoute("/api/deploy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Read the body and settle access before a single byte of the stream
        // is written. A refusal has to be an HTTP status: an SSE frame saying
        // "denied" arrives inside a 200, and the caller has already been given
        // a build. Unguarded, this route ran `docker build` over somebody
        // else's generated application for anyone who could name a project id.
        const { projectId } = (await request.json().catch(() => ({}))) as { projectId?: string };
        if (!projectId) {
          return new Response(JSON.stringify({ error: "Missing required field: projectId" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const access = await requireProjectAccess(request, projectId, "read_write");
        if (access.response) return access.response;

        const encoder = new TextEncoder();

        const stream = new ReadableStream({
          async start(controller) {
            let closed = false;
            const send = (payload: Record<string, unknown>) => {
              if (closed) return;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
            };
            const log = (level: string, message: string) => send({ log: message, level });

            // A single image-build step can be silent for minutes — copying a
            // dependency tree, or a slow compile. Without something on the wire
            // the connection is closed as idle and the build dies with it, so a
            // comment goes out on a timer. SSE ignores comment frames.
            const heartbeat = setInterval(() => {
              if (closed) return;
              try {
                controller.enqueue(encoder.encode(": keep-alive\n\n"));
              } catch {
                // The client is gone; the close path below will tidy up.
              }
            }, 15_000);

            const finish = () => {
              if (closed) return;
              closed = true;
              clearInterval(heartbeat);
              controller.close();
            };
            const fail = (error: string) => {
              send({ error });
              finish();
            };

            try {
              const { projectDb } = await import("@appwithai/core/services");
              const project = await projectDb.findById(projectId);
              if (!project) return fail("Project not found");

              const projectPath = project.generatedPath;
              if (!projectPath) {
                return fail(
                  "This project has not been generated yet — run the generate step first"
                );
              }

              // The Dockerfile is what makes the project buildable. An older
              // project generated before it existed needs regenerating, and
              // saying so is more useful than docker's "no such file".
              const dockerfile = path.join(projectPath, "Dockerfile");
              try {
                await fs.access(dockerfile);
              } catch {
                return fail(
                  `No Dockerfile in ${projectPath}. Regenerate the application to produce one.`
                );
              }

              const docker = await dockerAvailable();
              if (!docker.ok) return fail(`Cannot build an image: ${docker.reason}`);

              const tag = `${toImageTag(project.name)}:${Date.now()}`;
              const latest = `${toImageTag(project.name)}:latest`;

              // Behind a TLS-intercepting proxy the build cannot install
              // dependencies unless it trusts the same CA this process does.
              // Copying it into the project's certificate directory means the
              // build works without anyone having to know that.
              const caSource = process.env.DEPLOY_EXTRA_CA_CERT;
              if (caSource) {
                try {
                  const certsDir = path.join(projectPath, "docker", "ca-certificates");
                  await fs.mkdir(certsDir, { recursive: true });
                  await fs.copyFile(caSource, path.join(certsDir, "deploy-ca.crt"));
                  log("info", "Added the configured CA certificate to the build context");
                } catch (error) {
                  log(
                    "warn",
                    `Could not stage ${caSource}: ${
                      error instanceof Error ? error.message : "unknown error"
                    }`
                  );
                }
              }

              log("info", `Building ${tag} from ${projectPath}`);
              log(
                "info",
                "This takes a few minutes the first time — layers are cached after that."
              );

              // Proxy settings are passed through rather than assumed absent:
              // the build runs on the host daemon, which does not inherit this
              // process's environment.
              const proxyArgs: string[] = [];
              for (const name of ["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY"]) {
                const value = process.env[name] ?? process.env[name.toLowerCase()];
                if (value) proxyArgs.push("--build-arg", `${name}=${value}`);
              }

              const build = spawn(
                "docker",
                [
                  "build",
                  ...(process.env.DEPLOY_BUILD_NETWORK
                    ? ["--network", process.env.DEPLOY_BUILD_NETWORK]
                    : []),
                  ...proxyArgs,
                  "-t",
                  tag,
                  "-t",
                  latest,
                  // No `--progress plain`: it is a buildx flag, and a daemon
                  // without the buildx plugin rejects it outright with exit 125.
                  // Output is plain anyway when nothing is attached to a TTY.
                  ".",
                ],
                { cwd: projectPath, stdio: ["ignore", "pipe", "pipe"] }
              );

              // Docker writes build progress to stderr, so both streams carry
              // output worth showing and neither is inherently an error.
              const relay = (chunk: unknown) => {
                for (const line of String(chunk).split("\n")) {
                  const text = line.trimEnd();
                  if (text) log("info", text);
                }
              };
              build.stdout.on("data", relay);
              build.stderr.on("data", relay);

              const code = await new Promise<number>((resolve) => {
                build.on("error", () => resolve(-1));
                build.on("close", (exitCode) => resolve(exitCode ?? -1));
              });

              if (code !== 0) {
                return fail(`docker build exited with code ${code}`);
              }

              log("success", `Built ${tag}`);
              log("info", `Also tagged ${latest}`);
              log(
                "info",
                `Run it with: docker run -p ${project.port}:${project.port} ` +
                  `-e DATABASE_URL=… ${latest}`
              );

              await projectDb
                .update(projectId, { deploymentStatus: "deployed", deployment_url: latest })
                .catch(() => {
                  // Recording the outcome is a convenience; the image exists
                  // either way and failing here would be misleading.
                });

              send({ complete: true, image: tag, url: `http://localhost:${project.port}` });
              finish();
            } catch (error) {
              console.error("[deploy] failed:", error);
              fail(error instanceof Error ? error.message : "Deployment failed");
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
