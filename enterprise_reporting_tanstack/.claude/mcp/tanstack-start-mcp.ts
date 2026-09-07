#!/usr/bin/env node

/**
 * TanStack Start MCP Server
 *
 * Provides Claude Code with deep understanding of TanStack Start projects:
 * - Project structure and file discovery
 * - Type definitions and schema introspection
 * - Route and component analysis
 * - Server function catalog
 * - Database schema information
 * - Configuration management
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";

const server = new Server(
  {
    name: "tanstack-start-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

const PROJECT_ROOT = process.cwd();

// Resource discovery and serving
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources = [];

  // Project structure
  resources.push({
    uri: "tanstack://project/structure",
    name: "Project Structure",
    description: "TanStack Start project file structure and organization",
    mimeType: "application/json",
  });

  // Routes discovery
  resources.push({
    uri: "tanstack://routes/index",
    name: "Routes Catalog",
    description: "All TanStack Router file-based routes in the project",
    mimeType: "application/json",
  });

  // Components discovery
  resources.push({
    uri: "tanstack://components/index",
    name: "Components Catalog",
    description: "All React components organized by feature",
    mimeType: "application/json",
  });

  // Server functions discovery
  resources.push({
    uri: "tanstack://server-fns/index",
    name: "Server Functions Catalog",
    description: "All createServerFn functions and their signatures",
    mimeType: "application/json",
  });

  // Database schema
  resources.push({
    uri: "tanstack://database/schema",
    name: "Database Schema",
    description: "Kysely database type definitions and table structure",
    mimeType: "application/json",
  });

  // Configuration
  resources.push({
    uri: "tanstack://config/index",
    name: "Configuration",
    description: "TanStack Start configuration, environment variables, and setup",
    mimeType: "application/json",
  });

  return { resources };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    if (uri === "tanstack://project/structure") {
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(getProjectStructure(), null, 2),
          },
        ],
      };
    } else if (uri === "tanstack://routes/index") {
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(await discoverRoutes(), null, 2),
          },
        ],
      };
    } else if (uri === "tanstack://components/index") {
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(await discoverComponents(), null, 2),
          },
        ],
      };
    } else if (uri === "tanstack://server-fns/index") {
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(await discoverServerFunctions(), null, 2),
          },
        ],
      };
    } else if (uri === "tanstack://database/schema") {
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(await getDatabaseSchema(), null, 2),
          },
        ],
      };
    } else if (uri === "tanstack://config/index") {
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(getConfiguration(), null, 2),
          },
        ],
      };
    }

    return {
      contents: [
        {
          uri,
          mimeType: "text/plain",
          text: `Unknown resource: ${uri}`,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      contents: [
        {
          uri,
          mimeType: "text/plain",
          text: `Error reading resource: ${errorMessage}`,
        },
      ],
    };
  }
});

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "find_route",
        description: "Find a TanStack Router route by name or path pattern",
        inputSchema: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description: "Route name or path pattern (e.g., 'dashboard', '/nl-query', '*auth*')",
            },
          },
          required: ["pattern"],
        },
      },
      {
        name: "find_component",
        description: "Find a React component by name or location",
        inputSchema: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description: "Component name pattern (e.g., 'Button', '*Editor', 'nl-query')",
            },
            feature: {
              type: "string",
              description: "Feature area (e.g., 'charts', 'reporting', 'nl-query')",
            },
          },
          required: ["pattern"],
        },
      },
      {
        name: "find_server_function",
        description: "Find a server function by name",
        inputSchema: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description: "Server function name pattern (e.g., 'executeNLQuery', 'listReports')",
            },
          },
          required: ["pattern"],
        },
      },
      {
        name: "explain_architecture",
        description: "Explain a specific architectural aspect of the TanStack Start project",
        inputSchema: {
          type: "object",
          properties: {
            aspect: {
              type: "string",
              enum: [
                "authentication",
                "routing",
                "data-fetching",
                "server-functions",
                "database",
                "permissions",
                "nl-query",
                "job-queue",
              ],
              description: "Architectural aspect to explain",
            },
          },
          required: ["aspect"],
        },
      },
      {
        name: "check_dependencies",
        description: "Check project dependencies and versions",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["all", "dev", "runtime"],
              description: "Type of dependencies to list",
            },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "find_route": {
        const routes = await discoverRoutes();
        const pattern = (args as any).pattern?.toLowerCase() || "";
        const matches = routes.routes.filter(
          (r) =>
            r.path.toLowerCase().includes(pattern) ||
            r.name.toLowerCase().includes(pattern)
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  query: pattern,
                  found: matches.length,
                  matches: matches.slice(0, 10),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "find_component": {
        const components = await discoverComponents();
        const pattern = (args as any).pattern?.toLowerCase() || "";
        const feature = (args as any).feature?.toLowerCase();
        let results = components.components.filter(
          (c) =>
            c.name.toLowerCase().includes(pattern) ||
            c.path.toLowerCase().includes(pattern)
        );
        if (feature) {
          results = results.filter((c) => c.feature?.toLowerCase().includes(feature));
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  query: pattern,
                  feature: feature || "any",
                  found: results.length,
                  matches: results.slice(0, 10),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "find_server_function": {
        const serverFns = await discoverServerFunctions();
        const pattern = (args as any).pattern?.toLowerCase() || "";
        const matches = serverFns.functions.filter(
          (f) =>
            f.name.toLowerCase().includes(pattern) ||
            f.file.toLowerCase().includes(pattern)
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  query: pattern,
                  found: matches.length,
                  matches: matches.slice(0, 10),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "explain_architecture": {
        const aspect = (args as any).aspect;
        const explanations = getArchitectureExplanations();
        const explanation = (explanations as any)[aspect] || "Unknown aspect";
        return {
          content: [
            {
              type: "text",
              text: explanation,
            },
          ],
        };
      }

      case "check_dependencies": {
        const pkgJsonPath = path.join(PROJECT_ROOT, "package.json");
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
        const type = (args as any).type || "all";

        let deps: Record<string, string> = {};
        if (type === "all" || type === "runtime") {
          deps = { ...deps, ...pkgJson.dependencies };
        }
        if (type === "all" || type === "dev") {
          deps = { ...deps, ...pkgJson.devDependencies };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(deps, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`,
            },
          ],
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error executing tool: ${errorMessage}`,
        },
      ],
    };
  }
});

// Helper functions

function getProjectStructure() {
  return {
    name: "Enterprise Reporting System",
    framework: "TanStack Start",
    language: "TypeScript",
    runtime: "Bun",
    structure: {
      "src/routes": "TanStack Router file-based routes",
      "src/server-fns": "Server functions (RPC endpoints)",
      "src/components": "React components organized by feature",
      "src/lib": "Shared libraries (db, auth, permissions, etc)",
      "src/types": "TypeScript type definitions",
      "e2e": "Playwright E2E tests",
      "docs": "Project documentation",
    },
    keyFeatures: [
      "Natural Language Query (NL→SQL) with OpenAI",
      "SQL Editor with validation and RBAC",
      "Report generation and scheduling",
      "Dashboard and visualization system",
      "Role-based access control",
      "Data source management",
      "Job queue (BullMQ)",
      "Email templates and batch sending",
    ],
  };
}

async function discoverRoutes() {
  const routesDir = path.join(PROJECT_ROOT, "src/routes");
  const files = await glob("**/*.tsx", { cwd: routesDir, absolute: false });

  const routes = files.map((file) => {
    const name = file.replace(/\.tsx$/, "").replace(/\$/, ":");
    const isApi = file.startsWith("api/");
    const isAuth = file.includes("_authed");

    return {
      name,
      path: "/" + name.replace(/\//g, "/").replace(/index$/, ""),
      file: path.join("src/routes", file),
      type: isApi ? "api" : "page",
      protected: isAuth,
    };
  });

  return { routes, total: routes.length };
}

