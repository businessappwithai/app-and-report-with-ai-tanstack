/**
 * The generation pipeline.
 *
 * Every entry point — the `appwithai` CLI and the web app's `/api/generate`
 * route — goes through here, so a model generates the same application however
 * it was submitted. They used to assemble the generator's options separately,
 * and the copies drifted: the web path never parsed `%%category` directives, so
 * an app generated through the UI lost every category the model declared and
 * fell back to a single "General" group.
 *
 * Adding a generator input means adding it here once. A caller that needs
 * something different passes it as a setting; it does not rebuild the options.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  FullStackGenerator,
  type FullStackGeneratorOptions,
} from "../generators/full-stack.generator";
import { renderManual } from "../manual";
import { NO_LOG, type PipelineLogger } from "./logger-port";
import {
  GENERATION_DEFAULTS,
  type GenerationSettings,
  normalizeDatabaseType,
  type ParsedModel,
  parseModel,
} from "./parse-model";

/**
 * Re-exported so every existing importer keeps working: these moved to
 * parse-model.ts only so the browser stack could reach them without `node:fs`.
 */
export {
  GENERATION_DEFAULTS,
  type GenerationSettings,
  NO_LOG,
  normalizeDatabaseType,
  type ParsedModel,
  type PipelineLogger,
  parseModel,
};

/** Read model sources from disk, skipping any that are absent. */
export async function readModelSources(filePaths: Array<string | undefined>): Promise<string[]> {
  const sources: string[] = [];
  for (const filePath of filePaths) {
    if (!filePath) continue;
    try {
      sources.push(await fs.readFile(path.resolve(filePath), "utf-8"));
    } catch {
      // A missing optional input is not an error here — callers validate the
      // files they require before getting this far.
    }
  }
  return sources;
}

/**
 * Assemble the generator's options from a parsed model plus settings.
 *
 * This is the function that has to stay single: every field below was once
 * spelled out at each call site, and the one that forgot `categories` shipped
 * applications missing a feature the model had asked for.
 */
export function buildGeneratorOptions(
  model: ParsedModel,
  settings: GenerationSettings
): FullStackGeneratorOptions {
  const stackOption = settings.stackOption ?? GENERATION_DEFAULTS.stackOption;
  const port = settings.port ?? GENERATION_DEFAULTS.port;
  const frontendPort = settings.frontendPort ?? port + 1;
  const databaseType = normalizeDatabaseType(settings.databaseType);

  return {
    stackOption,
    projectName: settings.projectName,
    projectVersion: settings.projectVersion ?? GENERATION_DEFAULTS.projectVersion,
    projectDescription: settings.projectDescription ?? GENERATION_DEFAULTS.projectDescription,
    outputDir: settings.outputDir,
    port,
    frontendPort,
    tanstackStartNestjs: {
      backend: {
        databaseType,
        port,
        enableSwagger: settings.enableSwagger ?? GENERATION_DEFAULTS.enableSwagger,
        enableCors: settings.enableCors ?? GENERATION_DEFAULTS.enableCors,
      },
      frontend: {
        apiBaseUrl: settings.apiBaseUrl ?? `http://localhost:${port}`,
        enableDarkMode: settings.enableDarkMode ?? GENERATION_DEFAULTS.enableDarkMode,
      },
    },
    skipFrontend: !!settings.skipFrontend,
    skipBackend: !!settings.skipBackend,
    skipTests: !!settings.skipTests,
    skipCliScaffold: settings.skipCliScaffold ?? GENERATION_DEFAULTS.skipCliScaffold,
    recordsPerEntity: settings.recordsPerEntity ?? GENERATION_DEFAULTS.recordsPerEntity,
    categories: model.categories,
    modelEnums: model.enums,
    compiledRules: model.rules,
    compiledHooks: model.hooks,
    compiledWorkflows: model.workflows,
    compiledSagas: model.sagas,
    compiledRbac: model.rbac,
  };
}

/** Extra fields recorded in the manifest beyond what the settings carry. */
export interface ManifestExtras {
  input?: unknown;
  packageManager?: string;
}

