#!/usr/bin/env node
import { promises as fs } from "node:fs";
import { Command } from "commander";
import { AIToMermaidConverter } from "../converter";

const program = new Command();

program
  .name("appwithai-convert")
  .description("Convert natural language to Mermaid ERD")
  .version("5.1.0")
  .argument("[description]", "Domain description")
  .option("-i, --input <file>", "Input file with description")
  .option("-o, --output <file>", "Output Mermaid file", "output.mermaid")
  .option("--fast", "Use fast programmatic generation (no AI for Mermaid)")
  .option("--analyze-only", "Only analyze, don't generate Mermaid")
  .option("--json", "Output JSON instead of Mermaid")
  .action(async (description, options) => {
    console.log("🤖 APPWITHAI Natural Language Converter");
    console.log("======================================");

    // Get description
    let desc = description;
    if (options.input) {
      desc = await fs.readFile(options.input, "utf-8");
    }

    if (!desc) {
      console.error("❌ Error: No description provided");
      console.log('Usage: appwithai-convert "your description" -o output.mermaid');
      process.exit(1);
    }

    console.log(`\n📝 Description: ${desc.slice(0, 100)}...`);
    console.log("🔄 Analyzing...\n");

    const converter = new AIToMermaidConverter();

    if (options.analyzeOnly) {
      const analysis = await converter.analyzeOnly(desc);

      if (options.json) {
        console.log(JSON.stringify(analysis, null, 2));
      } else {
        console.log("✅ Analysis Complete");
        console.log(`\n📊 Entities: ${analysis.entities.length}`);
        analysis.entities.forEach((e) => {
          console.log(`  - ${e.name} (${e.confidence})`);
        });
        console.log(`\n🔗 Relationships: ${analysis.relationships.length}`);
        analysis.relationships.forEach((r) => {
          console.log(`  - ${r.source} -> ${r.target} (${r.cardinality})`);
        });
      }
    } else {
      const result = await converter.convert({
        description: desc,
        options: {
          skipApprovals: true,
          autoGenerateMermaid: true,
        },
      });

      if (!result.success) {
        console.error("❌ Error:", result.error);
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        const mermaidSyntax = result.mermaidSyntax ?? "";
        await fs.writeFile(options.output, mermaidSyntax);
        console.log(`✅ Mermaid ERD generated: ${options.output}`);
        console.log(`\n📊 ${result.domainAnalysis.entities.length} entities`);
        console.log(`🔗 ${result.domainAnalysis.relationships.length} relationships`);
      }
    }
  });

program.parse();
