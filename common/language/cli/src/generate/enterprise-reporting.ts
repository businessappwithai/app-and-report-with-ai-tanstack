/**
 * Enterprise Reporting stack generation target.
 *
 * Generates TanStack Start + Kysely + PostgreSQL application code from an EML
 * model, following the conventions of `enterprise_reporting_tanstack`:
 *
 *   src/server-fns/<entity>.ts            createServerFn with .inputValidator()
 *   src/routes/_authed/<entity>/index.tsx list page (TanStack Table + shadcn/ui)
 *   src/routes/_authed/<entity>/$id.tsx   detail/edit page (shadcn/ui form)
 *   src/lib/db/migrations/<ts>_create.ts  Kysely migration (PostgreSQL DDL)
 *   KYSELY_TYPES.md                       snippet for kysely-db.ts Database interface
 *
 * Three conventions of that repository are load-bearing, and the generator
 * exists largely to get them right every time:
 *
 *   1. `.inputValidator()`, never `.validator()`. The TanStack Start v1 Vite
 *      plugin preserves unknown method names verbatim in the client bundle, so
 *      `.validator()` compiles and then crashes at runtime.
 *   2. A client call passes `{ data: input }` whenever the server function
 *      declares an input validator.
 *   3. The config database is **PostgreSQL only** — there is no MariaDB or
 *      SQLite in the running system, whatever `docs/` still says. DDL is
 *      emitted for Postgres, and identifiers are double-quoted, not backticked.
 *
 * Route links carry no `_authed` segment: `_authed` is a pathless layout route,
 * so its children are addressed as `/reports/$id`, while `createFileRoute` is
 * still keyed by the file path `/_authed/reports/$id`.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { EmlAttribute, EmlEntity, EmlIndex, EmlModel } from "../model.ts";
import { kebabCase, plural, toSnakeCase } from "../util.ts";

export interface EnterpriseReportingOptions {
  outDir: string;
  appName: string;
}

// --- Naming helpers -----------------------------------------------------------

/** snake_case plural table name, e.g. "ReportItem" → "report_items" */
function tbl(e: EmlEntity): string {
  return e.tableName || plural(toSnakeCase(e.name));
}

/** kebab-case URL segment, e.g. "report_items" → "report-items" */
function slug(e: EmlEntity): string {
  return kebabCase(tbl(e));
}

