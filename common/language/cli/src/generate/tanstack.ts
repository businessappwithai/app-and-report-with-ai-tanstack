/**
 * TanStack Start + NestJS generation target.
 *
 * Drives the SHIPPED pipeline in `app-with-ai-tanstack` —
 * `packages/generator/src/pipeline/generate-application.ts`, which its own CLI
 * and its `/api/generate` route both go through — rather than assembling the
 * generator's inputs a second time here.
 *
 * That second assembly is what this file used to be, and it was a quiet
 * downgrade. It mapped `EmlModel` onto the core `Entity[]` / `Relationship[]`
 * shapes by hand and drove `GeneratorOrchestrator` with them, which meant every
 * part of a model that is *not* a column or a relationship line never reached
 * the generator at all:
 *
 * | Dropped | What the generated application lost |
 * |---|---|
 * | `enumRef` / enum values / reference ids | Every `%%enum` column a free-text box, and the seeder writing its own generic words ("Active", "Pending") into a column whose declared values are something else |
 * | `isForeignKey` | Every reference column a raw uuid instead of a lookup |
 * | `description` (`%%field … help:`) | No help under any control, and a manual with nothing to say |
 * | `semanticType` | `email` / `url` / `phone` / `password` / `color` all plain strings |
 * | `%%index`, `%%entity … parent:` | No composite indexes; every child entity a top-level window |
 * | the whole behaviour surface | `%%rule`, `%%hook`, `%%workflow`, `%%rbac` and `%%category` are compiled *beside* the entities and passed as separate generator options — none of which the orchestrator's constructor takes. The seeds came out empty: no state transitions, no authored rules, no roles, one "General" category |
 *
 * None of that fails. It generates, it builds, it runs — and it is a different
 * application from the one the model describes. The pipeline reads the model
 * source itself with the same parser and the same compilers, so there is one
 * reading of a model instead of two that can disagree.
 *
 * The cross-package module is loaded via a runtime dynamic import with a
 * non-literal specifier and local structural types, so this file stays
 * self-contained for the CLI's own type-check while still driving the real
 * pipeline at runtime (under Bun, with `@appwithai/core` built).
 */

import type { EmlModel } from "../model.ts";

// --- Local structural mirrors of the shipped pipeline's types --------------

/** The subset of `GenerateApplicationOptions` this target sets. */
interface GenerateApplicationOptionsLike {
  sources: string | string[];
  projectName: string;
  projectVersion: string;
  projectDescription: string;
  outputDir: string;
  stackOption: "tanstackjs-nestjs";
  databaseType: "postgresql" | "sqlite";
  port: number;
  frontendPort: number;
}

/** `generateApplication` resolves to the parsed model it generated from. */
interface ParsedModelLike {
  entities: unknown[];
  relationships: unknown[];
}

type GenerateApplication = (options: GenerateApplicationOptionsLike) => Promise<ParsedModelLike>;

export interface GenerationResultLike {
  generatedFiles: string[];
  entityCount: number;
  relationshipCount: number;
}

/**
 * Where a generated application listens.
 *
 * The pair the shipped CLI defaults to, and the pair `docker-compose.yml` sets
 * `PORT` to for the two services. Naming them here rather than taking the
 * pipeline's `port + 1` rule keeps the generated configuration and the compose
 * file saying the same thing.
 */
const DEFAULT_BACKEND_PORT = 4001;
const DEFAULT_FRONTEND_PORT = 4000;

export interface TanStackGenerateOptions {
  outDir: string;
  appName: string;
  /** Backend API port. The front end takes {@link DEFAULT_FRONTEND_PORT}. */
  port?: number;
  databaseType?: "postgresql" | "sqlite";
  /**
   * The model document — the generator's actual input, not decoration.
   *
   * The pipeline parses this text: the entities, the enums, the rules, the
   * hooks, the workflows, the access rules and the categories all come out of
   * it. It is also written to `model/model.eml.mmd` beside the app, which the
   * generated `backend/Dockerfile` copies (`COPY --from=builder /app/model
   * ./model`) — an output without it cannot be built at all — and which is the
   * only copy of the model that travels with the application, so a generated
   * directory is regenerable from itself.
   */
  modelSource: string;
}

/**
 * Generate a TanStack Start + NestJS app from the model source by driving the
 * shipped pipeline.
 *
 * `model` is used only for the project description; everything the generator
 * reads comes from `opts.modelSource`, parsed by the generator's own parser.
 */
export async function generateTanStack(
  model: EmlModel,
  opts: TanStackGenerateOptions
): Promise<GenerationResultLike> {
  const source = opts.modelSource?.trim();
  if (!source) {
    throw new Error(
      "tanstack-nestjs needs the model source: the shipped pipeline parses it to compile rules, hooks, workflows, access rules and enums."
    );
  }

  // Non-literal specifier keeps this out of the CLI's own type program while
  // resolving at runtime (relative to this module) under Bun.
  const pipelineModule = [
    "..",
    "..",
    "..",
    "..",
    "..",
    "app-with-ai-tanstack",
    "packages",
    "generator",
    "src",
    "pipeline",
    "generate-application.ts",
  ].join("/");
  const mod = (await import(pipelineModule)) as unknown as {
    generateApplication: GenerateApplication;
  };

  const parsed = await mod.generateApplication({
    sources: opts.modelSource,
    projectName: opts.appName,
    projectVersion: "1.0.0",
    projectDescription: `${model.meta.name ?? opts.appName} — generated from EML`,
    outputDir: opts.outDir,
    stackOption: "tanstackjs-nestjs",
    databaseType: opts.databaseType ?? "postgresql",
    port: opts.port ?? DEFAULT_BACKEND_PORT,
    frontendPort: DEFAULT_FRONTEND_PORT,
  });

  return {
    generatedFiles: await collectGeneratedFiles(opts.outDir),
    entityCount: parsed.entities.length,
    relationshipCount: parsed.relationships.length,
  };
}

/**
 * What the run put on disk.
 *
 * Walked afterwards rather than counted as they are written, for the same
 * reason the pipeline walks its own output: the generators write from well over
 * a hundred places and threading a count through them is a larger change than
 * the number is worth. `node_modules` is excluded — on a re-generate into a
 * populated directory it would be most of what a walk finds.
 */
async function collectGeneratedFiles(outDir: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const path = await import("node:path");

  const files: string[] = [];
  const walk = async (directory: string): Promise<void> => {
    let entries: Array<{ name: string; isDirectory(): boolean }>;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(full);
      else files.push(full);
    }
  };

  await walk(outDir);
  return files;
}
