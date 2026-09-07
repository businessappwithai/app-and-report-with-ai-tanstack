/**
 * Read an existing Postgres database and describe it as EML.
 *
 * This is the second way into the product. A model normally starts as a `.mmd`
 * someone wrote, but a team with a database already has the model — it is just
 * written in DDL. Pointing the generator at a connection string turns that into
 * an ERD it can work from, which is the whole of the "bring your own database"
 * path, including hosted providers like Neon.
 *
 * Only `public` is read, and only tables — views and materialised views have no
 * primary key to speak of and would generate services that cannot write.
 */

import pg from "pg";

export interface IntrospectOptions {
  /** Postgres connection string. TLS is negotiated for non-local hosts. */
  connectionString: string;
  /** Milliseconds to wait for the connection. Hosted databases can be slow to wake. */
  connectionTimeoutMillis?: number;
  /** Schema to read. Anything but `public` is unusual but legal. */
  schema?: string;
}

export interface IntrospectedSchema {
  /** The EML document — an `erDiagram` with one entity per table. */
  eml: string;
  tableCount: number;
  relationshipCount: number;
}

interface ColumnRow {
  column_name: string;
  data_type: string;
  is_nullable: string;
  constraint_type: string | null;
}

interface ForeignKeyRow {
  table_name: string;
  column_name: string;
  foreign_table_name: string;
}

/** Postgres type → EML type. Anything unrecognised is a string, which always works. */
function toEmlType(dataType: string): string {
  const type = dataType.toLowerCase();
  if (["integer", "int", "int4", "int2", "int8", "bigint", "smallint", "serial"].includes(type))
    return "int";
  if (
    ["numeric", "decimal", "float4", "float8", "real", "double precision", "money"].includes(type)
  )
    return "float";
  if (type === "date") return "date";
  if (type.startsWith("timestamp") || type.startsWith("time ")) return "datetime";
  if (type === "boolean" || type === "bool") return "boolean";
  if (type === "json" || type === "jsonb") return "json";
  if (type === "uuid") return "string";
  return "string";
}

/** `stability_test` → `StabilityTest`, the shape EML entity names take. */
function toPascalCase(name: string): string {
  return name.replace(/(^|_)([a-z0-9])/g, (_match, _sep, char: string) => char.toUpperCase());
}

/**
 * Local hosts do not get TLS; everything else does, without demanding a
 * verifiable chain. Mirrors the reasoning in `config/db.config.ts` — hosted
 * providers sign with roots that are not in every image's trust store.
 */
function sslFor(connectionString: string): pg.ClientConfig["ssl"] {
  try {
    const host = new URL(connectionString).hostname.toLowerCase();
    const local = ["localhost", "127.0.0.1", "::1", "0.0.0.0", "postgres", "db"];
    if (local.includes(host)) return undefined;
  } catch {
    return undefined;
  }
  return { rejectUnauthorized: false };
}

export async function introspectDatabase(options: IntrospectOptions): Promise<IntrospectedSchema> {
  const schema = options.schema ?? "public";
  const ssl = sslFor(options.connectionString);

  const client = new pg.Client({
    connectionString: options.connectionString,
    connectionTimeoutMillis: options.connectionTimeoutMillis ?? 30_000,
    ...(ssl ? { ssl } : {}),
  });

  await client.connect();

  try {
    const tables = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [schema]
    );

    if (tables.rows.length === 0) {
      return { eml: "erDiagram\n", tableCount: 0, relationshipCount: 0 };
    }

    // Every foreign key in one query rather than one per table: the
    // relationships are what make the ERD a model rather than a column list,
    // and a per-table round trip against a hosted database is slow enough to
    // matter once there are a few dozen of them.
    const foreignKeys = await client.query<ForeignKeyRow>(
      `SELECT tc.table_name,
              kcu.column_name,
              ccu.table_name AS foreign_table_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name
        AND kcu.table_schema = tc.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1
       ORDER BY tc.table_name, kcu.column_name`,
      [schema]
    );

    const lines: string[] = ["erDiagram"];

    for (const { table_name } of tables.rows) {
      const columns = await client.query<ColumnRow>(
        `SELECT c.column_name, c.data_type, c.is_nullable, tc.constraint_type
         FROM information_schema.columns c
         LEFT JOIN information_schema.key_column_usage kcu
           ON kcu.table_schema = $1
          AND kcu.table_name = c.table_name
          AND kcu.column_name = c.column_name
         LEFT JOIN information_schema.table_constraints tc
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = $1
         WHERE c.table_schema = $1 AND c.table_name = $2
         ORDER BY c.ordinal_position`,
        [schema, table_name]
      );

      lines.push(`  ${toPascalCase(table_name)} {`);
      for (const column of columns.rows) {
        const key =
          column.constraint_type === "PRIMARY KEY"
            ? " PK"
            : column.constraint_type === "FOREIGN KEY"
              ? " FK"
              : "";
        // A nullable column is optional; a primary key never is, whatever
        // information_schema says about it.
        const optional = column.is_nullable === "YES" && !key.includes("PK") ? " OPTIONAL" : "";
        lines.push(`    ${toEmlType(column.data_type)} ${column.column_name}${key}${optional}`);
      }
      lines.push("  }");
    }

    const known = new Set(tables.rows.map((row) => row.table_name));
    let relationshipCount = 0;
    for (const fk of foreignKeys.rows) {
      // A key pointing outside the schema we read would name an entity the
      // document never declares, which the parser rejects.
      if (!known.has(fk.table_name) || !known.has(fk.foreign_table_name)) continue;
      if (fk.table_name === fk.foreign_table_name) continue;

      const parent = toPascalCase(fk.foreign_table_name);
      const child = toPascalCase(fk.table_name);
      lines.push(`  ${parent} ||--o{ ${child} : "${fk.column_name}"`);
      relationshipCount += 1;
    }

    return {
      eml: `${lines.join("\n")}\n`,
      tableCount: tables.rows.length,
      relationshipCount,
    };
  } finally {
    await client.end();
  }
}
