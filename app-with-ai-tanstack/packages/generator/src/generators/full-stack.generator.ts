/**
 * Full Stack Generator
 *
 * Orchestrates generation of complete full-stack applications:
 * - tanstackjs-nestjs: NestJS + TanStack Start (Modern Web Stack)
 *
 * Generates both backend and frontend with Application Dictionary
 * infrastructure and runtime UI configuration support.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Entity, EntityEnum, Relationship } from "@appwithai/core/types";
import type { CompiledHook } from "../hooks";
import type { EntityCategory } from "../parsers/category.parser";
import type { CompiledRbac } from "../rbac";
import type { CompiledRule } from "../rules";
import type { CompiledSaga, CompiledWorkflow } from "../workflows";
import { DEFAULT_FRONTEND_PORT } from "./ports";
import {
  NestJsBackendGenerator,
  type NestJsBackendOptions,
} from "./tanstack-start-nestjs/nestjs-backend.generator";
import {
  TanStackStartFrontendGenerator,
  type TanStackStartFrontendOptions,
} from "./tanstack-start-nestjs/tanstack-start-frontend.generator";
import { BunE2ETestGenerator } from "./tests/bun-e2e.generator";

export type StackOption = "tanstackjs-nestjs" | "tanstack-start-nestjs";
export type AIAddonOption = "none" | "basic" | "advanced";

export interface FullStackGeneratorOptions {
  stackOption: StackOption;
  projectName: string;
  projectVersion: string;
  projectDescription: string;
  outputDir: string;
  port: number;
  frontendPort?: number;

  // AI Natural Language Add-on (optional)
  aiNlAddon?: AIAddonOption;
  aiNlProvider?: "anthropic" | "openai";
  aiNlModel?: string;

  // Skip network CLI scaffolding; generate purely from bundled templates.
  skipCliScaffold?: boolean;

  // tanstackjs-nestjs specific
  tanstackStartNestjs?: {
    backend: Partial<NestJsBackendOptions>;
    frontend: Partial<TanStackStartFrontendOptions>;
  };

  skipFrontend?: boolean;
  skipBackend?: boolean;

  /** Skip generation of the bun:test E2E suite in <outputDir>/tests. */
  skipTests?: boolean;
  /**
   * Application Dictionary entity categories parsed from the model's
   * `%%category` directives. Falls back to a single "General" default.
   */
  categories?: EntityCategory[];
  /** `%%enum` declarations bound to columns, each with its list reference id. */
  modelEnums?: EntityEnum[];

  /**
   * Business rules compiled from the model's `%%rule` sections. Seeded into
   * sys_rule_definitions so a rule authored in EML is enforced by the app.
   */
  compiledRules?: CompiledRule[];
  /**
   * Lifecycle handlers declared by the model's `%%hook` directives. Generated
   * as per-entity handler modules the bus service runs around each operation.
   */
  compiledHooks?: CompiledHook[];
  /** Status machines compiled from the model's state workflows. */
  compiledWorkflows?: CompiledWorkflow[];
  /** Multi-step processes compiled from the model's `kind: saga` workflows. */
  compiledSagas?: CompiledSaga[];
  /**
   * Role restrictions from the model's `%%rbac` directives — CRUD operations
   * and state transitions. Seeded and enforced by the generated guard.
   */
  compiledRbac?: CompiledRbac;
  /** Records the bulk-seed suite creates per entity (default 1000). */
  recordsPerEntity?: number;
}

export class FullStackGenerator {
  private options: FullStackGeneratorOptions;

  constructor(options: FullStackGeneratorOptions) {
    this.options = options;
  }

  /**
   * Generate complete full-stack application
   */
  async generate(entities: Entity[], relationships: Relationship[]): Promise<void> {
    const outputDir = this.options.outputDir;

    // Create root directory
    await fs.mkdir(outputDir, { recursive: true });

    // Generate based on stack option
    await this.generateTanStackStartNestjs(entities, relationships, outputDir);

    // Generate shared files
    await this.generateSharedFiles(outputDir);

    console.log(`\n✅ Full-stack application generated at: ${outputDir}`);
    console.log(`   Stack: ${this.getStackDescription()}`);
    console.log(`   Entities: ${entities.length}`);
    console.log(`   Relationships: ${relationships.length}`);
    if (this.options.aiNlAddon && this.options.aiNlAddon !== "none") {
      console.log(
        `   AI NL Add-on: ${this.options.aiNlAddon} (${this.options.aiNlProvider || "anthropic"})`
      );
    }

    // The linting check is NOT run here. It shells out to the generated
    // package scripts, and at this point nothing is installed — so it reported
    // "linting found issues" on every generation regardless of the code, which
    // is a signal that cannot distinguish a missing biome from a real finding.
    // The CLI runs it after the install step instead; see `runLintingChecks`.
  }

