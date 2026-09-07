/**
 * The NestJS + TanStack Start stack, assembled in a browser tab.
 *
 * This is the other half of what `appwithai-wasm generate` does — the half that
 * needed a disk. `run-in-browser.html` compiles a model into the self-contained
 * runtime, which needs no install and no build; this compiles the same model
 * into the *real* application, four hundred files of NestJS and React, for
 * something that can install and build it. In a tab, that something is a
 * WebContainer.
 *
 * Nothing here is a browser edition of the generator. `generateApplication` and
 * `applyWasmOverlay` are the same functions the CLI calls, running unmodified;
 * what changes is the filesystem underneath them, which the bundler binds to
 * `memory-fs.ts`. That is the whole trick, and it is why an application
 * assembled here is the application the command would have written rather than
 * something that resembles it.
 *
 * The templates are fetched rather than inlined. There are 1.7MB of them across
 * three hundred files, and a page that only sometimes boots a WebContainer
 * should not carry that in its JavaScript — `scripts/build-stack-templates.ts`
 * writes them beside the page as one JSON file, the way `vendor:pglite` puts
 * PostgreSQL there.
 */

import { setLanguageDefinition as setCheckerDefinition } from "../../../../language";
import languageDefinition from "../../../../language/appwithai-language.json";
import { DEFAULT_BACKEND_PORT, DEFAULT_FRONTEND_PORT } from "../generators/ports";
import { applyWasmOverlay } from "../generators/wasm/overlay";
import { setLanguageDefinition } from "../parsers/language-maps";
import { generateApplication } from "../pipeline/generate-application";
import { parseModel } from "../pipeline/parse-model";
import { type ModelReview, reviewModel } from "../pipeline/review-model";
import * as memfs from "./memory-fs";

setLanguageDefinition(languageDefinition);
setCheckerDefinition(languageDefinition as unknown as Parameters<typeof setCheckerDefinition>[0]);

export { ModelCheckError } from "./model-check-error";
export type { ModelReview };

/** Where the templates are seeded and the application is written, in the map. */
const TEMPLATE_ROOT = "/templates";
const OUTPUT_ROOT = "/app";

export interface FullStackOptions {
  /** The EML document. */
  source: string;
  /** Every template, keyed by its path under `packages/generator/templates/`. */
  templates: Record<string, string>;
  name?: string;
  version?: string;
  description?: string;
  adminEmail?: string;
  adminPassword?: string;
  /** Called as each phase begins, for a page that wants to show progress. */
  onProgress?: (phase: string, detail?: string) => void;
  /**
   * Apply the WASM overlay: `pg` swapped for WebAssembly Postgres, `bun` for
   * `node`, and the database pointed at a directory instead of a server.
   *
   * Defaults to `true`, because a WebContainer is what this module was written
   * for and it has neither a database server nor bun. Pass `false` to get what
   * `appwithai generate` writes — the real `pg` driver against a real
   * PostgreSQL, and bun as the runtime. That is what a reader who unzips the
   * application and runs `docker compose up --build` needs: compose starts a
   * PostgreSQL for them, and an overlaid backend would quietly ignore it and
   * open a PGlite directory instead.
   */
  overlay?: boolean;
}

export interface FullStackResult {
  /** Every file of the application, path -> contents. */
  files: Record<string, string>;
  /** What the checker made of the model, after the fixer had its turn. */
  review: ModelReview;
  /**
   * What the overlay added and rewrote — the proof it stayed small. All three
   * lists are empty when `overlay: false` was asked for, since nothing ran.
   */
  overlay: { added: string[]; rewritten: string[]; debunned: string[] };
  summary: {
    project: string;
    entities: string[];
    rules: string[];
    workflows: string[];
    fileCount: number;
    bytes: number;
  };
}

/**
 * Compile a model into the real stack, with the WASM overlay applied unless
 * `overlay: false` says otherwise.
 *
 * Async because the pipeline is: it writes four hundred files, and in a tab that
 * is four hundred Map insertions rather than four hundred syscalls, so it
 * returns in well under a second.
 */
export async function generateFullStack(options: FullStackOptions): Promise<FullStackResult> {
  const report = options.onProgress ?? (() => {});
  const withOverlay = options.overlay !== false;

  // Two applications generated in one tab must not see each other's files, and
  // the second would otherwise inherit every file the first wrote.
  memfs.reset();
  memfs.seed(options.templates, TEMPLATE_ROOT);
  report("check", "Checking the model");

  const review = reviewModel(options.source);
  if (!review.ok) {
    const { ModelCheckError } = await import("./model-check-error");
    throw new ModelCheckError(review);
  }

  report("parse", "Reading the model");
  const parsed = parseModel(review.source);
  if (!parsed.entities.length) {
    throw new Error(
      "This model declares no entities. An EML document needs an `erDiagram` section."
    );
  }

  const name = options.name?.trim() || "Generated App";

  report("generate", `Writing the NestJS backend and TanStack Start front end`);
  await generateApplication({
    sources: [review.source],
    model: parsed,
    projectName: name,
    projectVersion: options.version ?? "1.0.0",
    projectDescription: options.description ?? "Generated application",
    outputDir: OUTPUT_ROOT,
    stackOption: "tanstackjs-nestjs",
    databaseType: "postgresql",
    port: DEFAULT_BACKEND_PORT,
    frontendPort: DEFAULT_FRONTEND_PORT,
    // Installing and migrating is the CLI's step, not the pipeline's — which is
    // exactly right here, since the WebContainer does both afterwards.
    //
    // The manifest records which package manager the application expects. The
    // overlay's build installs with npm; without it the Dockerfile and every
    // script use bun, which is what `appwithai generate` records too.
    manifest: {
      input: ["model.eml.mmd"],
      packageManager: withOverlay ? "npm" : "bun",
    },
  });

  let overlay = { added: [] as string[], rewritten: [] as string[], debunned: [] as string[] };
  if (withOverlay) {
    report("overlay", "Replacing the database driver and the runtime");
    overlay = await applyWasmOverlay({
      outputDir: OUTPUT_ROOT,
      dataDir: "./pgdata",
      log: (message) => report("overlay", message),
    });
  }

  const files = memfs.snapshot(OUTPUT_ROOT);
  report("done", `${Object.keys(files).length} files`);

  return {
    files,
    review,
    overlay,
    summary: {
      project: name,
      entities: parsed.entities.map((entity) => entity.name),
      rules: parsed.rules.map((rule) => rule.name),
      workflows: [
        ...parsed.workflows.map((workflow) => workflow.name),
        ...parsed.sagas.map((saga) => saga.name),
      ],
      fileCount: Object.keys(files).length,
      bytes: Object.values(files).reduce((total, content) => total + content.length, 0),
    },
  };
}

/**
 * Fetch the templates this needs, from beside the page.
 *
 * Written by `bun run build:stack-templates`. A page that cannot find them says
 * so rather than failing three hundred files into a generation.
 */
export async function loadTemplates(
  url = "assets/stack-templates.json"
): Promise<Record<string, string>> {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(
      `The stack templates are not beside this page (${response.status} for ${url}). ` +
        "Run `bun run build:stack-templates` to put them there."
    );
  }
  return (await response.json()) as Record<string, string>;
}