/** Human-readable label for a field name */
function toLabel(name: string): string {
  return name.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- Type mapping -------------------------------------------------------------

function tsType(attr: EmlAttribute): string {
  switch (attr.type) {
    case "integer":
    case "decimal":
      return "number";
    case "boolean":
      return "boolean";
    case "date":
    case "datetime":
      return "Date";
    case "json":
      return "Record<string, unknown>";
    default:
      return "string";
  }
}

/**
 * PostgreSQL column type. The config database is Postgres — `TINYINT(1)`,
 * `DATETIME` and `JSON` are MariaDB spellings and none of them parse here.
 */
function ddlType(attr: EmlAttribute): string {
  // A foreign key has to be the type of the key it points at, and every primary
  // key this generator emits is a UUID. Left as VARCHAR(255) the column takes
  // the value fine and then refuses the ALTER TABLE ... ADD FOREIGN KEY.
  if (attr.isForeignKey) return "UUID";
  switch (attr.type) {
    case "integer":
      return "INTEGER";
    case "decimal":
      return "NUMERIC(10,2)";
    case "boolean":
      return "BOOLEAN";
    case "date":
      return "DATE";
    case "datetime":
      return "TIMESTAMPTZ";
    case "text":
      return "TEXT";
    case "json":
      return "JSONB";
    default:
      return attr.maxLength ? `VARCHAR(${attr.maxLength})` : "VARCHAR(255)";
  }
}

// --- Main entry point ---------------------------------------------------------

export function generateEnterpriseReporting(
  model: EmlModel,
  opts: EnterpriseReportingOptions
): string[] {
  const written: string[] = [];
  const { outDir } = opts;

  for (const e of model.entities) {
    const routeDir = path.join(outDir, `src/routes/_authed/${slug(e)}`);
    mkdirSync(path.join(outDir, "src/server-fns"), { recursive: true });
    mkdirSync(routeDir, { recursive: true });

    const sfFile = `src/server-fns/${toSnakeCase(e.name)}.ts`;
    writeFileSync(path.join(outDir, sfFile), serverFnsFile(e, model));
    written.push(sfFile);

    const listFile = `src/routes/_authed/${slug(e)}/index.tsx`;
    writeFileSync(path.join(outDir, listFile), listPageFile(e));
    written.push(listFile);

    const detailFile = `src/routes/_authed/${slug(e)}/$id.tsx`;
    writeFileSync(path.join(outDir, detailFile), detailPageFile(e));
    written.push(detailFile);
  }

  const migDir = path.join(outDir, "src/lib/db/migrations");
  mkdirSync(migDir, { recursive: true });
  const migFile = `src/lib/db/migrations/${Date.now()}_create_tables.ts`;
  writeFileSync(path.join(outDir, migFile), migrationFile(model));
  written.push(migFile);

  writeFileSync(path.join(outDir, "KYSELY_TYPES.md"), kyselyTypesFile(model));
  written.push("KYSELY_TYPES.md");

  writeFileSync(path.join(outDir, "README.md"), readmeFile(model, opts));
  written.push("README.md");

  return written;
}

// --- Server functions ---------------------------------------------------------

function serverFnsFile(e: EmlEntity, model: EmlModel): string {
  const Type = e.name;
  const tableName = tbl(e);
  const pk = e.primaryKey || "id";
  const editable = e.attributes.filter((a) => !a.isPrimaryKey);
  const enumMap = Object.fromEntries(model.enums.map((en) => [en.name, en.values]));

  const zodFields = editable
    .map((a) => {
      const enumRef = a.enumRef ? enumMap[a.enumRef] : undefined;
      let zodExpr: string;
      if (enumRef) {
        const vals = enumRef.map((v) => `"${v}"`).join(", ");
        zodExpr = `z.enum([${vals}])`;
      } else {
        switch (a.type) {
          case "integer":
            zodExpr = "z.number().int()";
            break;
          case "decimal":
            zodExpr = "z.number()";
            break;
          case "boolean":
            zodExpr = "z.boolean()";
            break;
          default:
            zodExpr = a.maxLength ? `z.string().max(${a.maxLength})` : "z.string()";
        }
      }
      if (!a.required) zodExpr += ".optional()";
      return `  ${a.name}: ${zodExpr},`;
    })
    .join("\n");

  return `import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/middleware";
import { getDb } from "@/lib/db/config";

// --------------- Types --------------------------------------------------------

export type ${Type} = {
  ${pk}: string;
${editable.map((a) => `  ${a.name}${a.required ? "" : "?"}: ${tsType(a)} | null;`).join("\n")}
  created_at: Date;
  updated_at: Date;
};

const ${Type}InputSchema = z.object({
${zodFields}
});

type ${Type}Input = z.infer<typeof ${Type}InputSchema>;

// --------------- Server functions --------------------------------------------
//
// Every list is paginated at the database. Server-side pagination is mandatory
// in this codebase: never select a whole table and slice it on the client.

export const list${Type}sFn = createServerFn({ method: "GET" })
  .inputValidator((input: { page?: number; pageSize?: number }) => input)
  .handler(async ({ data }) => {
    await requireAuth();
    const page = data.page ?? 0;
    const pageSize = Math.min(data.pageSize ?? 50, 1000);
    const [items, countRow] = await Promise.all([
      getDb()
        .selectFrom("${tableName}")
        .selectAll()
        .orderBy("created_at", "desc")
        .limit(pageSize)
        .offset(page * pageSize)
        .execute(),
      getDb()
        .selectFrom("${tableName}")
        .select((eb) => eb.fn.countAll().as("count"))
        .executeTakeFirstOrThrow(),
    ]);
    return { items, total: Number(countRow.count), page, pageSize };
  });

export const get${Type}Fn = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data: { id } }) => {
    await requireAuth();
    return getDb()
      .selectFrom("${tableName}")
      .selectAll()
      .where("${pk}", "=", id)
      .executeTakeFirstOrThrow();
  });

export const create${Type}Fn = createServerFn({ method: "POST" })
  .inputValidator((input: ${Type}Input) => ${Type}InputSchema.parse(input))
  .handler(async ({ data }) => {
    await requireAuth();
    const id = crypto.randomUUID();
    await getDb()
      .insertInto("${tableName}")
      .values({ ${pk}: id, ...data })
      .execute();
    return { id };
  });

export const update${Type}Fn = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string } & Partial<${Type}Input>) => input)
  .handler(async ({ data: { id, ...rest } }) => {
    await requireAuth();
    // Postgres has no ON UPDATE CURRENT_TIMESTAMP; the write sets it.
    await getDb()
      .updateTable("${tableName}")
      .set({ ...rest, updated_at: new Date() } as Record<string, unknown>)
      .where("${pk}", "=", id)
      .execute();
    return { id };
  });

export const delete${Type}Fn = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data: { id } }) => {
    await requireAuth();
    await getDb().deleteFrom("${tableName}").where("${pk}", "=", id).execute();
    return { id };
  });
`;
}

// --- List page ----------------------------------------------------------------

function listPageFile(e: EmlEntity): string {
  const Type = e.name;
  const tableName = tbl(e);
  const routePath = slug(e);
  const sfModule = toSnakeCase(e.name);
  const pluralLabel = plural(toLabel(e.name));
  const pk = e.primaryKey || "id";
  const displayCols = e.attributes.filter((a) => !a.isPrimaryKey).slice(0, 4);

  const headCells = displayCols
    .map((a) => `                <TableHead>${toLabel(a.name)}</TableHead>`)
    .join("\n");

  const bodyCells = displayCols
    .map((a) => `                    <TableCell>{String(row.${a.name} ?? "")}</TableCell>`)
    .join("\n");

  return `import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { list${Type}sFn } from "@/server-fns/${sfModule}";

export const Route = createFileRoute("/_authed/${routePath}/")({
  component: ${Type}ListPage,
});

function ${Type}ListPage() {
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["${tableName}", page],
    queryFn: () => list${Type}sFn({ data: { page, pageSize } }),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">${pluralLabel}</h1>
        <Button asChild>
          <Link to="/${routePath}/$id" params={{ id: "new" }}>
            New ${toLabel(e.name)}
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
${headCells}
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={${displayCols.length + 1}} className="py-10 text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : data?.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={${displayCols.length + 1}} className="py-10 text-center text-muted-foreground">
                    No ${pluralLabel.toLowerCase()} yet.
                  </TableCell>
                </TableRow>
              ) : (
                data?.items.map((row) => (
                  <TableRow key={row.${pk}}>
${bodyCells}
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to="/${routePath}/$id" params={{ id: row.${pk} }}>
                          Edit
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
`;
}

// --- Detail page --------------------------------------------------------------

function detailPageFile(e: EmlEntity): string {
  const Type = e.name;
  const tableName = tbl(e);
  const routePath = slug(e);
  const sfModule = toSnakeCase(e.name);
  const editableAttrs = e.attributes.filter((a) => !a.isPrimaryKey);

  const formFields = editableAttrs
    .map(
      (a) => `          <div className="space-y-1">
            <Label htmlFor="${a.name}">${toLabel(a.name)}${a.required ? "" : " (optional)"}</Label>
            <Input
              id="${a.name}"
              value={form.${a.name} ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, ${a.name}: e.target.value }))}
              ${a.required ? "required" : ""}
            />
          </div>`
    )
    .join("\n");

  return `import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  create${Type}Fn,
  delete${Type}Fn,
  get${Type}Fn,
  update${Type}Fn,
} from "@/server-fns/${sfModule}";

export const Route = createFileRoute("/_authed/${routePath}/$id")({
  component: ${Type}DetailPage,
});

function ${Type}DetailPage() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["${tableName}", id],
    queryFn: () => get${Type}Fn({ data: { id } }),
    enabled: !isNew,
  });

  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data) {
      setForm(
        Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, v == null ? "" : String(v)])
        )
      );
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      isNew
        ? create${Type}Fn({ data: form as never })
        : update${Type}Fn({ data: { id, ...form } as never }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["${tableName}"] });
      navigate({ to: "/${routePath}" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => delete${Type}Fn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["${tableName}"] });
      navigate({ to: "/${routePath}" });
    },
  });

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">
        {isNew ? "New ${toLabel(e.name)}" : "Edit ${toLabel(e.name)}"}
      </h1>

      <Card>
        <CardContent className="space-y-4 pt-6">
${formFields}

          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/${routePath}" })}>
              Cancel
            </Button>
            {!isNew && (
              <Button
                variant="destructive"
                className="ml-auto"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                Delete
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
`;
}

// --- Migration ----------------------------------------------------------------

function migrationFile(model: EmlModel): string {
  const stmts = model.entities.map((e) => {
    const tableName = tbl(e);
    const pk = e.primaryKey || "id";
    const nonPk = e.attributes.filter((a) => !a.isPrimaryKey);

    const cols = [
      `  "${pk}" UUID PRIMARY KEY DEFAULT gen_random_uuid()`,
      ...nonPk.map((a) => {
        const notNull = a.required ? " NOT NULL" : " NULL";
        const uq = a.unique ? " UNIQUE" : "";
        const def = a.type === "boolean" ? " DEFAULT FALSE" : "";
        return `  "${a.name}" ${ddlType(a)}${notNull}${uq}${def}`;
      }),
      '  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()',
      '  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()',
    ];

    const extraIndexes = model.indexes
      .filter((idx: EmlIndex) => idx.entity === e.name)
      .map(
        (idx: EmlIndex) =>
          `  await db.schema\n    .createIndex("idx_${tableName}_${idx.columns.join("_")}")\n    .on("${tableName}")\n    .columns([${idx.columns.map((c) => `"${c}"`).join(", ")}])\n    .ifNotExists()\n    .execute();`
      );

    return {
      tableName,
      ddl: `CREATE TABLE IF NOT EXISTS "${tableName}" (\n${cols.join(",\n")}\n);`,
      extraIndexes,
    };
  });

  return `import { type Kysely, sql } from "kysely";

// PostgreSQL DDL. gen_random_uuid() is built in from Postgres 13 on; on an
// older server enable it with CREATE EXTENSION IF NOT EXISTS pgcrypto.

export async function up(db: Kysely<never>): Promise<void> {
${stmts
  .map(
    (s) =>
      `  await sql\`${s.ddl}\`.execute(db);` +
      (s.extraIndexes.length ? `\n${s.extraIndexes.join("\n")}` : "")
  )
  .join("\n\n")}
}

