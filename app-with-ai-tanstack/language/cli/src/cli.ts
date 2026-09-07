/**
 * EML CLI — parse, validate, and generate applications from .mmd EML models.
 *
 * Zero runtime dependencies; runs under Bun or Node (via a bundle). Entrypoint
 * logic lives here; `eml.ts` is the thin executable shim.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { loadLanguageDefinition } from "../../index.ts";
import { collectionName, generateApp } from "./generate/app.ts";
import { generateCiWorkflow } from "./generate/ci.ts";
import { generateDocker } from "./generate/docker.ts";
import { publishToGithub } from "./generate/github.ts";
import { generateJdm } from "./generate/jdm.ts";
import { generateTanStack } from "./generate/tanstack.ts";
import type { Diagnostic, EmlModel } from "./model.ts";
import { parseEml } from "./parser.ts";
import { validateModel } from "./validator.ts";

const STACKS = ["node-rest", "tanstack-nestjs"] as const;
const STACK_ALIASES: Record<string, (typeof STACKS)[number]> = {
  "node-rest": "node-rest",
  node: "node-rest",
  rest: "node-rest",
  "tanstack-nestjs": "tanstack-nestjs",
  "tanstackjs-nestjs": "tanstack-nestjs",
  "tanstack-start-nestjs": "tanstack-nestjs",
  tanstack: "tanstack-nestjs",
};

const CLI_VERSION = "1.0.0";

// --- Tiny ANSI helpers (respect NO_COLOR) ----------------------------------
const useColor = !process.env.NO_COLOR && process.stdout.isTTY;
const c = {
  dim: (s: string) => (useColor ? `\x1b[2m${s}\x1b[0m` : s),
  red: (s: string) => (useColor ? `\x1b[31m${s}\x1b[0m` : s),
  green: (s: string) => (useColor ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s: string) => (useColor ? `\x1b[33m${s}\x1b[0m` : s),
  cyan: (s: string) => (useColor ? `\x1b[36m${s}\x1b[0m` : s),
  bold: (s: string) => (useColor ? `\x1b[1m${s}\x1b[0m` : s),
};

interface Flags {
  _: string[];
  input?: string;
  output?: string;
  name?: string;
  stack: string;
  docker: boolean;
  github?: string;
  githubToken?: string;
  private?: boolean;
  autofix: boolean;
  force: boolean;
  json: boolean;
  help: boolean;
  version: boolean;
}

class CliError extends Error {
  constructor(
    message: string,
    readonly code = 1
  ) {
    super(message);
  }
}

// --- Argument parsing -------------------------------------------------------
function parseArgs(argv: string[]): Flags {
  const f: Flags = {
    _: [],
    stack: "node-rest",
    docker: false,
    autofix: true,
    force: false,
    json: false,
    help: false,
    version: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new CliError(`Missing value for ${a}`);
      return v;
    };
    switch (a) {
      case "-i":
      case "--input":
        f.input = next();
        break;
      case "-o":
      case "--output":
        f.output = next();
        break;
      case "-n":
      case "--name":
        f.name = next();
        break;
      case "--stack":
        f.stack = next();
        break;
      case "--docker":
        f.docker = true;
        break;
      case "--github":
        f.github = next();
        break;
      case "--github-token":
        f.githubToken = next();
        break;
      case "--private":
        f.private = true;
        break;
      case "--public":
        f.private = false;
        break;
      case "--no-autofix":
        f.autofix = false;
        break;
      case "--force":
        f.force = true;
        break;
      case "--json":
        f.json = true;
        break;
      case "-h":
      case "--help":
        f.help = true;
        break;
      case "-v":
      case "--version":
        f.version = true;
        break;
      default:
        if (!a) break;
        if (a.startsWith("-")) throw new CliError(`Unknown option: ${a}`);
        f._.push(a);
    }
  }
  return f;
}

// --- Help text --------------------------------------------------------------
const HELP = `${c.bold("eml")} — build applications from an EML (.mmd) model

${c.bold("USAGE")}
  eml <command> [options]

${c.bold("COMMANDS")}
  generate   Parse, validate (with self-correction), and generate an app
  validate   Parse and validate a model; report diagnostics
  info       Print a summary of the parsed model
  help       Show this help

${c.bold("OPTIONS")}
  -i, --input <file>        Input .mmd EML file (or first positional arg)
  -o, --output <dir>        Output directory for the generated app
  -n, --name <name>         Application name (default: derived from the model)
      --stack <stack>       Target stack: node-rest (default) | tanstack-nestjs
      --docker              Also emit Dockerfile + docker-compose.yml (node-rest)
      --github <owner/repo> Publish the generated app to a GitHub repository
      --github-token <tok>  GitHub token (else GITHUB_TOKEN / GH_TOKEN)
      --private             Create the GitHub repo private (default)
      --public              Create the GitHub repo public
      --no-autofix          Disable validation self-correction
      --force               Overwrite a non-empty output directory
      --json                Machine-readable output (validate/info)
  -h, --help                Show help
  -v, --version             Show version

${c.bold("EXAMPLES")}
  eml validate -i model.mmd
  eml generate -i model.mmd -o ./out -n my-app
  eml generate -i model.mmd -o ./out --docker
  eml generate -i model.mmd -o ./out --stack tanstack-nestjs
  eml generate -i model.mmd -o ./out --github me/my-app --public
`;

// --- Commands ---------------------------------------------------------------
function readInput(f: Flags): { file: string; source: string } {
  const file = f.input ?? f._[1]; // allow `eml generate model.mmd`
  if (!file) throw new CliError("No input file. Use -i <file> or pass it as an argument.");
  if (!existsSync(file)) throw new CliError(`Input file not found: ${file}`);
  return { file, source: readFileSync(file, "utf8") };
}

function printDiagnostics(diags: Diagnostic[]): void {
  for (const d of diags) {
    const loc = d.line ? c.dim(`:${d.line}`) : "";
    const tag =
      d.severity === "error"
        ? c.red("error")
        : d.severity === "warning"
          ? c.yellow("warn ")
          : c.cyan("fix  ");
    const fix = d.fix ? c.dim(` → ${d.fix}`) : "";
    console.log(`  ${tag} ${c.dim(d.code)}${loc}  ${d.message}${fix}`);
  }
}

function summarize(model: EmlModel): Record<string, unknown> {
  return {
    name: model.meta.name,
    entities: model.entities.length,
    relationships: model.relationships.length,
    enums: model.enums.length,
    indexes: model.indexes.length,
    rules: model.rules.length,
    workflows: model.workflows.length,
    hooks: model.hooks.length,
    guards: model.guards.length,
    triggers: model.triggers.length,
  };
}

function cmdValidate(f: Flags): number {
  const { file, source } = readInput(f);
  const model = parseEml(source);
  const result = validateModel(model, { autofix: f.autofix });

  if (f.json) {
    console.log(
      JSON.stringify(
        { file, summary: summarize(model), result, diagnostics: model.diagnostics },
        null,
        2
      )
    );
    return result.ok ? 0 : 1;
  }

  console.log(c.bold(`\nValidating ${file}`));
  if (model.diagnostics.length) printDiagnostics(model.diagnostics);
  else console.log(c.green("  no issues"));

  const parts = [
    result.errors ? c.red(`${result.errors} error(s)`) : c.green("0 errors"),
    `${result.warnings} warning(s)`,
    result.fixes ? c.cyan(`${result.fixes} auto-fix(es)`) : "0 fixes",
  ];
  console.log(`\n${parts.join(", ")}`);
  return result.ok ? 0 : 1;
}

function cmdInfo(f: Flags): number {
  const { file, source } = readInput(f);
  const model = parseEml(source);
  validateModel(model, { autofix: f.autofix });
  const summary = summarize(model);

  if (f.json) {
    console.log(JSON.stringify({ file, summary, model }, null, 2));
    return 0;
  }

  console.log(c.bold(`\n${model.meta.name ?? "EML model"}`), c.dim(`(${file})`));
  console.log(c.dim("─".repeat(48)));
  for (const [k, v] of Object.entries(summary)) {
    if (k === "name") continue;
    console.log(`  ${k.padEnd(16)} ${v}`);
  }
  if (model.entities.length) {
    console.log(c.bold("\nEntities"));
    for (const e of model.entities) {
      console.log(
        `  ${e.name} ${c.dim(`→ /api/${collectionName(e)} (${e.attributes.length} fields)`)}`
      );
    }
  }
  if (model.rules.length) {
    console.log(c.bold("\nBusiness rules"));
    for (const r of model.rules)
      console.log(`  ${r.name} ${c.dim(`on ${r.entity} (${r.event ?? "-"})`)}`);
  }
  if (model.workflows.length) {
    console.log(c.bold("\nWorkflows"));
    for (const w of model.workflows)
      console.log(`  ${w.name} ${c.dim(`(${w.kind}) on ${w.entity ?? "-"}`)}`);
  }
  console.log();
  return 0;
}

async function cmdGenerate(f: Flags): Promise<number> {
  const { file, source } = readInput(f);
  const outDir = f.output;
  if (!outDir) throw new CliError("No output directory. Use -o <dir>.");
  const stack = STACK_ALIASES[f.stack];
  if (!stack)
    throw new CliError(`Unsupported stack "${f.stack}". Available: ${STACKS.join(", ")}.`);

  console.log(c.bold(`\nGenerating from ${file}`) + c.dim(`  [stack: ${stack}]`));

  // 1. Parse.
  const model = parseEml(source);
  if (model.entities.length === 0) {
    throw new CliError(
      "No entities found in the model. An EML file needs at least one erDiagram entity."
    );
  }

  // 2. Validate + self-correct.
  const result = validateModel(model, { autofix: f.autofix });
  if (model.diagnostics.length) printDiagnostics(model.diagnostics);
  if (!result.ok) {
    throw new CliError(
      `Validation failed with ${result.errors} error(s). Fix them or run with self-correction enabled.`
    );
  }
  if (result.fixes) console.log(c.cyan(`  applied ${result.fixes} self-correction(s)`));

  // 3. Output dir guard.
  prepareOutDir(outDir, f.force);

  const appName = sanitizeName(
    f.name ?? model.meta.name ?? path.basename(file, path.extname(file)) ?? "eml-app"
  );

  // 4. Generate app for the selected stack.
  let runHint: string;
  if (stack === "tanstack-nestjs") {
    const res = await generateTanStack(model, { outDir, appName });
    console.log(
      c.green(`  wrote ${res.generatedFiles.length} app file(s) (TanStack Start + NestJS)`)
    );
    runHint = `  cd ${outDir}/backend && bun install && bun run dev   # NestJS API\n  cd ${outDir}/frontend && bun install && bun run dev  # TanStack Start`;
  } else {
    const written = generateApp(model, { outDir, appName });
    console.log(c.green(`  wrote ${written.length} app file(s) (Node REST)`));
    runHint = `  cd ${outDir} && npm start   # then open http://localhost:3000`;
  }

  // 5. Business rules → GoRules JDM (shipped converter).
  const jdmFiles = generateJdm(model, outDir);
  if (jdmFiles.length) {
    console.log(c.green(`  wrote ${jdmFiles.length} GoRules JDM file(s) → rules/`));
  }

  // 6. Docker + CI/CD workflow (optional; node-rest app).
  if (f.docker) {
    if (stack === "node-rest") {
      const dockerFiles = generateDocker(outDir, appName);
      console.log(c.green(`  wrote ${dockerFiles.length} docker file(s)`));
      const ciFiles = generateCiWorkflow(outDir, appName);
      console.log(c.green(`  wrote ${ciFiles.length} GitHub Actions workflow (docker + compose)`));
    } else {
      console.log(c.yellow("  --docker is only supported for the node-rest stack; skipped"));
    }
  }

  console.log(`\n${c.green("✓")} Generated ${c.bold(appName)} → ${outDir}\n${c.dim(runHint)}`);

  // 6. GitHub (optional).
  if (f.github) {
    console.log(c.bold(`\nPublishing to GitHub (${f.github})`));
    const gh = await publishToGithub({
      target: f.github,
      token: f.githubToken,
      private: f.private ?? true,
      outDir,
    });
    for (const m of gh.messages) console.log(`  ${gh.ok ? c.dim("•") : c.red("•")} ${m}`);
    if (!gh.ok) return 1;
  }

  return 0;
}

function prepareOutDir(outDir: string, force: boolean): void {
  if (existsSync(outDir)) {
    if (!statSync(outDir).isDirectory())
      throw new CliError(`Output path exists and is not a directory: ${outDir}`);
    const entries = readdirSync(outDir);
    if (entries.length > 0 && !force) {
      throw new CliError(`Output directory "${outDir}" is not empty. Use --force to overwrite.`);
    }
  } else {
    mkdirSync(outDir, { recursive: true });
  }
}

function sanitizeName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-") || "eml-app"
  );
}

// --- Entrypoint -------------------------------------------------------------
export async function run(argv: string[]): Promise<number> {
  let flags: Flags;
  try {
    flags = parseArgs(argv);
  } catch (err) {
    console.error(c.red(err instanceof Error ? err.message : String(err)));
    return 1;
  }

  if (flags.version) {
    const def = loadLanguageDefinition();
    console.log(`eml ${CLI_VERSION}  (EML language ${def.language.version})`);
    return 0;
  }

  const command = flags._[0] ?? (flags.help ? "help" : "");
  if (!command || command === "help" || flags.help) {
    console.log(HELP);
    return command && command !== "help" ? 1 : 0;
  }

  try {
    switch (command) {
      case "validate":
        return cmdValidate(flags);
      case "info":
        return cmdInfo(flags);
      case "generate":
        return await cmdGenerate(flags);
      default:
        console.error(c.red(`Unknown command: ${command}`));
        console.log(HELP);
        return 1;
    }
  } catch (err) {
    if (err instanceof CliError) {
      console.error(c.red(`\n✗ ${err.message}`));
      return err.code;
    }
    console.error(
      c.red(`\n✗ Unexpected error: ${err instanceof Error ? err.message : String(err)}`)
    );
    if (process.env.EML_DEBUG) console.error(err);
    return 1;
  }
}