/**
 * Write `.appwithai.json` so `appwithai info` — and anything else inspecting a
 * generated project — can tell what produced it.
 */
export async function writeManifest(
  outputDir: string,
  model: ParsedModel,
  settings: GenerationSettings,
  extras: ManifestExtras = {},
  log: PipelineLogger = NO_LOG
): Promise<void> {
  const port = settings.port ?? GENERATION_DEFAULTS.port;
  try {
    await fs.writeFile(
      path.join(outputDir, ".appwithai.json"),
      JSON.stringify(
        {
          name: settings.projectName,
          version: settings.projectVersion ?? GENERATION_DEFAULTS.projectVersion,
          description: settings.projectDescription ?? GENERATION_DEFAULTS.projectDescription,
          stack: settings.stackOption ?? GENERATION_DEFAULTS.stackOption,
          database: normalizeDatabaseType(settings.databaseType),
          input: extras.input,
          backendPort: port,
          frontendPort: settings.frontendPort ?? port + 1,
          apiUrl: settings.apiBaseUrl ?? `http://localhost:${port}`,
          entities: model.entities.map((entity) => entity.name),
          categories: model.categories.map((category) => category.name),
          rules: model.rules.map((rule) => `${rule.name} on ${rule.entity} (${rule.operation})`),
          hooks: model.hooks.map((hook) => `${hook.type} ${hook.handler} on ${hook.entity}`),
          workflows: model.workflows.map(
            (w) => `${w.name} on ${w.entity} (${w.states.length} states)`
          ),
          sagas: model.sagas.map(
            (s) => `${s.name} on ${s.entity} (${s.steps.length} steps, ${s.trigger})`
          ),
          rbac: [
            ...model.rbac.operations.map(
              (r) => `${r.entity}.${r.operation} -> ${r.roles.join("|")}`
            ),
            ...model.rbac.transitions.map(
              (r) => `${r.entity}.${r.transition} (transition) -> ${r.roles.join("|")}`
            ),
          ],
          packageManager: extras.packageManager,
          generatedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
  } catch (err) {
    // Non-fatal — a missing manifest does not invalidate the generated app —
    // but the manifest is what tooling reads back to know how this application
    // was generated, so its absence should be explainable.
    log.event("pipeline.artifact.write_failed", { artifact: ".appwithai.json", err });
  }
}

/**
 * How many files the run put on disk.
 *
 * Walked rather than counted as they are written: the generators call
 * `fs.writeFile` from a hundred and thirty-seven places and threading a counter
 * through all of them would be a far larger change than the number is worth.
 * The walk uses the same `fs` the pipeline already imports, which in a browser
 * tab is the memory filesystem, so this reports the same number there.
 *
 * Never throws. A count is a log field, and no log field is worth failing a
 * generation run that has already succeeded.
 */
async function countFiles(directory: string): Promise<number> {
  let total = 0;
  try {
    const entries = (await fs.readdir(directory, { withFileTypes: true })) as Array<{
      name: string;
      isDirectory: () => boolean;
    }>;
    for (const entry of entries) {
      // node_modules is not this run's output, and on a populated directory it
      // is most of what a walk would find.
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      total += entry.isDirectory() ? await countFiles(path.join(directory, entry.name)) : 1;
    }
  } catch {
    return total;
  }
  return total;
}

export interface GenerateApplicationOptions extends GenerationSettings {
  /** Model source text. Several are concatenated (CLI multi-file mode). */
  sources: string | string[];
  /** Pre-parsed model, when the caller has already parsed and logged it. */
  model?: ParsedModel;
  manifest?: ManifestExtras;
  /** Set false to skip `.appwithai.json` (dry runs). */
  writeManifestFile?: boolean;
}

/**
 * Parse, generate, and record the manifest — the whole pipeline, in the order
 * every entry point needs it.
 */
export async function generateApplication(
  options: GenerateApplicationOptions
): Promise<ParsedModel> {
  const log = options.logger ?? NO_LOG;
  const startedAt = Date.now();

  log.event("pipeline.generation.started", {
    project: options.projectName,
    stack: options.stackOption ?? GENERATION_DEFAULTS.stackOption,
    input: Array.isArray(options.sources) ? `${options.sources.length} sources` : "1 source",
    output: options.outputDir,
  });

  // Each stage names itself so a failure says which one stopped, rather than
  // leaving a stack trace as the only clue to how far the run got.
  let stage = "parse";
  try {
    const model = options.model ?? parseModel(options.sources);

    log.event("pipeline.model.parsed", {
      entities: model.entities.length,
      rules: model.rules.length,
      workflows: model.workflows.length,
      sagas: model.sagas.length,
      hooks: model.hooks.length,
      enums: model.enums.length,
    });

    stage = "emit";
    await fs.mkdir(options.outputDir, { recursive: true });

    const generator = new FullStackGenerator(buildGeneratorOptions(model, options));
    await generator.generate(model.entities, model.relationships);

    log.event("pipeline.files.written", {
      count: await countFiles(options.outputDir),
      output: options.outputDir,
      durationMs: Date.now() - startedAt,
    });

    stage = "artifacts";
    await writeModelSource(options.outputDir, options.sources, log);
    await writeManual(options.outputDir, model, options, log);

    if (options.writeManifestFile !== false) {
      await writeManifest(options.outputDir, model, options, options.manifest ?? {}, log);
    }

    log.event("pipeline.generation.completed", {
      project: options.projectName,
      files: await countFiles(options.outputDir),
      durationMs: Date.now() - startedAt,
    });

    return model;
  } catch (err) {
    log.event("pipeline.generation.failed", { project: options.projectName, stage, err });
    throw err;
  }
}

/**
 * Write the manual into the front end's static directory.
 *
 * `frontend/public/` is what TanStack Start serves at the site root, so the
 * dashboard's Manual button can be a plain `/manual.html` anchor — and the file
 * is equally openable by double-clicking it out of the downloaded zip, which is
 * the other way readers meet this application. One location, reachable both
 * ways; a second copy would be the one that goes stale.
 *
 * A failure here is not fatal. An application without its manual is a smaller
 * loss than a generation run that stopped part-way through.
 */
async function writeManual(
  outputDir: string,
  model: ParsedModel,
  options: GenerateApplicationOptions,
  log: PipelineLogger = NO_LOG
): Promise<void> {
  try {
    const directory = path.join(outputDir, "frontend", "public");
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(
      path.join(directory, "manual.html"),
      renderManual(model, {
        name: options.projectName,
        version: options.projectVersion ?? GENERATION_DEFAULTS.projectVersion,
        description: options.projectDescription ?? GENERATION_DEFAULTS.projectDescription,
        stack: "nestjs",
      }),
      "utf-8"
    );
  } catch (err) {
    // Non-fatal — an application without its manual still runs — but no longer
    // silent. This ran for a year as a bare `catch {}`, so a manual that failed
    // to render was indistinguishable from one nobody opened.
    log.event("pipeline.artifact.write_failed", { artifact: "manual.html", err });
  }
}

/**
 * Ship the model into the application it generated.
 *
 * The generated code is the model compiled: reading it back tells you what the
 * application does but not what it was asked to do, and nothing in it records
 * that a decision table had three rows for a reason. An administrator extending
 * the application — and the assistant helping them — needs the source, and the
 * only copy otherwise lives in the generator's database.
 *
 * It also makes the generated app self-describing: regenerating it needs only
 * the directory it produced.
 */
export async function writeModelSource(
  outputDir: string,
  sources: string | string[],
  log: PipelineLogger = NO_LOG
): Promise<void> {
  const document = (Array.isArray(sources) ? sources : [sources]).filter(Boolean).join("\n\n");
  if (!document.trim()) return;

  try {
    await fs.mkdir(path.join(outputDir, "model"), { recursive: true });
    await fs.writeFile(path.join(outputDir, "model", "model.eml.mmd"), document, "utf-8");
  } catch (err) {
    // Non-fatal, exactly like the manifest: the application runs without it.
    // Worth a line, though — this is the only copy of the model that ships with
    // the application, and losing it is how a generated app stops being
    // regenerable from its own directory.
    log.event("pipeline.artifact.write_failed", { artifact: "model/model.eml.mmd", err });
  }
}
