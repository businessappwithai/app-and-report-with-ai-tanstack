# TanStack Start v1 Quick Reference

This is a quick reference for TanStack Start patterns used in this project.

## File-Based Routing

TanStack Start uses file-based routing similar to Next.js 13+ App Router but with different syntax.

### Route Structure

```
routes/
├── __root.tsx              # Root layout
├── index.tsx               # / route
├── projects/
│   ├── index.tsx           # /projects route
│   └── $id/                # /projects/:id ($ = dynamic segment)
│       ├── index.tsx       # /projects/$id
│       ├── design.tsx      # /projects/$id/design
│       └── $nested/
│           └── file.tsx    # /projects/$id/$nested/file
└── api/
    ├── projects.ts         # /api/projects
    └── $id/
        └── index.ts        # /api/projects/$id
```

## Route Definitions

### Page Route

```typescript
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/path")({
  component: () => <YourComponent />,
  // Optional loader for data pre-fetching
  beforeLoad: async () => ({ data: "..." }),
  // Optional error boundary
  errorComponent: ({ error }) => <ErrorPage error={error} />,
});

function YourComponent() {
  const data = Route.useLoaderData();
  const params = Route.useParams();
  const search = Route.useSearch();
  return <div>{/* ... */}</div>;
}
```

### API Route (createAPIFileRoute)

```typescript
import { createAPIFileRoute } from "@tanstack/start/api";

export const Route = createAPIFileRoute("/api/endpoint")({
  GET: async ({ request, params }) => {
    // GET handler
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  },
  
  POST: async ({ request, params }) => {
    const body = await request.json();
    // POST handler
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  },
  
  PUT: async ({ request, params }) => {
    // PUT handler
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  },
  
  DELETE: async ({ request, params }) => {
    // DELETE handler
    return new Response(null, { status: 204 });
  },
});
```

## Navigation

### useNavigate Hook

```typescript
import { useNavigate } from "@tanstack/react-router";

function MyComponent() {
  const navigate = useNavigate();

  const handleNavigate = () => {
    // Simple navigation
    navigate({ to: "/projects" });
    
    // With dynamic params
    navigate({ to: "/projects/$id", params: { id: "123" } });
    
    // With search params
    navigate({ to: "/projects", search: { page: 2, sort: "name" } });
    
    // With state
    navigate({ to: "/projects/$id", params: { id: "123" }, state: { from: "list" } });
  };

  return <button onClick={handleNavigate}>Navigate</button>;
}
```

### useParams Hook

```typescript
import { useParams } from "@tanstack/react-router";

function ProjectDetail() {
  const { id } = useParams({ from: "/projects/$id" });
  // or
  const params = Route.useParams();
  return <div>Project: {params.id}</div>;
}
```

### Link Component

```typescript
import { Link } from "@tanstack/react-router";

function Navigation() {
  return (
    <>
      <Link to="/">Home</Link>
      <Link to="/projects">Projects</Link>
      <Link to="/projects/$id" params={{ id: "123" }}>
        Project 123
      </Link>
      <Link to="/projects" search={{ page: 2 }}>
        Next Page
      </Link>
    </>
  );
}
```

## Environment Variables

### Client-Side Access

Use `import.meta.env.VITE_*` in page routes:

```typescript
const apiUrl = import.meta.env.VITE_API_URL;
const mastraUrl = import.meta.env.VITE_MASTRA_URL;
const retryCount = parseInt(import.meta.env.VITE_ERD_DESIGN_AUTO_RETRY_COUNT || "3");
```

### Server-Side Access

Use `process.env.*` in API routes:

```typescript
// routes/api/copilotkit.ts
const apiKey = process.env.COPILOTKIT_API_KEY;
const dbUrl = process.env.DATABASE_URL;
```

### .env File

```
VITE_APP_URL=http://localhost:3000
VITE_API_URL=http://localhost:3000/api
VITE_MASTRA_URL=http://localhost:4111
VITE_ERD_DESIGN_AUTO_RETRY_COUNT=3
ANTHROPIC_API_KEY=sk-...
DATABASE_URL=postgresql://...
COPILOTKIT_API_KEY=...
```

## Database with Kysely

All database operations use Kysely in the database service:

```typescript
import { db } from "@erdwithai/core/services/database.service";

// SELECT
const projects = await db
  .selectFrom("projects")
  .selectAll()
  .execute();

// SELECT with WHERE
const project = await db
  .selectFrom("projects")
  .selectAll()
  .where("id", "=", projectId)
  .executeTakeFirst();

// INSERT
await db
  .insertInto("projects")
  .values({ id, name, description })
  .execute();

// UPDATE
await db
  .updateTable("projects")
  .set({ name: newName })
  .where("id", "=", projectId)
  .execute();

// DELETE
await db
  .deleteFrom("projects")
  .where("id", "=", projectId)
  .execute();

// JOIN
const projectsWithVersions = await db
  .selectFrom("projects")
  .innerJoin("erd_versions", "projects.id", "erd_versions.project_id")
  .selectAll()
  .execute();
```

## Streaming Responses (Server-Sent Events)

For streaming endpoints like `/api/generate` and `/api/deploy`:

```typescript
import { createAPIFileRoute } from "@tanstack/start/api";

export const Route = createAPIFileRoute("/api/generate")({
  POST: async ({ request }) => {
    const { projectId } = await request.json();

    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            // Send initial message
            controller.enqueue(
              `data: ${JSON.stringify({ type: "start", message: "Generating..." })}\n\n`
            );

            // Process in chunks
            const chunks = await generateProject(projectId);
            for (const chunk of chunks) {
              controller.enqueue(`data: ${JSON.stringify(chunk)}\n\n`);
              // Small delay to allow client to process
              await new Promise((resolve) => setTimeout(resolve, 100));
            }

            // Send completion message
            controller.enqueue(
              `data: ${JSON.stringify({ type: "complete" })}\n\n`
            );
            controller.close();
          } catch (error) {
            controller.enqueue(
              `data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`
            );
            controller.close();
          }
        },
      }),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      }
    );
  },
});
```

## CopilotKit Integration

CopilotKit integration uses the generic HTTP endpoint:

```typescript
import { createAPIFileRoute } from "@tanstack/start/api";
import {
  copilotRuntimeGenericHTTPEndpoint,
  CopilotRuntime,
} from "@copilotkit/runtime";
import { CopilotServiceAdapter } from "@copilotkit/runtime";

const runtime = new CopilotRuntime();

export const Route = createAPIFileRoute("/api/copilotkit")({
  POST: async ({ request }) => {
    const handler = copilotRuntimeGenericHTTPEndpoint({
      runtime,
      serviceAdapter: new CopilotServiceAdapter(),
      endpoint: "/api/copilotkit",
    });

    return handler(request);
  },
});
```

## Root Layout

The root layout replaces Next.js `app/layout.tsx`:

```typescript
// routes/__root.tsx
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Providers } from "../providers";
import "../styles/globals.css";

export const Route = createRootRoute({
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>ERDwithAI</title>
      </head>
      <body>
        <Providers>
          <Outlet />
        </Providers>
      </body>
    </html>
  ),
});
```

## Common Patterns

### Data Fetching in Route

```typescript
export const Route = createFileRoute("/projects/$id")({
  beforeLoad: async ({ params }) => {
    const project = await fetch(`/api/projects/${params.id}`).then((r) =>
      r.json()
    );
    return { project };
  },
  component: ProjectPage,
});

function ProjectPage() {
  const { project } = Route.useLoaderData();
  return <div>{project.name}</div>;
}
```

### Error Handling in Route

```typescript
export const Route = createFileRoute("/projects/$id")({
  errorComponent: ({ error, reset }) => (
    <div>
      <h1>Error</h1>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  ),
  component: ProjectPage,
});
```

### Protected Route Pattern

```typescript
// Create a guard using beforeLoad
export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  component: AdminPage,
});
```

## Key Differences from Next.js

| Aspect | Next.js | TanStack Start |
|--------|---------|---|
| Dynamic segment | `[id]` | `$id` |
| Route definition | File-based, automatic | `export const Route = createFileRoute()` |
| API routes | `route.ts` in `/api` | `index.ts` or method-specific in `/api` |
| Navigation | `useRouter().push()` | `useNavigate()` |
| URL params | `useParams()` | `Route.useParams()` |
| Link component | `import Link from "next/link"` | `import { Link }` |
| Link href | `href="/path"` | `to="/path"` |
| Env variables | `process.env.NEXT_PUBLIC_*` | `import.meta.env.VITE_*` (client) |
| Root layout | `app/layout.tsx` | `routes/__root.tsx` |

## Resources

- [TanStack Router Docs](https://tanstack.com/router/latest)
- [TanStack Start Docs](https://tanstack.com/start/latest)
- [Vite Documentation](https://vitejs.dev)
- [Vinxi Documentation](https://vinxi.vercel.app)