async function discoverComponents() {
  const componentsDir = path.join(PROJECT_ROOT, "src/components");
  if (!fs.existsSync(componentsDir)) {
    return { components: [], total: 0 };
  }

  const files = await glob("**/*.tsx", { cwd: componentsDir, absolute: false });

  const components = files.map((file) => {
    const parts = file.split("/");
    const feature = parts.length > 1 ? parts[0] : "ui";
    const name = path.basename(file, ".tsx");

    return {
      name,
      feature,
      path: path.join("src/components", file),
      file,
    };
  });

  return { components, total: components.length };
}

async function discoverServerFunctions() {
  const serverFnsDir = path.join(PROJECT_ROOT, "src/server-fns");
  if (!fs.existsSync(serverFnsDir)) {
    return { functions: [], total: 0 };
  }

  const files = await glob("**/*.ts", { cwd: serverFnsDir, absolute: false });

  const functions: any[] = [];

  for (const file of files) {
    const filePath = path.join(serverFnsDir, file);
    const content = fs.readFileSync(filePath, "utf-8");

    // Simple regex to find exported functions
    const matches = content.matchAll(/export const (\w+)\s*=\s*createServerFn/g);
    for (const match of matches) {
      functions.push({
        name: match[1],
        file: path.join("src/server-fns", file),
        module: file.replace(/\.ts$/, ""),
      });
    }
  }

  return { functions, total: functions.length };
}

