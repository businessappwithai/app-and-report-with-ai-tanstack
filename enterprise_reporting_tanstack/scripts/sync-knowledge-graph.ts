/**
 * Bootstrap Apache AGE knowledge graph and sync all schema/config data.
 *
 * Run with: bun scripts/sync-knowledge-graph.ts
 */

import { initGraph } from "@/lib/graph/graph-init";
import { syncKnowledgeGraph } from "@/lib/graph/sync";
import { cypher, cypherWrite, GRAPH_NAME } from "@/lib/graph/client";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

async function importLLMText(): Promise<void> {
  const llmtextPath = join(import.meta.dir, "../llmtext/llms-full.txt");
  if (!existsSync(llmtextPath)) {
    console.warn("[llmtext] llmtext file not found, skipping");
    return;
  }

  const content = readFileSync(llmtextPath, "utf-8");

  // Split into sections by ## headings
  const sections: { id: string; title: string; body: string }[] = [];
  const sectionRe = /^#{1,3}\s+(.+)$/gm;
  let lastIndex = 0;
  let lastTitle: string | null = null;
  let sectionIdx = 0;

  for (const match of content.matchAll(sectionRe)) {
    if (lastTitle !== null && match.index !== undefined && match.index > lastIndex) {
      const body = content.slice(lastIndex, match.index).trim();
      if (body.length > 20) {
        sections.push({
          id: `s${sectionIdx}`,
          title: lastTitle,
          body: body.slice(0, 3000),
        });
        sectionIdx++;
      }
    }
    lastTitle = match[1].trim();
    lastIndex = (match.index ?? 0) + match[0].length;
  }
  if (lastTitle) {
    const body = content.slice(lastIndex).trim();
    if (body.length > 20) {
      sections.push({ id: `s${sectionIdx}`, title: lastTitle, body: body.slice(0, 3000) });
    }
  }

  if (sections.length === 0) {
    sections.push({ id: "full", title: "Enterprise Reporting Platform — Full LLM Text", body: content.slice(0, 4000) });
  }

  console.log(`[llmtext] Importing ${sections.length} section(s) into knowledge graph…`);

  for (const sec of sections) {
    await cypherWrite(
      `MERGE (n:LLMKnowledge {section_id: $id})
       SET n.title = $title, n.body = $body, n.source = 'llmtext'`,
      { id: sec.id, title: sec.title, body: sec.body },
    );
  }

  console.log("[llmtext] LLMKnowledge nodes upserted.");
}

async function main() {
  console.log("=== Knowledge Graph Bootstrap ===");
  console.log(`Graph database: ${process.env.GRAPH_DATABASE_URL ?? "(default)"}`);

  try {
    await initGraph();
    console.log("[✓] Graph initialized");
  } catch (err) {
    console.error("[✗] Graph init failed:", err);
    process.exit(1);
  }

  try {
    await syncKnowledgeGraph();
    console.log("[✓] Schema + config synced");
  } catch (err) {
    console.error("[✗] Schema sync failed:", err);
  }

  try {
    await importLLMText();
    console.log("[✓] LLMText imported");
  } catch (err) {
    console.error("[✗] LLMText import failed:", err);
  }

  // Print summary
  try {
    const dsCount = await cypher(`MATCH (n:DataSource) RETURN count(n) AS c`, {}, ["c"]);
    const tableCount = await cypher(`MATCH (n:Table) RETURN count(n) AS c`, {}, ["c"]);
    const colCount = await cypher(`MATCH (n:Column) RETURN count(n) AS c`, {}, ["c"]);
    const docCount = await cypher(`MATCH (n:LLMKnowledge) RETURN count(n) AS c`, {}, ["c"]);

    const parse = (rows: { c?: unknown }[]) => {
      const raw = rows[0]?.c;
      if (typeof raw === "string") {
        try { return JSON.parse(raw); } catch { return raw; }
      }
      return raw ?? 0;
    };

    console.log("\n=== Knowledge Graph Summary ===");
    console.log(`  DataSource nodes : ${parse(dsCount as never)}`);
    console.log(`  Table nodes      : ${parse(tableCount as never)}`);
    console.log(`  Column nodes     : ${parse(colCount as never)}`);
    console.log(`  LLMKnowledge docs: ${parse(docCount as never)}`);
    console.log(`  Graph name       : ${GRAPH_NAME}`);
  } catch (err) {
    console.warn("[summary] Could not fetch counts:", err);
  }

  process.exit(0);
}

main();