export async function down(db: Kysely<never>): Promise<void> {
${model.entities.map((e) => `  await db.schema.dropTable("${tbl(e)}").ifExists().execute();`).join("\n")}
}
`;
}

// --- Kysely Database interface snippet ----------------------------------------

function kyselyTypesFile(model: EmlModel): string {
  const blocks = model.entities.map((e) => {
    const tableName = tbl(e);
    const pk = e.primaryKey || "id";
    const rest = e.attributes.filter((a) => !a.isPrimaryKey);

    return `  /** ${e.label ?? e.name} */
  ${tableName}: {
    ${pk}: Generated<string>;
${rest.map((a) => `    ${a.name}${a.required ? "" : "?"}: ${tsType(a)} | null;`).join("\n")}
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
  };`;
  });

  return `# Kysely Database types — EML generated

Paste these entries into the \`Database\` interface in \`src/lib/db/kysely-db.ts\`.
That interface is the authoritative type for every config-database table: a table
added there must be added to \`bootstrapSchema()\` in \`src/lib/db/bootstrap.ts\`
in the same change, or the types describe a schema the database does not have.

\`\`\`typescript
// Ensure this import is present at the top of kysely-db.ts:
// import type { Generated } from "kysely";

// Inside the Database interface add:
${blocks.join("\n\n")}
\`\`\`
`;
}