  /**
   * Generate tanstackjs-nestjs: TanStack Start + NestJS
   */
  private async generateTanStackStartNestjs(
    entities: Entity[],
    relationships: Relationship[],
    outputDir: string
  ): Promise<void> {
    const backendDir = path.join(outputDir, "backend");
    const frontendDir = path.join(outputDir, "frontend");

    // AI NL Add-on config (passed to templates)
    const aiConfig = {
      aiNlAddon: this.options.aiNlAddon || "none",
      aiNlProvider: this.options.aiNlProvider || "anthropic",
      aiNlModel: this.options.aiNlModel || "claude-sonnet-4-20250514",
    };

    // Backend options
    const backendOptions: NestJsBackendOptions = {
      projectName: this.options.projectName,
      projectVersion: this.options.projectVersion,
      projectDescription: this.options.projectDescription,
      databaseType: "postgresql",
      port: this.options.port,
      frontendPort: this.options.frontendPort ?? DEFAULT_FRONTEND_PORT,
      enableSwagger: true,
      enableCors: true,
      skipCliScaffold: this.options.skipCliScaffold,
      categories: this.options.categories,
      modelEnums: this.options.modelEnums,
      compiledRules: this.options.compiledRules,
      compiledHooks: this.options.compiledHooks,
      compiledWorkflows: this.options.compiledWorkflows,
      compiledSagas: this.options.compiledSagas,
      compiledRbac: this.options.compiledRbac,
      ...aiConfig,
      ...this.options.tanstackStartNestjs?.backend,
    };

    if (!this.options.skipBackend) {
      console.log("📦 Generating NestJS backend...");
      const backendGenerator = new NestJsBackendGenerator(backendOptions);
      await backendGenerator.generate(entities, relationships, backendDir);
    }

    if (!this.options.skipFrontend) {
      const frontendOptions: TanStackStartFrontendOptions = {
        projectName: this.options.projectName,
        projectVersion: this.options.projectVersion,
        projectDescription: this.options.projectDescription,
        apiBaseUrl: `http://localhost:${this.options.port}`,
        frontendPort: this.options.frontendPort ?? DEFAULT_FRONTEND_PORT,
        enableDarkMode: false,
        stackOption: this.options.stackOption as "tanstackjs-nestjs" | "tanstack-start-nestjs",
        skipCliScaffold: this.options.skipCliScaffold,
        // The front end enforces nothing, but its sign-in screen names the
        // accounts the backend seed created — from the same derivation, so the
        // two cannot drift into offering an address that does not exist.
        compiledRbac: this.options.compiledRbac,
        ...aiConfig,
        ...this.options.tanstackStartNestjs?.frontend,
      };

      console.log("📦 Generating TanStack Start frontend...");
      const frontendGenerator = new TanStackStartFrontendGenerator(frontendOptions);
      await frontendGenerator.generate(entities, relationships, frontendDir);
    }

    if (!this.options.skipTests) {
      console.log("🧪 Generating bun:test E2E suite...");
      const testGenerator = new BunE2ETestGenerator({
        projectName: this.options.projectName,
        projectVersion: this.options.projectVersion,
        projectDescription: this.options.projectDescription,
        port: this.options.port,
        frontendPort: this.options.frontendPort ?? DEFAULT_FRONTEND_PORT,
        recordsPerEntity: this.options.recordsPerEntity,
        // What the model declared, handed to the suites as data so they can
        // check the running application against it rather than against the
        // dictionary the same generator wrote.
        modelEnums: this.options.modelEnums,
        compiledWorkflows: this.options.compiledWorkflows,
        // The access suite drives every %%rbac rule as the role it names, so it
        // needs both the rules and the addresses the seeds gave those roles.
        compiledRbac: this.options.compiledRbac,
      });
      await testGenerator.generate(entities, relationships, outputDir);
    }
  }

