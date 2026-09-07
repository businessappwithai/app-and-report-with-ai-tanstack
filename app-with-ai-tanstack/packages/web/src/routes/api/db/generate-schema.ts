/**
 * Create the ERD's tables in a target database.
 *
 * Written with `createFileRoute` + `server.handlers` like every other route
 * here. It used to be the tree's only `createAPIFileRoute` caller, and the Vite
 * shim that stands in for that package does not register a server handler — so
 * the path fell through to the application shell and the endpoint answered a
 * POST with 200 and a page of HTML. The button in the UI had never worked, and
 * an access check added to the old shape would have been decorative.
 */

import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/require-user";

export const Route = createFileRoute("/api/db/generate-schema")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const caller = await requireUser(request, "db:generate-schema", "write");
        if (caller.response) return caller.response;

        try {
          const body = (await request.json()) as {
            mermaidCode: string;
            targetDbConnection: string;
          };
          const { mermaidCode, targetDbConnection } = body;

          if (!mermaidCode?.trim()) {
            return new Response(JSON.stringify({ error: "mermaidCode is required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
          if (!targetDbConnection) {
            return new Response(JSON.stringify({ error: "targetDbConnection is required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Parse ERD
          const { MermaidParser } = await import("@appwithai/generator");
          const parser = new MermaidParser();
          const schema = parser.parse(mermaidCode);

          if (!schema.entities || schema.entities.length === 0) {
            return new Response(
              JSON.stringify({
                error: "No entities found in ERD. Check your Mermaid syntax.",
              }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          // Decrypt connection string
          const { decryptConnectionString } = await import("@/lib/encrypt");
          let connStr: string;
          try {
            connStr = decryptConnectionString(targetDbConnection);
          } catch {
            return new Response(
              JSON.stringify({ error: "Invalid or corrupted connection string" }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          // Connect via pg
          const { Client } = await import("pg");
          const client = new Client({ connectionString: connStr, connectionTimeoutMillis: 10000 });
          await client.connect();

          const ddlStatements: string[] = [];
          const tablesCreated: string[] = [];

          for (const entity of schema.entities) {
            const tableName = entity.name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

            const columns = entity.attributes.map((attr) => {
              const colName = attr.name;
              let colType = "TEXT";
              const rawType = (attr.type || "string").toLowerCase();
              if (rawType === "int" || rawType === "integer") colType = "INTEGER";
              else if (rawType === "bigint") colType = "BIGINT";
              else if (rawType === "float" || rawType === "double") colType = "DOUBLE PRECISION";
              else if (rawType === "decimal") colType = "NUMERIC(10,2)";
              else if (rawType === "boolean" || rawType === "bool") colType = "BOOLEAN";
              else if (rawType === "text") colType = "TEXT";
              else if (rawType === "date") colType = "DATE";
              else if (rawType === "datetime" || rawType === "timestamp") colType = "TIMESTAMPTZ";
              else if (rawType === "json") colType = "JSONB";

              const pk = attr.unique && attr.name === "id" ? " PRIMARY KEY" : "";
              const serial = attr.unique && colName === "id" ? "SERIAL" : colType;
              const notNull =
                attr.required && !(attr.unique && attr.name === "id") ? " NOT NULL" : "";
              return `  "${colName}" ${pk ? serial : colType}${pk}${notNull}`;
            });

            if (!entity.attributes.some((a) => a.unique && a.name === "id")) {
              columns.unshift('  "id" SERIAL PRIMARY KEY');
            }

            const ddl = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n${columns.join(",\n")}\n);`;
            ddlStatements.push(ddl);
            tablesCreated.push(tableName);
          }

          try {
            for (const stmt of ddlStatements) {
              await client.query(stmt);
            }
          } finally {
            await client.end();
          }

          return new Response(JSON.stringify({ success: true, tablesCreated }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          return new Response(
            JSON.stringify({
              error: err instanceof Error ? err.message : "Failed to generate schema",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