// --- README -------------------------------------------------------------------

function readmeFile(model: EmlModel, opts: EnterpriseReportingOptions): string {
  const entityLines = model.entities
    .map(
      (e) =>
        `- \`src/server-fns/${toSnakeCase(e.name)}.ts\` — CRUD server functions\n` +
        `- \`src/routes/_authed/${slug(e)}/index.tsx\` — list page\n` +
        `- \`src/routes/_authed/${slug(e)}/$id.tsx\` — detail / edit page`
    )
    .join("\n");

  return `# ${opts.appName}

Generated from an EML model by the \`eml\` CLI, \`--stack enterprise-reporting\`.
Stack: **TanStack Start v1 + Kysely + PostgreSQL**.

Unlike the \`tanstack-nestjs\` target, this one does not emit a standalone
application. It emits code shaped to drop into an existing
\`enterprise_reporting_tanstack\` checkout, which already carries the auth,
RBAC, connection manager, job runner and UI shell these files assume.

## Files generated

${entityLines}
- \`src/lib/db/migrations/*_create_tables.ts\` — Kysely migration (PostgreSQL DDL)
- \`KYSELY_TYPES.md\` — Kysely \`Database\` interface snippet

## Integration steps

1. **Copy files** into the repository at the paths shown above.
2. **Add Kysely types**: paste the snippet from \`KYSELY_TYPES.md\` into the
   \`Database\` interface in \`src/lib/db/kysely-db.ts\`.
3. **Bootstrap the tables**: add the \`CREATE TABLE\` statements to
   \`bootstrapSchema()\` in \`src/lib/db/bootstrap.ts\` — it is idempotent and
   runs on every boot — or apply the migration directly. A full rebuild is
   \`bun scripts/rebuild-db.ts\` (it drops and recreates everything).
4. **Add navigation links** for the new routes in the sidebar under
   \`src/components/layout/\`.
5. **Add permission checks**: \`requireAuth()\` establishes *who* is calling;
   \`requirePermission()\` from \`@/lib/permissions/permissions\` decides what
   they may do. Add the \`<resource>:<action>\` strings for these entities to the
   roles that should hold them.

## Conventions this generator enforces

- \`.inputValidator()\` is always used — never \`.validator()\`. The TanStack
  Start v1 Vite plugin preserves unknown method names verbatim in the client
  bundle, so \`.validator()\` builds cleanly and then crashes at runtime.
- Client calls always pass \`{ data: input }\` — required whenever the server
  function declares an input validator.
- \`requireAuth()\` is called at the top of every handler.
- Every list applies \`LIMIT\`/\`OFFSET\` at the database. Server-side pagination
  is mandatory in this codebase.
- DDL is PostgreSQL. The config database is Postgres only, whatever the older
  files under \`docs/\` still say about MariaDB or SQLite.
`;
}
