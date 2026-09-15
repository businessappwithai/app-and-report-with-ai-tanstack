#!/usr/bin/env bun
/**
 * Derive a reporting pack from an EML model.
 *
 *   bun build/reporting-pack.ts -i <model.eml.mmd> -o <pack.json> --database <db>
 *
 * The reporting platform stores reports, charts and dashboards as definitions
 * over saved SQL queries, and holds roles deciding which of a data source's
 * tables a reporting user may read. A pack is exactly those definitions, so a
 * generated application arrives with a reporting layer built for *its* entities
 * rather than an empty workspace and a SQL editor.
 *
 * ## This file no longer derives anything
 *
 * It used to, in about eight hundred lines. The derivation now lives in
 * `app-with-ai-tanstack`'s generator —
 * `packages/generator/src/reporting/pack.ts` — and this is a CLI over it.
 *
 * That is a move rather than a rewrite, and the reason is that the pack
 * acquired two more readers. The generated application's own browser build
 * serves the same reports behind its own sign-in, and the full-stack project it
 * writes ships the pack in a `reporting/` directory for the platform its
 * compose file starts. Three derivations would be three answers to "what
 * reports does this model have", and the first time any of them changed the
 * products would disagree about a model in front of a reader.
 *
 * Reaching across the repository boundary is what this repository already does
 * for `compileRbac`, `deriveAccess` and `compileWorkflows` — for the same
 * reason and through the same checkout. The direction of the dependency is the
 * point: the generator writes the applications, so the generator owns what a
 * model means.
 *
 * What stayed here is what belongs to *this* repository: the CLI, the
 * diagnostics gate, and `docker compose`'s idea of where a pack goes.
 *
 * Every derived query is still traceable to something the model declares — an
 * entity earns a register, an `%%enum` a breakdown, `created_at` a volume line,
 * a `kind: state` workflow a lifecycle, numeric columns a measures report, a
 * `oneToMany` children-per-parent, and a `%%report` the question its author
 * wrote. See the module named above; `scripts/check-reporting-pack.ts` is what
 * runs the result against a real PostgreSQL.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseModel } from "../../app-with-ai-tanstack/packages/generator/src/pipeline/parse-model.ts";
import {
  buildReportingPack,
  type ReportingPack,
} from "../../app-with-ai-tanstack/packages/generator/src/reporting/pack.ts";
import { parseEml } from "../language/cli/src/parser.ts";

export type {
  AccessRoleSpec,
  AccessSpec,
  ChartSpec,
  DashboardSpec,
  DashboardWidgetSpec,
  ReportingPack,
  ReportSpec,
  SavedQuerySpec,
} from "../../app-with-ai-tanstack/packages/generator/src/reporting/pack.ts";

/**
 * Build a pack for one model.
 *
 * @param source       the model document
 * @param modelPath    where it came from, recorded in the pack
 * @param databaseName the database its queries will run against
 * @param projectName  the name the application was generated under —
 *   `appwithai generate -n`, and **not** `%%meta name:`. `start.sh` passes the
 *   model file's basename, so `crm.eml.mmd` generates an application whose
 *   seeded accounts are `sales.manager@crm.example.com`; deriving them from
 *   `%%meta name:` instead produced `sales.manager@enterprise-crm.example.com`,
 *   addresses belonging to no account anywhere and printed on the front door as
 *   the way in. Defaults to the basename so a caller that omits it agrees with
 *   `start.sh` anyway.
 */
export function buildPack(
  source: string,
  modelPath: string,
  databaseName: string,
  projectName?: string
): ReportingPack {
  /*
   * The diagnostics gate stays on this repository's own parser.
   *
   * It is the checker this repository ships and the one `check:models` runs, so
   * a model that fails here is a model this repository already calls broken.
   * The generator's parser is then used for the derivation itself — it is the
   * reading the generated application is built from, and the pack has to match
   * that rather than a second opinion about the same document.
   */
  const reviewed = parseEml(source);
  const errors = reviewed.diagnostics.filter((d) => d.severity === "error");
  if (errors.length > 0) {
    throw new Error(
      `Model has ${errors.length} error(s); run the checker first:\n` +
        errors.map((d) => `  ${d.code} ${d.message}`).join("\n")
    );
  }
  if (reviewed.entities.length === 0) throw new Error("Model declares no entities.");

  const basename = path.basename(modelPath).replace(/\.eml\.mmd$|\.mmd$/, "");
  const model = parseModel(source);

  return buildReportingPack(model, {
    projectName: projectName ?? basename,
    // What the reports are *called* after, which `%%meta name:` is for. The
    // accounts above stay on the generate-time name; only the titles move.
    applicationName: reviewed.meta.name ?? basename,
    projectDescription: reviewed.meta.description,
    databaseName,
    modelFileName: path.basename(modelPath),
    // Recorded here and nowhere else. The generator omits it so that its own
    // output can be compared byte for byte; a pack written by this CLI is a
    // build artefact and saying when it was built costs nothing.
    generatedAt: new Date().toISOString(),
  });
}

function main(): number {
  const argv = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const input = flag("-i") ?? flag("--input");
  const output = flag("-o") ?? flag("--output") ?? "reporting-pack.json";
  const database = flag("--database") ?? "appdb";
  const appName = flag("--app-name");

  if (!input) {
    console.error(
      "usage: reporting-pack.ts -i <model.eml.mmd> [-o pack.json] [--database name] [--app-name name]"
    );
    return 2;
  }
  if (!existsSync(input)) {
    console.error(`Model not found: ${input}`);
    return 2;
  }

  const pack = buildPack(readFileSync(input, "utf8"), input, database, appName);
  mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  writeFileSync(output, `${JSON.stringify(pack, null, 2)}\n`);

  console.log(`  ${pack.application.name}`);
  console.log(
    `  ${pack.queries.length} queries · ${pack.reports.length} reports · ${pack.charts.length} charts · ${pack.dashboards.length} dashboard(s)`
  );
  console.log(
    `  ${pack.access.roles.length} reporting role(s)${pack.access.scoped ? ", scoped to what each may read" : ""}`
  );
  console.log(`  → ${output}`);
  return 0;
}

if (import.meta.main) process.exit(main());
