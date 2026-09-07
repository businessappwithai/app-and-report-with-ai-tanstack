# TanStack Start MCP Integration

Claude Code integration via Model Context Protocol (MCP) for deep project understanding.

## Overview

The TanStack Start MCP Server provides Claude Code with comprehensive understanding of the project structure, architecture, routing, components, server functions, database schema, and configuration.

## Installation

The MCP server is automatically configured when you load the project in Claude Code. No additional setup is required.

### What Gets Installed

- `@modelcontextprotocol/sdk@1.29.0` - MCP SDK for building protocol servers
- `.claude/mcp/tanstack-start-mcp.ts` - Server implementation
- `.claude/mcpServers.json` - Server registration configuration

## MCP Server Resources

The server exposes 6 discoverable resources:

### 1. Project Structure (`tanstack://project/structure`)
- Full file tree of the project
- Directory organization and key files
- Includes src/, tests/, configs, etc.

### 2. Routes Catalog (`tanstack://routes/index`)
- All TanStack Router file-based routes
- Route hierarchy from `src/routes/`
- Route handlers and configurations

### 3. Components Catalog (`tanstack://components/index`)
- React components organized by feature
- Components from `src/components/`
- Purpose and location of each component

### 4. Server Functions Catalog (`tanstack://server-fns/index`)
- Server-side functions using `createServerFn`
- Type-safe RPC endpoints
- Request/response types

### 5. Database Schema (`tanstack://database/schema`)
- Complete database schema definition
- All table type definitions
- Relationships and constraints

### 6. Configuration (`tanstack://config/info`)
- Project configuration (environment, paths, etc.)
- TypeScript, Tailwind, Biome settings
- Build and dev server info

## MCP Server Tools

The server provides 5 tools for project navigation:

### `find_route`
Find a TanStack Router route by path pattern.
- Input: route path (e.g., `/dashboard`, `/api/reports`)
- Output: route file content and metadata

### `find_component`
Find a React component by name.
- Input: component name (e.g., `Button`, `Dashboard`)
- Output: component path and purpose

### `find_server_function`
Find a server function by name.
- Input: function name (e.g., `listReports`, `executeSQL`)
- Output: server function signature and documentation

### `explain_architecture`
Get explanation of a specific architecture aspect.
- Input: aspect (auth, routing, database, nl-query, etc.)
- Output: Detailed architectural explanation

### `check_dependencies`
Verify dependencies between routes, components, and server functions.
- Input: file path
- Output: What imports/uses this file

## Architecture Knowledge Built In

The server includes deep architectural knowledge covering:

- **Authentication**: JWT-based with HTTP-only cookies, session management, RBAC
- **Routing**: File-based TanStack Router, auth guards, layout composition
- **Data Fetching**: Server functions vs REST routes, type-safe RPC, error handling
- **Server Functions**: `createServerFn` pattern, type inference, code splitting
- **Database**: Kysely type-safe queries, PostgreSQL and SQLite support, migrations
- **Permissions**: System-level, data-source-level, entity-level, column-level, row-level RBAC
- **NL Query**: OpenAI GPT-4 translation, schema extraction, confidence scoring, OpenKB RAG
- **Job Queue**: BullMQ integration, Redis backend, job workers, Bull Board monitoring

## How Claude Code Uses It

When you ask Claude Code questions about the project:

1. Claude queries the MCP server for relevant resources
2. Claude uses the tools to find specific code patterns
3. Claude applies architectural knowledge to provide context-aware advice
4. Claude can suggest implementation patterns based on project conventions

## Example Queries

Claude Code can now handle queries like:

- "How are authentication routes structured in this project?"
- "Show me the database schema for reports"
- "What server functions exist for managing dashboards?"
- "Where is the NL to SQL translation implemented?"
- "How do permissions work in this system?"
- "Can you find the component for creating reports?"

## Testing the MCP Server

To test the MCP server manually:

```bash
# Start the server directly
bun run .claude/mcp/tanstack-start-mcp.ts

# You should see: "TanStack Start MCP server started"
```

The server listens on stdin/stdout and communicates via the MCP protocol.

## Configuration

The MCP server is registered in `.claude/mcpServers.json`:

```json
{
  "tanstack-start": {
    "command": "bun",
    "args": [".claude/mcp/tanstack-start-mcp.ts"],
    "disabled": false,
    "description": "MCP server for TanStack Start project understanding"
  }
}
```

Claude Code automatically loads and connects to registered MCP servers when opening the project.

## Architecture Overview

```
Claude Code
    ↓
MCP Client
    ↓
.claude/mcp/tanstack-start-mcp.ts (stdio transport)
    ↓
- Resources: Project structure, routes, components, schema, config
- Tools: find_route, find_component, find_server_function, explain_architecture, check_dependencies
    ↓
Project Knowledge
```

## Files

| File | Purpose |
|------|---------|
| `.claude/mcp/tanstack-start-mcp.ts` | MCP server implementation (~280 lines) |
| `.claude/mcpServers.json` | Server registration config |
| `package.json` | Includes `@modelcontextprotocol/sdk` dependency |

## Next Steps

With MCP integration enabled:

1. Claude Code has project-aware understanding
2. You get better code suggestions based on project patterns
3. Navigation and exploration of complex features becomes easier
4. Implementation suggestions follow project conventions automatically

## Troubleshooting

**Server won't start:**
- Check that `@modelcontextprotocol/sdk` is installed: `bun ls @modelcontextprotocol/sdk`
- Verify `.claude/mcp/tanstack-start-mcp.ts` is executable: `ls -la .claude/mcp/`

**Claude Code doesn't recognize the server:**
- Verify `.claude/mcpServers.json` exists and is valid JSON
- Check that the project root is properly set in Claude Code
- Restart Claude Code to reload MCP configuration

**Slow responses:**
- MCP discovery happens on each request - this is normal on first use
- Subsequent requests benefit from caching (glob patterns are cached)

## References

- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [MCP SDK Documentation](https://modelcontextprotocol.io/docs/tools/sdk/javascript/)
- [TanStack Start Documentation](https://tanstack.com/start/)
- [Claude Code Documentation](https://claude.ai/code)
