---
name: appwithai-web
description: TanStack Start web application with CopilotKit integration for human-in-the-loop ERD design
---

# @appwithai/web Skill

This skill provides guidance for working with the web package of APPWITHAI, which is a TanStack Start application providing the user interface for AI-powered ERD design with CopilotKit integration.

## Package Overview

The web package provides:

- **TanStack Start Application**: Modern React-based full-stack web application with file-based routing
- **CopilotKit Integration**: AI copilot for interactive ERD design
- **Entity Approval UI**: Human-in-the-loop approval components
- **Dashboard**: Project and ERD management interface
- **Mastra Client**: Integration with Mastra.ai backend

## Directory Structure

```
packages/web/
├── src/
│   ├── routes/
│   │   ├── __root.tsx             # Root layout (replaces app/layout.tsx + app/providers.tsx)
│   │   ├── index.tsx              # Root → redirects to /projects
│   │   ├── dashboard.tsx          # Dashboard page
│   │   ├── api/
│   │   │   ├── copilotkit.ts      # CopilotKit API endpoint
│   │   │   └── projects/
│   │   │       └── index.ts       # Projects CRUD
│   │   └── projects/
│   │       ├── index.tsx          # Projects list
│   │       └── $id/
│   │           ├── design.tsx     # ERD design page
│   │           ├── generate.tsx   # Code generation page
│   │           └── deploy.tsx     # Deployment page
│   ├── components/
│   │   ├── approval/
│   │   │   ├── entity-approval-card.tsx  # Entity approval UI
│   │   │   └── relationship-approval.tsx # Relationship approval
│   │   ├── code-agent/
│   │   │   └── CodeAgentPanel.tsx       # Code agent panel
│   │   ├── workflow/
│   │   │   └── FlowchartPreview.tsx     # Workflow flowchart
│   │   └── ui/
│   │       └── ...                        # Shadcn UI components
│   ├── hooks/
│   │   ├── useHumanInTheLoop.ts   # HITL state management hook
│   │   └── useMastra.ts            # Mastra client hook
│   ├── lib/
│   │   ├── api-client.ts           # API client utility
│   │   └── utils.ts                # Utility functions
│   └── store/
│       └── projectStore.ts         # Zustand state management
├── public/
├── tailwind.config.ts
├── vite.config.ts
└── package.json
```

## Key Concepts

### TanStack Start File-Based Routing

TanStack Start uses file-based routing with `$` prefix for dynamic segments (different from Next.js):

```typescript
// routes/projects/$id/design.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/projects/$id/design")({
  component: DesignPage,
});

function DesignPage() {
  const { id } = Route.useParams();  // Access route params via Route.useParams()
  const navigate = useNavigate();    // Navigation via useNavigate()

  return (
    <div>
      <h1>Design Project {id}</h1>
      <button onClick={() => navigate({ to: "/projects" })}>
        Back to Projects
      </button>
    </div>
  );
}
```

### CopilotKit Integration

The app integrates CopilotKit for AI-powered interactions:

```typescript
// src/routes/__root.tsx
import { CopilotKit, CopilotSidebar } from '@copilotkit/react-core';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <CopilotSidebar>
        <Outlet />
      </CopilotSidebar>
    </CopilotKit>
  );
}
```

### CopilotKit API Route (TanStack Start style)

```typescript
// routes/api/copilotkit.ts
import { createAPIFileRoute } from "@tanstack/start/api";
import { copilotRuntimeGenericHTTPEndpoint } from "@copilotkit/runtime";

export const Route = createAPIFileRoute("/api/copilotkit")({
  POST: async ({ request }) => {
    const handler = copilotRuntimeGenericHTTPEndpoint({
      runtime: yourCopilotRuntime,
      serviceAdapter: yourServiceAdapter,
      endpoint: "/api/copilotkit",
    });
    return handler(request);
  },
});
```

### Entity Approval Card

The HITL approval UI component:

```typescript
// src/components/approval/entity-approval-card.tsx
export function EntityApprovalCard({
  entity,
  onApprove,
  onReject,
  onModify
}: EntityApprovalCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{entity.name}</CardTitle>
        <Badge>{Math.round(entity.confidence * 100)}% confidence</Badge>
      </CardHeader>
      <CardContent>
        <AttributeList attributes={entity.suggestedAttributes} />
      </CardContent>
      <CardFooter>
        <Button onClick={onApprove}>Approve</Button>
        <Button onClick={onReject} variant="destructive">Reject</Button>
        <Button onClick={onModify} variant="outline">Modify</Button>
      </CardFooter>
    </Card>
  );
}
```

### Zustand State Management

Project state is managed with Zustand:

```typescript
// src/store/projectStore.ts
import { create } from 'zustand';

interface ProjectState {
  currentProject: Project | null;
  entities: Entity[];
  relationships: Relationship[];
  setProject: (project: Project) => void;
  addEntity: (entity: Entity) => void;
  // ...
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentProject: null,
  entities: [],
  relationships: [],
  setProject: (project) => set({ currentProject: project }),
  addEntity: (entity) => set((state) => ({
    entities: [...state.entities, entity]
  }))
}));
```

## Running the Application

```bash
# Development mode
bun run dev

# Production build
bun run build && bun run start
```

## Environment Variables

Create `.env.local`:

```bash
VITE_MASTRA_URL=http://localhost:4111
VITE_API_URL=http://localhost:3000/api
ANTHROPIC_API_KEY=sk-ant-xxx
COPILOTKIT_API_KEY=ck_xxx  # If using CopilotKit Cloud
```

Note: TanStack Start uses `VITE_*` prefix for client-side environment variables (accessed via `import.meta.env.VITE_*`) and `process.env.*` for server-side API routes.

## Building the Package

```bash
# Build web package (requires core and ai first)
bun run build:core && bun run build:ai && bun run build:web
```

## Dependencies

### Production
- **@appwithai/core**: workspace:* - Core types
- **@appwithai/ai**: workspace:* - AI integration
- **@tanstack/react-router**: ^1.x - File-based routing
- **@tanstack/start**: ^1.x - TanStack Start framework
- **vite**: ^5.x - Build tool
- **@mastra/client-js**: ^1.0.0+ - Mastra client
- **@copilotkit/react-core**: latest - CopilotKit React
- **@copilotkit/react-ui**: latest - CopilotKit UI components
- **@copilotkit/runtime**: latest - CopilotKit runtime
- **react**: ^18.2.0 - React
- **zustand**: ^4.4.7 - State management
- **@radix-ui/***: Various Radix UI primitives
- **tailwindcss**: ^3.3.6 - CSS framework
- **lucide-react**: ^0.294.0 - Icons

### Development
- **typescript**: ^5.3.3
- **@types/react**: ^18.2.0

## Common Tasks

### Adding a New Page Route

1. Create `src/routes/my-page.tsx`:
   ```typescript
   import { createFileRoute } from "@tanstack/react-router";

   export const Route = createFileRoute("/my-page")({
     component: MyPage,
   });

   function MyPage() {
     return <div>My Page Content</div>;
   }
   ```

2. Or with dynamic segments `src/routes/items/$id.tsx`:
   ```typescript
   export const Route = createFileRoute("/items/$id")({
     component: ItemDetail,
   });

   function ItemDetail() {
     const { id } = Route.useParams();
     return <div>Item {id}</div>;
   }
   ```

### Adding a New API Route

1. Create `src/routes/api/my-endpoint.ts`:
   ```typescript
   import { createAPIFileRoute } from "@tanstack/start/api";

   export const Route = createAPIFileRoute("/api/my-endpoint")({
     GET: async ({ request, params }) => {
       // Handle GET
       return new Response(JSON.stringify({ data: 'value' }), {
         headers: { "Content-Type": "application/json" },
       });
     },
     POST: async ({ request, params }) => {
       // Handle POST
       const data = await request.json();
       return new Response(JSON.stringify({ success: true }), {
         headers: { "Content-Type": "application/json" },
       });
     },
   });
   ```

### Adding a New Component

1. Create `src/components/my-component.tsx`
2. Use Shadcn patterns and Tailwind CSS
3. Export from appropriate barrel file

### Adding a CopilotKit Action

1. Edit `src/routes/api/copilotkit.ts`
2. Add action to the runtime configuration

### Styling Guidelines

- Use Tailwind CSS utility classes
- Follow Shadcn UI component patterns
- Use `cn()` utility for conditional classes
- Dark mode support via Tailwind

```typescript
import { cn } from '@/lib/utils';

<div className={cn(
  'bg-background text-foreground',
  isActive && 'border-primary'
)}>
```

## Key Differences from Next.js

| Feature | Next.js | TanStack Start |
|---------|---------|---|
| Dynamic routes | `[id]` | `$id` |
| Route params hook | `useParams()` | `Route.useParams()` |
| Navigation | `useRouter().push()` | `useNavigate({ to: '/' })` |
| Env vars (client) | `process.env.NEXT_PUBLIC_*` | `import.meta.env.VITE_*` |
| API routes | `app/api/route.ts` with `NextRequest/NextResponse` | `routes/api/*.ts` with `createAPIFileRoute()` |
| Layout | `app/layout.tsx` | `routes/__root.tsx` |

## Exports

This is a private package (not published to npm). It's the main entry point for the web application.

## Testing

```bash
cd packages/web
bun run lint
bun run type-check
bun run test
```
