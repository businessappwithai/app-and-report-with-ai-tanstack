# Next.js Architecture Skills

## Overview

This skill provides comprehensive architectural guidelines for building Next.js applications with shadcn/ui components in the ERDwithAI project. This guide follows the latest Next.js 14+ standards with App Router and is specifically designed for the Bun.js runtime.

## Table of Contents

1. [Project Structure](#project-structure)
2. [App Router Architecture](#app-router-architecture)
3. [Component Architecture](#component-architecture)
4. [shadcn/ui Integration](#shadcnui-integration)
5. [State Management](#state-management)
6. [API Routes](#api-routes)
7. [Data Fetching Patterns](#data-fetching-patterns)
8. [Server Components vs Client Components](#server-components-vs-client-components)
9. [Error Handling](#error-handling)
10. [Performance Optimization](#performance-optimization)
11. [Security Best Practices](#security-best-practices)
12. [Bun.js Runtime Specifics](#bunjs-runtime-specifics)

---

## Project Structure

### Standard Monorepo Structure

```
packages/web/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Route groups (auth-protected)
│   │   │   └── dashboard/
│   │   ├── (marketing)/       # Public routes
│   │   │   └── landing/
│   │   ├── api/               # API routes
│   │   │   ├── generate/
│   │   │   ├── ai/
│   │   │   └── deploy/
│   │   ├── projects/
│   │   ├── designer/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   ├── forms/             # Form components
│   │   ├── layouts/           # Layout components
│   │   └── features/          # Feature-specific components
│   ├── lib/
│   │   ├── utils.ts           # Utility functions
│   │   ├── api.ts             # API client utilities
│   │   └── constants.ts       # Application constants
│   ├── hooks/
│   │   ├── useProjects.ts     # Custom hooks
│   │   ├── useAI.ts
│   │   └── useDatabase.ts
│   ├── stores/
│   │   └── projectStore.ts    # Zustand stores
│   ├── types/
│   │   └── index.ts           # TypeScript types
│   └── styles/
│       └── globals.css        # Global styles
├── public/                    # Static assets
├── next.config.ts             # Next.js configuration
├── tailwind.config.ts         # Tailwind CSS configuration
├── tsconfig.json              # TypeScript configuration
└── package.json
```

### Key Architecture Principles

1. **Route Groups**: Use parentheses for route organization without affecting URL structure
2. **Colocation**: Keep components, hooks, and utilities close to where they're used
3. **Server-First**: Default to Server Components, use Client Components only when necessary
4. **Type Safety**: Leverage TypeScript for all components and utilities

---

## App Router Architecture

### File-Based Routing

```typescript
// src/app/projects/[id]/page.tsx
// Route: /projects/{id}

import { notFound } from 'next/navigation';
import { db } from '@/lib/db';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: PageProps) {
  const { id } = await params;
  const project = await db.project.findUnique({ where: { id } });

  if (!project) {
    notFound();
  }

  return <ProjectView project={project} />;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const project = await db.project.findUnique({ where: { id } });

  return {
    title: project?.name || 'Project',
    description: `View project ${project?.name}`,
  };
}
```

### Parallel Routes

```typescript
// src/app/@modal/default.tsx
export default function Default() {
  return null;
}

// src/app/@modal/projects/[id]/page.tsx
// Allows modal to overlay any route
```

### Intercepting Routes

```typescript
// src/app/projects/[id]/photo/[...slug]/page.tsx
// Intercepted by:
// src/app/@modal/projects/[id]/photo/[...slug]/page.tsx
```

### Route Groups

```typescript
// src/app/(auth)/layout.tsx
// Protected routes layout
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}

// src/app/(marketing)/layout.tsx
// Public routes layout
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className="marketing">{children}</div>;
}
```

---

## Component Architecture

### Server Component Pattern

```typescript
// components/features/ProjectList.tsx
// Default: Server Component

import { db } from '@/lib/db';
import { ProjectCard } from './ProjectCard';

export async function ProjectList() {
  const projects = await db.project.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
```

### Client Component Pattern

```typescript
// components/features/ProjectEditor.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ProjectEditorProps {
  project: Project;
  onSave: (project: Project) => void;
}

export function ProjectEditor({ project, onSave }: ProjectEditorProps) {
  const [name, setName] = useState(project.name);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      onSave({ ...project, name });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Project name"
      />
      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save'}
      </Button>
    </div>
  );
}
```

### Server-Client Composition Pattern

```typescript
// Server Component wrapper
// components/features/ProjectDetail.tsx

import { db } from '@/lib/db';
import { ProjectEditor } from './ProjectEditor';

export async function ProjectDetail({ id }: { id: string }) {
  const project = await db.project.findUnique({ where: { id } });

  if (!project) {
    return <div>Project not found</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{project.name}</h1>
      <ProjectEditor
        project={project}
        onSave={(updated) => console.log('Saved:', updated)}
      />
    </div>
  );
}
```

### Component Props Pattern

```typescript
// types/components.ts

export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface ButtonProps extends BaseComponentProps {
  variant?: 'default' | 'destructive' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  disabled?: boolean;
  onClick?: () => void;
}

// Usage
export function PrimaryButton({ children, ...props }: ButtonProps) {
  return <Button variant="default" size="default" {...props}>{children}</Button>;
}
```

---

## shadcn/ui Integration

### Component Installation

```bash
# Install a shadcn/ui component
bunx shadcn@latest add button
bunx shadcn@latest add card
bunx shadcn@latest add dialog
bunx shadcn@latest add form
bunx shadcn@latest add table
```

### Component Structure

```typescript
// components/ui/button.tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

### Form Components with Zod Validation

```typescript
// components/forms/ProjectForm.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const projectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  type: z.enum(['web', 'mobile', 'desktop']),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

export function ProjectForm({ onSubmit }: { onSubmit: (values: ProjectFormValues) => void }) {
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      description: '',
      type: 'web',
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Name</FormLabel>
              <FormControl>
                <Input placeholder="My awesome project" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Create Project</Button>
      </form>
    </Form>
  );
}
```

### Data Table Pattern

```typescript
// components/data-table/DataTable.tsx
'use client';

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

export function DataTable<TData, TValue>({ columns, data }: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

### Dialog/Sheet Pattern

```typescript
// components/features/CreateProjectDialog.tsx
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ProjectForm } from './forms/ProjectForm';

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create Project</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Create a new project to start designing your database schema.
          </DialogDescription>
        </DialogHeader>
        <ProjectForm
          onSubmit={(values) => {
            console.log('Creating project:', values);
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
```

---

## State Management

### Zustand Store Pattern

```typescript
// stores/projectStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Project {
  id: string;
  name: string;
  entities: Entity[];
  relationships: Relationship[];
}

interface ProjectStore {
  currentProject: Project | null;
  projects: Project[];
  setCurrentProject: (project: Project | null) => void;
  addEntity: (entity: Entity) => void;
  updateEntity: (id: string, updates: Partial<Entity>) => void;
  removeEntity: (id: string) => void;
  addRelationship: (relationship: Relationship) => void;
  loadProjects: () => Promise<void>;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      currentProject: null,
      projects: [],

      setCurrentProject: (project) => set({ currentProject: project }),

      addEntity: (entity) =>
        set((state) => ({
          currentProject: state.currentProject
            ? {
                ...state.currentProject,
                entities: [...state.currentProject.entities, entity],
              }
            : null,
        })),

      updateEntity: (id, updates) =>
        set((state) => ({
          currentProject: state.currentProject
            ? {
                ...state.currentProject,
                entities: state.currentProject.entities.map((e) =>
                  e.id === id ? { ...e, ...updates } : e
                ),
              }
            : null,
        })),

      removeEntity: (id) =>
        set((state) => ({
          currentProject: state.currentProject
            ? {
                ...state.currentProject,
                entities: state.currentProject.entities.filter((e) => e.id !== id),
              }
            : null,
        })),

      addRelationship: (relationship) =>
        set((state) => ({
          currentProject: state.currentProject
            ? {
                ...state.currentProject,
                relationships: [...state.currentProject.relationships, relationship],
              }
            : null,
        })),

      loadProjects: async () => {
        const response = await fetch('/api/projects');
        const projects = await response.json();
        set({ projects });
      },
    }),
    {
      name: 'project-storage',
    }
  )
);
```

### Server State with React Query

```typescript
// hooks/useProjects.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Project {
  id: string;
  name: string;
  description: string;
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json() as Promise<Project[]>;
    },
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}`);
      if (!response.ok) throw new Error('Failed to fetch project');
      return response.json() as Promise<Project>;
    },
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const response = await fetch('/api/projects', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create project');
      return response.json() as Promise<Project>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<Project>) => {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update project');
      return response.json() as Promise<Project>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', data.id] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete project');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
```

---

## API Routes

### Standard API Route Pattern

```typescript
// src/app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['web', 'mobile', 'desktop']).default('web'),
});

// GET /api/projects
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';

    const [projects, total] = await Promise.all([
      db.project.findMany({
        where: search
          ? { name: { contains: search, mode: 'insensitive' } }
          : undefined,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.project.count({
        where: search
          ? { name: { contains: search, mode: 'insensitive' } }
          : undefined,
      }),
    ]);

    return NextResponse.json({
      projects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

// POST /api/projects
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createProjectSchema.parse(body);

    const project = await db.project.create({
      data: {
        ...validatedData,
        userId: request.headers.get('x-user-id') || 'anonymous',
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
```

### Dynamic Route API Handler

```typescript
// src/app/api/projects/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { paramsSchema } from '@/lib/validations';

// GET /api/projects/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await db.project.findUnique({ where: { id } });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = updateProjectSchema.parse(body);

    const project = await db.project.update({
      where: { id },
      data: validatedData,
    });

    return NextResponse.json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.project.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
```

### Streaming API Response

```typescript
// src/app/api/generate/route.ts
import { NextRequest } from 'next/server';
import { streamText } from 'ai';

export async function POST(request: NextRequest) {
  const { prompt, options } = await request.json();

  const result = await streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    prompt,
    ...options,
  });

  return result.toDataStreamResponse();
}
```

---

## Data Fetching Patterns

### Server Component Data Fetching

```typescript
// Direct database access in Server Components
import { db } from '@/lib/db';
import { cache } from 'react';

export const getProjects = cache(async () => {
  return await db.project.findMany({
    orderBy: { createdAt: 'desc' },
  });
});

export const getProject = cache(async (id: string) => {
  return await db.project.findUnique({ where: { id } });
});

// Usage in component
export async function ProjectsPage() {
  const projects = await getProjects();

  return <ProjectList projects={projects} />;
}
```

### Client Component Data Fetching with SWR

```typescript
'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useProject(id: string) {
  const { data, error, isLoading } = useSWR(`/api/projects/${id}`, fetcher);

  return {
    project: data,
    isLoading,
    isError: error,
  };
}
```

### Server Actions Pattern

```typescript
// actions/projects.ts
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export async function createProject(formData: FormData) {
  const validatedFields = createProjectSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
  });

  if (!validatedFields.success) {
    return { error: 'Invalid fields' };
  }

  const project = await db.project.create({
    data: validatedFields.data,
  });

  revalidatePath('/projects');
  return { project };
}

// Usage in Client Component
'use client';

import { createProject } from '@/actions/projects';

export function CreateProjectButton() {
  const handleClick = async () => {
    const result = await createProject(new FormData());
    if (result.error) {
      console.error(result.error);
    }
  };

  return <button onClick={handleClick}>Create</button>;
}
```

---

## Server Components vs Client Components

### Decision Matrix

| Use Case | Component Type | Reason |
|----------|----------------|--------|
| Data fetching, database access | Server | Direct DB access, no JS bundle |
| Static content, SEO | Server | HTML rendered on server |
| Forms with validation | Client | Interactive, real-time feedback |
| Event handlers (onClick) | Client | Requires JavaScript |
| Third-party libraries (charts) | Client | Require browser APIs |
| Authentication checks | Server | Secure, no token exposure |

### Server Component Default

```typescript
// Good: Server Component
import { db } from '@/lib/db';
import { ProjectCard } from './ProjectCard';

export async function ProjectList() {
  const projects = await db.project.findMany();
  return <div>{projects.map(p => <ProjectCard key={p.id} project={p} />)}</div>;
}
```

### Client Component When Needed

```typescript
'use client';

import { useState } from 'react';

export function InteractiveButton() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

### Passing Server Data to Client Components

```typescript
// Server Component
import { ProjectEditor } from './ProjectEditor';

export async function ProjectPage({ id }: { id: string }) {
  const project = await db.project.findUnique({ where: { id } });

  // Serialize data before passing to Client Component
  return <ProjectEditor project={JSON.parse(JSON.stringify(project))} />;
}
```

---

## Error Handling

### Error Boundaries

```typescript
// app/error.tsx
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Something went wrong!</h2>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
```

### 404 Not Found

```typescript
// app/not-found.tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-4xl font-bold">404</h2>
        <p className="text-muted-foreground">Page not found</p>
        <Button asChild>
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    </div>
  );
}
```

### API Error Responses

```typescript
// lib/api-error.ts
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status: error.statusCode }
    );
  }

  console.error('Unexpected error:', error);
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

---

## Performance Optimization

### Dynamic Imports

```typescript
// Lazy load heavy components
import dynamic from 'next/dynamic';

const HeavyChart = dynamic(() => import('@/components/HeavyChart'), {
  loading: () => <p>Loading chart...</p>,
  ssr: false, // Disable SSR for client-only libraries
});

export function Dashboard() {
  return <HeavyChart data={data} />;
}
```

### Image Optimization

```typescript
import Image from 'next/image';

export function ProjectThumbnail({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={400}
      height={300}
      priority={false} // Only set priority for above-fold images
    />
  );
}
```

### Font Optimization

```typescript
// app/layout.tsx
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

### Memoization

```typescript
'use client';

import { memo } from 'react';

export const ProjectCard = memo(function ProjectCard({ project }: { project: Project }) {
  return <div>{project.name}</div>;
});
```

---

## Security Best Practices

### Input Validation

```typescript
import { z } from 'zod';

const projectSchema = z.object({
  name: z.string().min(1).max(100).transform(s => s.trim()),
  description: z.string().max(1000).optional(),
});

export async function createProject(data: unknown) {
  const validated = projectSchema.parse(data);
  // Safe to use validated data
}
```

### XSS Prevention

```typescript
import { DOMPurify } from 'isomorphic-dompurify';

export function SanitizedHTML({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html);
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

### CSRF Protection

```typescript
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
  const headersList = await headers();
  const csrfToken = headersList.get('x-csrf-token');

  // Validate CSRF token
  if (!validateCsrfToken(csrfToken)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  // Process request
}
```

### Rate Limiting

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
});

export async function rateLimit(identifier: string) {
  const { success, remaining } = await ratelimit.limit(identifier);

  if (!success) {
    throw new Error('Rate limit exceeded');
  }

  return remaining;
}
```

---

## Bun.js Runtime Specifics

### Next.js Configuration for Bun

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Use Bun's transpiler for external packages
  transpilePackages: [
    '@radix-ui/react-icons',
    'class-variance-authority',
    'clsx',
    'tailwind-merge',
  ],

  // Optimize for Bun runtime
  swcMinify: true,
  reactStrictMode: true,

  // Experimental features
  experimental: {
    serverComponentsExternalPackages: ['@your-package'],
  },

  // Output configuration
  output: 'standalone',
};

export default nextConfig;
```

### Bun-Specific Optimizations

```typescript
// lib/bun-utils.ts
import { file } from 'bun';

export async function readFileOptimized(path: string) {
  // Use Bun's optimized file reading
  const blob = await file(path);
  return blob.text();
}

export async function serveStatic(path: string) {
  // Use Bun's built-in file server
  return new Response(await file(path), {
    headers: {
      'Content-Type': getMimeType(path),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
```

### Environment Variables

```typescript
// lib/env.ts
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    ANTHROPIC_API_KEY: z.string().min(1),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
});
```

---

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Zustand Documentation](https://zustand-demo.pmnd.rs)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [Bun.js Documentation](https://bun.sh/docs)