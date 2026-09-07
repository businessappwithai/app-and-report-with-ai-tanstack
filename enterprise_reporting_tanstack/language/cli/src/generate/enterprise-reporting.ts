/**
 * Enterprise Reporting stack generation target.
 *
 * Generates TanStack Start + Kysely + MariaDB application code from an EML
 * model, following the conventions of this repository:
 *
 *   src/server-fns/<entity>.ts           createServerFn with .inputValidator()
 *   src/routes/_authed/<entity>/index.tsx list page (TanStack Table + shadcn/ui)
 *   src/routes/_authed/<entity>/$id.tsx   detail/edit page (shadcn/ui form)
 *   src/lib/db/migrations/<ts>_create.ts  Kysely migration (MariaDB)
 *   KYSELY_TYPES.md                       snippet for kysely-db.ts Database interface
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { EmlAttribute, EmlEntity, EmlIndex, EmlModel } from "../model.ts";
import { camelCase, kebabCase, plural, toSnakeCase } from "../util.ts";

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
  return tbl(e).replace(/_/g, "-");
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

function ddlType(attr: EmlAttribute): string {
  switch (attr.type) {
    case "integer":
      return "INT";
    case "decimal":
      return "DECIMAL(10,2)";
    case "boolean":
      return "TINYINT(1)";
    case "date":
      return "DATE";
    case "datetime":
      return "DATETIME";
    case "text":
      return "TEXT";
    case "json":
      return "JSON";
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

  const inputTypeFields = editable
    .map((a) => {
      const opt = a.required ? "" : "?";
      return `  ${a.name}${opt}: ${tsType(a)};`;
    })
    .join("\n");

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
import { getDb } from "@/lib/db/kysely-db";
import { requireAuth } from "@/lib/auth/middleware";
import { z } from "zod";

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
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
  });

export const create${Type}Fn = createServerFn({ method: "POST" })
  .inputValidator((input: ${Type}Input) => ${Type}InputSchema.parse(input))
  .handler(async ({ data }) => {
    await requireAuth();
    const id = crypto.randomUUID();
    await getDb().insertInto("${tableName}").values({ id, ...data }).execute();
    return { id };
  });

export const update${Type}Fn = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string } & Partial<${Type}Input>) => input)
  .handler(async ({ data: { id, ...rest } }) => {
    await requireAuth();
    await getDb()
      .updateTable("${tableName}")
      .set(rest as Record<string, unknown>)
      .where("id", "=", id)
      .execute();
    return { id };
  });

export const delete${Type}Fn = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data: { id } }) => {
    await requireAuth();
    await getDb().deleteFrom("${tableName}").where("id", "=", id).execute();
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
  const displayCols = e.attributes.filter((a) => !a.isPrimaryKey).slice(0, 4);

  const headCells = displayCols
    .map((a) => `                <TableHead>${e.label ? toLabel(a.name) : toLabel(a.name)}</TableHead>`)
    .join("\n");

  const bodyCells = displayCols
    .map((a) => `                    <TableCell>{String(row.${a.name} ?? "")}</TableCell>`)
    .join("\n");

  return `import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { list${Type}sFn } from "@/server-fns/${sfModule}";
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

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">${pluralLabel}</h1>
        <Button asChild>
          <Link to="/_authed/${routePath}/$id" params={{ id: "new" }}>
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
                  <TableRow key={row.id}>
${bodyCells}
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to="/_authed/${routePath}/$id" params={{ id: row.id }}>
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

  return `import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  create${Type}Fn,
  delete${Type}Fn,
  get${Type}Fn,
  update${Type}Fn,
} from "@/server-fns/${sfModule}";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      navigate({ to: "/_authed/${routePath}/" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => delete${Type}Fn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["${tableName}"] });
      navigate({ to: "/_authed/${routePath}/" });
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
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/_authed/${routePath}/" })}
            >
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
      `  \`${pk}\` VARCHAR(36) PRIMARY KEY DEFAULT (UUID())`,
      ...nonPk.map((a) => {
        const notNull = a.required ? " NOT NULL" : " NULL";
        const uq = a.unique ? " UNIQUE" : "";
        const def = a.type === "boolean" ? " DEFAULT 0" : "";
        return `  \`${a.name}\` ${ddlType(a)}${notNull}${uq}${def}`;
      }),
      "  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP",
      "  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    ];

    const extraIndexes = model.indexes
      .filter((idx: EmlIndex) => idx.entity === e.name)
      .map(
        (idx: EmlIndex) =>
          `  await db.schema\n    .createIndex("idx_${tableName}_${idx.columns.join("_")}")\n    .on("${tableName}")\n    .columns([${idx.columns.map((c) => `"${c}"`).join(", ")}])\n    .ifNotExists()\n    .execute();`
      );

    return {
      tableName,
      ddl: `CREATE TABLE IF NOT EXISTS \`${tableName}\` (\n${cols.join(",\n")}\n);`,
      extraIndexes,
    };
  });

  return `import type { Kysely } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
${stmts
  .map(
    (s) =>
      `  await db.schema.executeRaw(\`${s.ddl}\`).execute();` +
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

Generated from EML model by the Enterprise Reporting EML CLI.
Stack: **TanStack Start + Kysely + MariaDB** (enterprise-reporting target).

## Files generated

${entityLines}
- \`src/lib/db/migrations/*_create_tables.ts\` — Kysely migration (MariaDB DDL)
- \`KYSELY_TYPES.md\` — Kysely \`Database\` interface snippet

## Integration steps

1. **Copy files** into the repository at the paths shown above.
2. **Add Kysely types**: paste the snippet from \`KYSELY_TYPES.md\` into the
   \`Database\` interface in \`src/lib/db/kysely-db.ts\`.
3. **Bootstrap tables**: add the \`CREATE TABLE\` statements from the migration
   to \`bootstrapSchema()\` in \`src/lib/db/bootstrap.ts\`, or run the migration
   with \`bun run db:migrate\`.
4. **Add navigation links** to the new routes in
   \`src/components/layout/Sidebar.tsx\`.
5. **Customise**: add permission checks (\`requirePermission()\`), refine Zod
   schemas, and apply your UI patterns as needed.

## Server function conventions enforced by this generator

- \`.inputValidator()\` is always used — never \`.validator()\`. The TanStack
  Start v1 Vite plugin only preserves \`.inputValidator()\` across the
  server/client boundary.
- Client calls always pass \`{ data: input }\` — the wrapper is required.
- \`requireAuth()\` is called at the top of every handler.
`;
}
