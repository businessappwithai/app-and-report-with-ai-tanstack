/**
 * TanStack Start + NestJS generation target.
 *
 * Reuses the SHIPPED generator (`packages/generator`) — its
 * `GeneratorOrchestrator`, `FullStackGenerator`, and the
 * `tanstack-start-nestjs` Handlebars templates — to produce a full-stack app
 * from the EML model. The EML model is mapped to the core `Entity[]` /
 * `Relationship[]` shapes the orchestrator consumes, and generation runs in
 * `skipCliScaffold` (template-only) mode so no network scaffolding is required.
 *
 * The cross-package generator is loaded via a runtime dynamic import with a
 * non-literal specifier and local structural types, so this file stays
 * self-contained for the CLI's own type-check while still driving the real
 * generator at runtime (under Bun, with `@appwithai/core` built).
 */

import type { EmlModel } from "../model.ts";

// --- Local structural mirrors of the core generator types ------------------
interface CoreEntityAttribute {
  name: string;
  type: string;
  required: boolean;
  unique?: boolean;
  maxLength?: number;
}
interface CoreEntity {
  name: string;
  tableName: string;
  description?: string;
  attributes: CoreEntityAttribute[];
  primaryKey: string;
  timestamps: boolean;
}
interface CoreRelationship {
  name: string;
  sourceEntity: string;
  targetEntity: string;
  cardinality: "oneToOne" | "oneToMany" | "manyToOne" | "manyToMany";
  foreignKey?: string;
}
interface OrchestratorOptionsLike {
  stackOption: "tanstackjs-nestjs";
  projectName: string;
  projectVersion: string;
  projectDescription: string;
  outputDir: string;
  port: number;
  databaseType: "postgresql" | "mysql" | "sqlite";
  includeRbac: boolean;
  randomizeFieldOrder: boolean;
  aiNlAddon?: "none" | "basic" | "advanced";
  skipCliScaffold?: boolean;
}
interface GenerationResultLike {
  generatedFiles: string[];
  entityCount: number;
  relationshipCount: number;
}
type OrchestratorCtor = new (
  o: OrchestratorOptionsLike
) => {
  generate(e: CoreEntity[], r: CoreRelationship[]): Promise<GenerationResultLike>;
};

export interface TanStackGenerateOptions {
  outDir: string;
  appName: string;
  port?: number;
  databaseType?: "postgresql" | "mysql" | "sqlite";
  includeRbac?: boolean;
}

/** Map the EML model to the core Entity[] / Relationship[] the generator uses. */
export function toCoreEntities(model: EmlModel): {
  entities: CoreEntity[];
  relationships: CoreRelationship[];
} {
  const entities: CoreEntity[] = model.entities.map((e) => ({
    name: e.name,
    tableName: e.tableName,
    description: e.label ?? "",
    attributes: e.attributes.map((a) => ({
      name: a.name,
      type: a.type,
      required: a.required,
      unique: a.unique,
      maxLength: a.maxLength,
    })),
    primaryKey: e.primaryKey,
    timestamps: e.timestamps,
  }));

  const relationships: CoreRelationship[] = model.relationships.map((r) => ({
    name: r.name,
    sourceEntity: r.source,
    targetEntity: r.target,
    cardinality: r.cardinality,
    foreignKey: r.foreignKey,
  }));

  return { entities, relationships };
}

/**
 * Generate a TanStack Start + NestJS app from the EML model by driving the
 * shipped orchestrator. Returns the number of files generated.
 */
export async function generateTanStack(
  model: EmlModel,
  opts: TanStackGenerateOptions
): Promise<GenerationResultLike> {
  const { entities, relationships } = toCoreEntities(model);

  // Non-literal specifier keeps this out of the CLI's own type program while
  // resolving at runtime (relative to this module) under Bun.
  const orchestratorModule = [
    "..",
    "..",
    "..",
    "..",
    "packages",
    "generator",
    "src",
    "generators",
    "orchestrator.ts",
  ].join("/");
  const mod = (await import(orchestratorModule)) as unknown as {
    GeneratorOrchestrator: OrchestratorCtor;
  };

  const orchestrator = new mod.GeneratorOrchestrator({
    stackOption: "tanstackjs-nestjs",
    projectName: opts.appName,
    projectVersion: "1.0.0",
    projectDescription: `${model.meta.name ?? opts.appName} — generated from EML`,
    outputDir: opts.outDir,
    port: opts.port ?? 3000,
    databaseType: opts.databaseType ?? "postgresql",
    includeRbac: opts.includeRbac ?? true,
    randomizeFieldOrder: false,
    aiNlAddon: "none",
    skipCliScaffold: true,
  });

  return orchestrator.generate(entities, relationships);
}