async function getDatabaseSchema() {
  const schemaFile = path.join(PROJECT_ROOT, "src/lib/db/kysely-db.ts");
  const content = fs.readFileSync(schemaFile, "utf-8");

  // Extract interface names
  const interfaceMatches = content.matchAll(/export interface (\w+Table)\s*\{/g);
  const tables = Array.from(interfaceMatches).map((m) => ({
    name: m[1],
    type: "table",
  }));

  return {
    database: "SQLite (development) / PostgreSQL (production)",
    orm: "Kysely",
    tables: tables.slice(0, 20),
    totalTables: tables.length,
    features: [
      "Type-safe queries",
      "PostgreSQL and SQLite support",
      "Foreign key enforcement",
      "Role-based access control",
    ],
  };
}

function getConfiguration() {
  const pkgJsonPath = path.join(PROJECT_ROOT, "package.json");
  const tsconfigPath = path.join(PROJECT_ROOT, "tsconfig.json");
  const bimomePath = path.join(PROJECT_ROOT, "biome.json");

  const config: any = {
    runtime: {
      bun: ">=1.3.0",
    },
    framework: {
      "tanstack-start": "1.167+",
      "tanstack-router": "1.169+",
      react: "18.x",
    },
    database: {
      default: "SQLite (development)",
      production: "PostgreSQL",
      orm: "Kysely 0.29.0",
    },
    tools: {
      linter: "Biome 2.4.14",
      formatter: "Biome",
      language: "TypeScript (strict)",
    },
  };

  // Add actual versions from package.json
  try {
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
    config.actualDependencies = {
      dependencies: Object.keys(pkgJson.dependencies || {}).slice(0, 10),
      devDependencies: Object.keys(pkgJson.devDependencies || {}).slice(0, 10),
    };
  } catch (_error) {
    // File not found or parse error
  }

  return config;
}

function getArchitectureExplanations(): Record<string, string> {
  return {
    authentication: `
Authentication uses JWT with HTTP-only cookies. Key files:
- src/lib/auth/config.ts: NextAuth configuration with custom JWT
- src/lib/auth/middleware.ts: requireAuth() for server functions
- src/lib/permissions/ds-rbac.ts: Data source-level role-based access
- src/lib/security/audit.ts: Audit logging for all auth events

Flow: Login → JWT token in http-only cookie → requireAuth() validation → RBAC checks
    `,
    routing: `
Uses TanStack Router with file-based routing:
- Routes defined in src/routes/ directory structure
- File-based routing translates to URL paths
- _authed.tsx prefix for protected routes
- API routes under src/routes/api/
- Dynamic segments use $ prefix (e.g., $id.tsx)

Server functions are type-safe RPC calls via createServerFn
    `,
    "data-fetching": `
Hybrid approach:
1. Server Functions (createServerFn): Type-safe RPC for data operations
2. REST API: Legacy routes under src/routes/api/ for external access
3. TanStack Query: Client-side caching and synchronization
4. TanStack Table v8: Server-side pagination for data tables

All operations enforce RBAC through validateQueryAccess()
    `,
    "server-functions": `
TanStack Start server functions provide type-safe RPC:
- Defined in src/server-fns/ using createServerFn()
- Automatically serialized/deserialized (no manual JSON)
- Can throw errors which serialize to client
- Full TypeScript inference across boundaries
- Called from client as: await functionName({ params })

Key functions: executeNLQuery, listReports, createDashboard, etc.
    `,
    database: `
Uses Kysely for type-safe SQL:
- Supports PostgreSQL (production) and SQLite (development)
- Type definitions in src/lib/db/kysely-db.ts
- Connection pooling for PostgreSQL
- Foreign keys enabled by default
- No raw SQL - all queries via Kysely API

Important: Always use server-side pagination (LIMIT/OFFSET)
    `,
    permissions: `
Multi-layer permission system:
1. System-level: User roles with permissions
2. Data source-level: DS roles per data source
3. Entity-level: Table/view access control
4. Column-level: Column restrictions within tables
5. Row-level: SQL filters for specific rows

Check via: validateQueryAccess() for queries, RBAC for resources
    `,
    "nl-query": `
Natural Language to SQL pipeline:
1. Schema Extraction: getSchemaMetadata() caches database schema
2. Translation: OpenAI GPT-4-turbo converts NL to SQL
3. Validation: ANTLR checks keywords, isSafeSelectQuery() enforces SELECT-only
4. Confidence: Reverse-translation semantic matching (≥90% auto-execute)
5. RBAC: validateQueryAccess() pre-flight check
6. Execution: Query runs with 30s timeout, paginated results
7. Logging: Successful queries logged to OpenKB for learning

Environment: OPENAI_API_KEY, REDIS_URL, OLLAMA_URL
    `,
    "job-queue": `
Uses BullMQ for async job processing:
- Redis backend for durability
- Job workers in src/lib/jobs/workers/
- Scheduled jobs via job definitions
- Email batch sending, report generation, exports
- Job tracking in database

Access: Bull Board at /bull-board with auth
    `,
  };
}

// Start server
const transport = new StdioServerTransport();
server.connect(transport);

console.error("TanStack Start MCP server started");