  /**
   * Generate shared configuration files
   */
  private async generateSharedFiles(outputDir: string): Promise<void> {
    // Root package.json for monorepo
    const rootPackageJson = {
      name: this.options.projectName,
      version: this.options.projectVersion,
      description: this.options.projectDescription,
      private: true,
      workspaces: this.options.skipTests
        ? ["backend", "frontend"]
        : ["backend", "frontend", "tests"],
      scripts: {
        dev: 'concurrently "bun run dev:backend" "bun run dev:frontend"',
        "dev:backend": "cd backend && bun run start:dev",
        "dev:frontend": "cd frontend && bun run dev",
        build: "bun run build:backend && bun run build:frontend",
        "build:backend": "cd backend && bun run build",
        "build:frontend": "cd frontend && bun run build",
        "db:migrate": "cd backend && bun run migrate",
        "db:seed": "cd backend && bun run seed",
        "db:setup": "cd backend && bun run db:setup",
        test: "bun run test:backend && bun run test:frontend",
        "test:backend": "cd backend && bun run test",
        "test:frontend": "cd frontend && bun run test",
        // End-to-end suites run on bun:test and start the backend themselves.
        "test:e2e": "cd tests && bun run test",
        "test:e2e:fast": "cd tests && bun run test:fast",
        "test:e2e:attach": "cd tests && bun run test:attach",
        "test:all": "bun run test && bun run test:e2e",
      },
      devDependencies: {
        concurrently: "^8.2.0",
      },
      overrides: {
        "@tanstack/router-generator": "1.97.1",
        "@tanstack/router-plugin": "1.97.1",
        "@tanstack/start-plugin": "1.97.19",
        "@tanstack/server-functions-plugin": "1.97.19",
        "@tanstack/react-cross-context": "1.97.18",
        "@tanstack/directive-functions-plugin": "1.97.19",
        "@tanstack/virtual-file-routes": "1.97.8",
      },
    };

    await fs.writeFile(
      path.join(outputDir, "package.json"),
      JSON.stringify(rootPackageJson, null, 2)
    );

    // README.md
    const readme = this.generateReadme();
    await fs.writeFile(path.join(outputDir, "README.md"), readme);

    // .gitignore
    const gitignore = `# Dependencies
node_modules/

# Build output
dist/
.next/
out/

# Generated by TanStack Router on dev/build — never edit or commit
frontend/src/routeTree.gen.ts

# Environment files
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Database
*.db
*.sqlite

# What a test run leaves behind. The metrics reports and the seed manifest name
# the rows one particular run created, on one particular database — committing
# them would put a second developer's ids in everyone's tree, and the next run
# rewrites them anyway.
test-results/
tests/.e2e-seed-manifest.json
`;
    await fs.writeFile(path.join(outputDir, ".gitignore"), gitignore);

    // Container assets: the compose file that runs the split services, the
    // root Dockerfile that packages the whole application as one image, and the
    // start script that image runs.
    await this.writeContainerFiles(outputDir);

    // Copy GitHub Actions workflows
    await this.copyGitHubWorkflows(outputDir);
  }

  /**
   * Render the root-level container files.
   *
   * These use plain substitution rather than Handlebars: the templates are YAML
   * and shell, both of which are full of braces of their own, and compiling
   * them would mean escaping every one. The placeholders here are a fixed,
   * documented handful.
   *
   * A missing template is a warning, not a failure — an application that cannot
   * be containerised is still an application, and the generate step should not
   * die over it.
   */
  private async writeContainerFiles(outputDir: string): Promise<void> {
    const files: Array<{ template: string; output: string; executable?: boolean }> = [
      { template: "docker-compose.yml.hbs", output: "docker-compose.yml" },
      { template: "Dockerfile.hbs", output: "Dockerfile" },
      // Every service builds from the project root, so the context is the whole
      // tree. Without this the daemon receives node_modules and .git first.
      { template: ".dockerignore.hbs", output: ".dockerignore" },
      // Compose reads `.env` from the project root. This is the file the
      // reader copies to it — the AI endpoint and the secrets, which are the
      // two things no default can supply.
      { template: ".env.example.root.hbs", output: ".env.example" },
      { template: "docker-start.sh.hbs", output: "docker-start.sh", executable: true },
    ];

    // The Dockerfile copies this directory unconditionally, so it has to exist
    // even when nobody has put a certificate in it.
    const certsDir = path.join(outputDir, "docker", "ca-certificates");
    await fs.mkdir(certsDir, { recursive: true });
    await fs.writeFile(
      path.join(certsDir, ".gitkeep"),
      "Certificates placed here are trusted while the image builds.\n" +
        "Needed only behind a TLS-intercepting proxy. See the Dockerfile.\n"
    );

    const backendPort = this.options.port;
    const frontendPort = this.options.frontendPort ?? DEFAULT_FRONTEND_PORT;
    const projectId = this.options.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const projectSnake = this.options.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "_");

