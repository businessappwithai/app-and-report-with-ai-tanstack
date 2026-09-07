#!/usr/bin/env bun
/**
 * Give the generator a model to start from.
 *
 * A fresh container has an empty database and therefore nothing to design
 * against — you sign in and are looking at an empty project list. This seeds one
 * project from whichever source was configured, so the container comes up ready
 * to generate.
 *
 * Two sources, in precedence order:
 *
 *   --file <path>       an EML `.mmd` document           (SEED_MODEL)
 *   --from-database <s> a Postgres connection string     (SEED_DATABASE_URL)
 *
 * The second reads an existing schema — a Neon or RDS database that already has
 * the tables — and describes it as EML. Either way the result is a project whose
 * current ERD version is that document, which is exactly what the design and
 * generate steps expect.
 *
 * Re-running is safe: a project of the same name is updated in place and gains a
 * new ERD version rather than being duplicated. That matters because container
 * restarts run this again.
 *
 * Usage:
 *   bun scripts/seed-model.ts --file examples/drug-discovery.eml.mmd
 *   bun scripts/seed-model.ts --from-database "$NEON_URL" --name inventory
 */

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { getDatabase, introspectDatabase, runMigrations } from "@appwithai/core/services";
import { hashPassword } from "../packages/web/src/lib/password";

interface Options {
  file?: string;
  fromDatabase?: string;
  name?: string;
  ownerEmail: string;
  ownerPassword: string;
}

function parseArgs(argv: string[]): Options {
  const value = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };

  /**
   * First non-empty candidate.
   *
   * Empty has to count as absent. Compose passes an unset variable through as
   * an empty string, and `??` treats that as a real value — which produced a
   * project named "" rather than one named after the model file.
   */
  const first = (...candidates: (string | undefined)[]): string | undefined =>
    candidates.find((candidate) => candidate !== undefined && candidate.trim() !== "");

  return {
    file: first(value("--file"), process.env.SEED_MODEL),
    fromDatabase: first(value("--from-database"), process.env.SEED_DATABASE_URL),
    name: first(value("--name"), process.env.SEED_PROJECT_NAME),
    ownerEmail: first(value("--owner"), process.env.SEED_OWNER_EMAIL) ?? "admin@appwithai.local",
    ownerPassword: first(process.env.SEED_OWNER_PASSWORD) ?? "appwithai",
  };
}

/** `drug-discovery.eml.mmd` → `drug-discovery`. */
function projectNameFrom(path: string): string {
  return basename(path).replace(/\.eml\.mmd$|\.mmd$|\.mermaid$/i, "");
}

/**
 * The account that owns the seeded project.
 *
 * Projects are filtered by owner, so a project with no owner is invisible to
 * every signed-in user — seeding one without an account to attach it to would
 * produce a container that looks empty.
 */
async function ensureOwner(email: string, password: string): Promise<string> {
  const db = getDatabase();

  const existing = await db
    .selectFrom("auth_users" as never)
    .selectAll()
    .where("email" as never, "=", email)
    .executeTakeFirst();

  if (existing) return (existing as { id: string }).id;

  const id = `user_${randomUUID()}`;
  await db
    .insertInto("auth_users" as never)
    .values({
      id,
      email,
      name: "Administrator",
      passwordHash: await hashPassword(password),
      emailVerified: true,
      status: "approved",
      role: "admin",
    } as never)
    .execute();

  console.log(`  created owner ${email}`);
  return id;
}

/** The EML to seed, and a name for the project that will hold it. */
async function resolveModel(options: Options): Promise<{ eml: string; name: string }> {
  if (options.file) {
    const eml = await readFile(options.file, "utf8");
    if (!eml.trim()) throw new Error(`${options.file} is empty`);
    console.log(`  model from ${options.file} (${eml.split("\n").length} lines)`);
    return { eml, name: options.name ?? projectNameFrom(options.file) };
  }

  if (options.fromDatabase) {
    console.log("  reading the schema of the configured database…");
    const schema = await introspectDatabase({ connectionString: options.fromDatabase });
    if (schema.tableCount === 0) {
      throw new Error("that database has no tables in its public schema — nothing to model");
    }
    console.log(
      `  model from database: ${schema.tableCount} entities, ` +
        `${schema.relationshipCount} relationships`
    );
    return { eml: schema.eml, name: options.name ?? "imported-schema" };
  }

  throw new Error(
    "nothing to seed — pass --file <model.mmd> or --from-database <connection string> " +
      "(or set SEED_MODEL / SEED_DATABASE_URL)"
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  console.log("Seeding the generator's starting model…");
  await runMigrations();

  const { eml, name } = await resolveModel(options);
  const ownerId = await ensureOwner(options.ownerEmail, options.ownerPassword);

  const db = getDatabase();
  const now = new Date().toISOString();

  const existing = await db
    .selectFrom("projects")
    .selectAll()
    .where("name", "=", name)
    .where("is_deleted", "=", false)
    .executeTakeFirst();

  let projectId: string;
  if (existing) {
    projectId = (existing as { id: string }).id;
    await db
      .updateTable("projects")
      .set({ updated_at: now, owner_user_id: ownerId } as never)
      .where("id", "=", projectId)
      .execute();
    console.log(`  reusing project ${name} (${projectId})`);
  } else {
    projectId = `proj_${randomUUID()}`;
    await db
      .insertInto("projects")
      .values({
        id: projectId,
        name,
        description: options.fromDatabase
          ? "Imported from an existing database"
          : "Imported from a model file",
        icon: "🧬",
        icon_color: "#3b82f6",
        status: "draft",
        is_deleted: false,
        stack_type: "tanstackjs-nestjs",
        stack_version: "latest",
        port: 4001,
        database_type: "postgresql",
        environment_variables: JSON.stringify({}),
        owner_user_id: ownerId,
        created_at: now,
        updated_at: now,
      } as never)
      .execute();
    console.log(`  created project ${name} (${projectId})`);
  }

  // Counts come from the parser rather than a regex over the text, so a
  // document the generator would reject fails here instead of at generate time.
  const { parseModel } = await import("@appwithai/generator");
  const model = parseModel(eml);

  const { erdVersionDb } = await import("@appwithai/core/services");
  await erdVersionDb.createVersion({
    project_id: projectId,
    mermaid_code: eml,
    is_current: true,
    description: options.fromDatabase ? "Reverse-engineered schema" : "Seeded model",
    entity_count: model.entities.length,
    relationship_count: model.relationships.length,
    import_source: options.fromDatabase ? "database" : "file",
  });

  console.log(
    `✓ seeded ${model.entities.length} entities and ` +
      `${model.relationships.length} relationships into "${name}"`
  );
  console.log(`  sign in as ${options.ownerEmail}`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
