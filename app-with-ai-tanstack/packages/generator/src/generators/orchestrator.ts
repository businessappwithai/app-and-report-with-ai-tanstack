/**
 * Generator Orchestrator
 *
 * Unified entry point for generating complete applications.
 * Coordinates between Dictionary Generator, Backend Generator,
 * and Frontend Generator for the selected stack option.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Entity, Relationship } from "@appwithai/core/types";
import { type DictionaryContext, DictionaryGenerator } from "./dictionary.generator";
import {
  FullStackGenerator,
  type FullStackGeneratorOptions,
  type StackOption,
} from "./full-stack.generator";

export interface OrchestratorOptions {
  stackOption: StackOption;
  projectName: string;
  projectVersion: string;
  projectDescription: string;
  outputDir: string;
  port: number;
  databaseType: "postgresql" | "mysql" | "sqlite";
  includeRbac: boolean;
  randomizeFieldOrder: boolean;
  aiNlAddon?: "none" | "basic" | "advanced";
  aiNlProvider?: "anthropic" | "openai";
  aiNlModel?: string;
  /** Skip network CLI scaffolding; generate purely from bundled templates. */
  skipCliScaffold?: boolean;
}

export interface GenerationResult {
  outputDir: string;
  stackOption: StackOption;
  entityCount: number;
  relationshipCount: number;
  generatedFiles: string[];
  dictionaryContext: DictionaryContext;
}

/**
 * Orchestrates the complete generation process.
 *
 * Flow:
 * 1. Parse entities and relationships (done externally)
 * 2. Generate Dictionary context (sys_ metadata)
 * 3. Generate full-stack application using selected stack
 * 4. Return generation results
 */
export class GeneratorOrchestrator {
  private options: OrchestratorOptions;
  private dictionaryGenerator: DictionaryGenerator;

  constructor(options: OrchestratorOptions) {
    this.options = options;
    this.dictionaryGenerator = new DictionaryGenerator({
      databaseType: options.databaseType,
      includeRbac: options.includeRbac,
      randomizeFieldOrder: options.randomizeFieldOrder,
    });
  }

  /**
   * Generate complete application from entities and relationships
   */
  async generate(entities: Entity[], relationships: Relationship[]): Promise<GenerationResult> {
    console.log(`\n🚀 Starting generation with ${this.getStackDescription()}...`);
    console.log(`   Project: ${this.options.projectName}`);
    console.log(`   Entities: ${entities.length}`);
    console.log(`   Relationships: ${relationships.length}`);
    console.log(`   Database: ${this.options.databaseType}`);

    // Step 1: Generate Dictionary Context
    console.log("\n📖 Generating Application Dictionary metadata...");
    const dictionaryContext = this.dictionaryGenerator.generateDictionaryContext(
      entities,
      relationships
    );
    console.log(`   sys_table entries: ${dictionaryContext.sysTables.length}`);
    console.log(`   sys_column entries: ${dictionaryContext.sysColumns.length}`);
    console.log(`   sys_field entries: ${dictionaryContext.sysFields.length}`);
    console.log(`   sys_window entries: ${dictionaryContext.sysWindows.length}`);

    // Step 2: Generate Full-Stack Application
    const fullStackOptions: FullStackGeneratorOptions = {
      stackOption: this.options.stackOption,
      projectName: this.options.projectName,
      projectVersion: this.options.projectVersion,
      projectDescription: this.options.projectDescription,
      outputDir: this.options.outputDir,
      port: this.options.port,
      aiNlAddon: this.options.aiNlAddon,
      aiNlProvider: this.options.aiNlProvider,
      aiNlModel: this.options.aiNlModel,
      skipCliScaffold: this.options.skipCliScaffold,
    };

    const fullStackGenerator = new FullStackGenerator(fullStackOptions);
    await fullStackGenerator.generate(entities, relationships);

    // Step 3: Collect generated files
    const generatedFiles = await this.collectGeneratedFiles(this.options.outputDir);

    const result: GenerationResult = {
      outputDir: this.options.outputDir,
      stackOption: this.options.stackOption,
      entityCount: entities.length,
      relationshipCount: relationships.length,
      generatedFiles,
      dictionaryContext,
    };

    console.log(`\n✅ Generation complete!`);
    console.log(`   Total files generated: ${generatedFiles.length}`);

    return result;
  }

  /**
   * Generate only the dictionary context (useful for testing)
   */
  generateDictionary(entities: Entity[], relationships: Relationship[]): DictionaryContext {
    return this.dictionaryGenerator.generateDictionaryContext(entities, relationships);
  }

  /**
   * Get available stack options
   */
  static getAvailableStacks(): Array<{ value: StackOption; label: string; description: string }> {
    return [
      {
        value: "tanstackjs-nestjs",
        label: "Modern Web Stack",
        description: "TanStack Start + Shadcn UI + TanStack | NestJS + Fastify + Kysely",
      },
    ];
  }

  private getStackDescription(): string {
    return "Modern Web Stack (TanStack Start + NestJS)";
  }

  private async collectGeneratedFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const subFiles = await this.collectGeneratedFiles(fullPath);
          files.push(...subFiles);
        } else {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory may not exist yet
    }
    return files;
  }
}