    const render = (content: string): string =>
      content
        .replace(/\{\{project\.name \| replace '-' '_'\}\}/g, projectSnake)
        .replace(/\{\{project\.name\}\}/g, this.options.projectName)
        .replace(/\{\{project\.id\}\}/g, projectId)
        .replace(/\{\{project\.backendPort\}\}/g, String(backendPort))
        .replace(/\{\{project\.frontendPort\}\}/g, String(frontendPort));

    for (const file of files) {
      try {
        const templateDir = await this.findTemplatesDir();
        const source = path.join(templateDir, "tanstack-start-nestjs", file.template);
        const rendered = render(await fs.readFile(source, "utf-8"));
        const destination = path.join(outputDir, file.output);
        await fs.writeFile(destination, rendered);
        // chmod is best-effort: Windows and some CI filesystems reject it.
        if (file.executable) await fs.chmod(destination, 0o755).catch(() => {});
      } catch (error) {
        console.warn(`${file.output} generation skipped: ${(error as Error).message}`);
      }
    }
  }

  private async findTemplatesDir(): Promise<string> {
    const cwd = process.cwd();
    const candidates = [
      // When cwd is the generator package (bun --filter mode)
      path.join(cwd, "templates"),
      // When cwd is workspace root
      path.join(cwd, "packages/generator/templates"),
      // Navigate up 3 from packages/generator to workspace root, then back
      path.join(cwd, "../../../packages/generator/templates"),
      path.join(cwd, "../../packages/generator/templates"),
      // __dirname relative (dist/cli/ → up to package root → templates)
      path.join(__dirname, "../../templates"),
      path.join(__dirname, "../../../templates"),
    ];
    for (const c of candidates) {
      try {
        const s = await fs.stat(c);
        if (s.isDirectory()) return c;
      } catch {
        /* continue */
      }
    }
    return candidates[0]!;
  }

  /**
   * Copy GitHub Actions workflow templates to the output directory
   */
  private async copyGitHubWorkflows(outputDir: string): Promise<void> {
    const workflowsDir = path.join(outputDir, ".github", "workflows");
    await fs.mkdir(workflowsDir, { recursive: true });

    if (this.options.stackOption === "tanstackjs-nestjs") {
      console.log("📋 Setting up GitHub Actions workflows...");

      // Find the templates directory by traversing up from the dist directory
      let templatesDir = path.resolve(__dirname, "../../../templates");

      // If __dirname doesn't point to the right place, try to find the root
      if (!(await this.directoryExists(templatesDir))) {
        // Try alternate paths
        const currentDir = process.cwd();
        const possiblePaths = [
          path.join(currentDir, "packages/generator/templates"),
          path.join(currentDir, "../packages/generator/templates"),
          path.join(currentDir, "../../packages/generator/templates"),
        ];

        for (const possiblePath of possiblePaths) {
          if (await this.directoryExists(possiblePath)) {
            templatesDir = possiblePath;
            break;
          }
        }
      }

      // Copy frontend workflows
      try {
        const frontendWorkflowsSource = path.join(
          templatesDir,
          "tanstack-start-nestjs/frontend/.github/workflows"
        );

        if (await this.directoryExists(frontendWorkflowsSource)) {
          const entries = await fs.readdir(frontendWorkflowsSource);
          for (const entry of entries) {
            if (entry.endsWith(".hbs")) {
              const source = path.join(frontendWorkflowsSource, entry);
              const destName = entry.replace(".hbs", "");
              const dest = path.join(workflowsDir, destName);
              const content = await fs.readFile(source, "utf-8");
              const rendered = this.renderWorkflowTemplate(content);
              await fs.writeFile(dest, rendered);
              console.log(`   ✓ Created frontend workflow: ${destName}`);
            }
          }
        }
      } catch (_e) {
        // Workflows may not exist yet
      }

      // Copy backend workflows
      try {
        const backendWorkflowsSource = path.join(
          templatesDir,
          "tanstack-start-nestjs/backend/.github/workflows"
        );

        if (await this.directoryExists(backendWorkflowsSource)) {
          const entries = await fs.readdir(backendWorkflowsSource);
          for (const entry of entries) {
            if (entry.endsWith(".hbs")) {
              const source = path.join(backendWorkflowsSource, entry);
              const destName = `backend-${entry.replace(".hbs", "")}`;
              const dest = path.join(workflowsDir, destName);
              const content = await fs.readFile(source, "utf-8");
              const rendered = this.renderWorkflowTemplate(content);
              await fs.writeFile(dest, rendered);
              console.log(`   ✓ Created backend workflow: ${destName}`);
            }
          }
        }
      } catch (_e) {
        // Workflows may not exist yet
      }
    }
  }

  /**
   * Check if a directory exists
   */
  private async directoryExists(dir: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dir);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Render template variables in workflow files
   */
  private renderWorkflowTemplate(content: string): string {
    return content
      .replace(/\{\{project\.name\}\}/g, this.options.projectName)
      .replace(
        /\{\{project\.id\}\}/g,
        this.options.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")
      )
      .replace(/\{\{project\.version\}\}/g, this.options.projectVersion)
      .replace(/\{\{project\.description\}\}/g, this.options.projectDescription);
  }

  /**
   * Generate README content
   */
  private generateReadme(): string {
    const stackInfo =
      "- **Backend**: NestJS + Fastify + Kysely\n- **Frontend**: TanStack Start + Shadcn UI + TanStack Query/Table/Form";

    return `# ${this.options.projectName}

${this.options.projectDescription}

## Tech Stack

${stackInfo}

## Features

- **Compiere-style Application Dictionary**: Runtime-configurable UI via sys_field metadata
- **sys_ Tables**: System/dictionary tables for configuration
- **bus_ Tables**: Business entity tables generated from ERD
- **Dynamic UI**: Form and table layouts driven by seq_no ordering
- **Admin Interface**: Drag-drop field reordering with immediate effect
- **ETag Concurrency**: Optimistic locking for safe concurrent edits

## Getting Started

### Prerequisites

- **Bun.js 1.1.0+** (REQUIRED runtime)
- PostgreSQL 14+ (or SQLite for development)

### Installation

\`\`\`bash
# Install dependencies
bun install

# Setup environment
cp backend/.env.example backend/.env
# Edit .env with your database credentials

# Run migrations
bun run db:migrate

# Seed initial data (sys_reference, sys_table, sys_column, sys_field)
bun run db:seed
\`\`\`

### Development

\`\`\`bash
# Start both backend and frontend
bun run dev

# Or start individually
bun run dev:backend   # API on http://localhost:${this.options.port}
bun run dev:frontend  # App on http://localhost:${this.options.frontendPort ?? DEFAULT_FRONTEND_PORT}
\`\`\`

### Production Build

\`\`\`bash
bun run build
\`\`\`

## Project Structure

\`\`\`
${this.options.projectName}/
├── backend/           # NestJS API
│   ├── src/
│   │   ├── modules/
│   │   │   ├── sys/   # Application Dictionary modules
│   │   │   └── bus/   # Business entity modules
│   │   └── ...
│   ├── migrations/    # Database migrations
│   └── seeds/         # Seed data
├── frontend/          # TanStack Start App
│   ├── src/routes/
│   └── ...
└── package.json       # Root workspace config
\`\`\`

## Runtime UI Configuration

The UI layout can be modified at runtime through the admin interface:

1. Navigate to /admin
2. Select an entity to configure
3. Drag and drop fields to reorder
4. Changes take effect immediately

Field ordering is controlled by:
- \`seq_no\`: Order in detail forms
- \`seq_no_grid\`: Order in list/table views

## License

MIT
`;
  }

  /**
   * Get human-readable stack description
   */
  private getStackDescription(): string {
    return "tanstackjs-nestjs - Modern Web (TanStack Start + NestJS)";
  }
}

export default FullStackGenerator;
