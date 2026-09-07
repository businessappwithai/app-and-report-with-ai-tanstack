# Next.js Testing Skills

## Overview

This skill provides comprehensive testing guidelines for Next.js applications with shadcn/ui components in the ERDwithAI project. This guide covers unit testing, integration testing, E2E testing, and is designed for the Bun.js runtime.

## Table of Contents

1. [Testing Strategy](#testing-strategy)
2. [Testing Setup](#testing-setup)
3. [Unit Testing](#unit-testing)
4. [Component Testing](#component-testing)
5. [API Route Testing](#api-route-testing)
6. [Integration Testing](#integration-testing)
7. [E2E Testing](#e2e-testing)
8. [Performance Testing](#performance-testing)
9. [Accessibility Testing](#accessibility-testing)
10. [Visual Regression Testing](#visual-regression-testing)
11. [Testing Best Practices](#testing-best-practices)
12. [Bun.js Runtime Specifics](#bunjs-runtime-specifics)

---

## Testing Strategy

### Testing Pyramid

```
                /\
               /  \
              / E2E \
             /______\
            /        \
           /Integration\
          /__________\
         /            \
        /  Unit Tests  \
       /______________\
```

- **Unit Tests (70%)**: Fast, isolated tests for individual functions/components
- **Integration Tests (20%)**: Tests for component interactions and API integration
- **E2E Tests (10%)**: Full user flow tests

### Test File Organization

```
packages/web/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.test.tsx
│   │   │   └── card.test.tsx
│   │   └── features/
│   │       ├── ProjectCard.test.tsx
│   │       └── ProjectList.test.tsx
│   ├── app/
│   │   └── api/
│   │       └── projects.test.ts
│   └── lib/
│       └── utils.test.ts
├── __tests__/
│   ├── e2e/
│   │   ├── project-flow.spec.ts
│   │   └── auth-flow.spec.ts
│   └── visual/
│       └── snapshots.spec.ts
├── playwright.config.ts
└── vitest.config.ts
```

---

## Testing Setup

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.config.*',
        '**/*.test.*',
      ],
    },
    include: ['**/*.{test,spec}.{js,jsx,ts,tsx}'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Test Setup File

```typescript
// test/setup.ts
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Mock IntersectionObserver
class IntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: IntersectionObserver,
});

// Mock ResizeObserver
class ResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: ResizeObserver,
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "bun test",
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:visual": "playwright test --project=chromium"
  }
}
```

---

## Unit Testing

### Testing Utilities

```typescript
// src/lib/utils.test.ts
import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn (className utility)', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('should handle Tailwind conflicts', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('should handle undefined/null', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });
});

describe('formatDate utility', () => {
  it('should format date correctly', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    expect(formatDate(date)).toBe('Jan 15, 2024');
  });

  it('should handle invalid dates', () => {
    expect(formatDate(new Date('invalid'))).toBe('Invalid Date');
  });
});
```

### Testing Custom Hooks

```typescript
// src/hooks/useProjects.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProjects, useCreateProject } from './useProjects';

// Mock fetch
global.fetch = vi.fn();

describe('useProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch projects successfully', async () => {
    const mockProjects = [
      { id: '1', name: 'Project 1' },
      { id: '2', name: 'Project 2' },
    ];

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockProjects,
    });

    const { result } = renderHook(() => useProjects());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockProjects);
    expect(fetch).toHaveBeenCalledWith('/api/projects');
  });

  it('should handle errors', async () => {
    (fetch as any).mockRejectedValueOnce(new Error('Failed to fetch'));

    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeTruthy();
  });
});

describe('useCreateProject', () => {
  it('should create project successfully', async () => {
    const mockProject = { id: '1', name: 'New Project' };
    const queryClient = {
      invalidateQueries: vi.fn(),
    };

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockProject,
    });

    const { result } = renderHook(() =>
      useCreateProject(queryClient as any)
    );

    await act(async () => {
      await result.current.mutateAsync({ name: 'New Project' });
    });

    expect(fetch).toHaveBeenCalledWith('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Project' }),
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['projects'],
    });
  });
});
```

---

## Component Testing

### Testing shadcn/ui Components

```typescript
// src/components/ui/button.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { Button } from './button';

describe('Button Component', () => {
  it('should render button with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('should handle click events', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click me</Button>);

    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should apply variant classes correctly', () => {
    const { rerender } = render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-destructive');

    rerender(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole('button')).toHaveClass('border');
  });

  it('should apply size classes correctly', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-8');

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-10');
  });
});
```

### Testing Feature Components

```typescript
// src/components/features/ProjectCard.test.tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ProjectCard } from './ProjectCard';

const mockProject = {
  id: '1',
  name: 'Test Project',
  description: 'A test project',
  type: 'web' as const,
  createdAt: '2024-01-15T10:30:00Z',
};

describe('ProjectCard Component', () => {
  it('should render project information', () => {
    render(<ProjectCard project={mockProject} />);

    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('A test project')).toBeInTheDocument();
  });

  it('should render project type badge', () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.getByText('web')).toBeInTheDocument();
  });

  it('should format date correctly', () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
  });

  it('should call onSelect when clicked', async () => {
    const handleSelect = vi.fn();
    const user = userEvent.setup();

    render(<ProjectCard project={mockProject} onSelect={handleSelect} />);

    await user.click(screen.getByRole('button'));
    expect(handleSelect).toHaveBeenCalledWith(mockProject);
  });

  it('should call onDelete when delete button clicked', async () => {
    const handleDelete = vi.fn();
    const user = userEvent.setup();

    render(<ProjectCard project={mockProject} onDelete={handleDelete} />);

    const deleteButton = screen.getByLabelText(/delete project/i);
    await user.click(deleteButton);

    expect(handleDelete).toHaveBeenCalledWith('1');
  });

  it('should not show delete button when onDelete not provided', () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.queryByLabelText(/delete project/i)).not.toBeInTheDocument();
  });
});
```

### Testing Server Components

```typescript
// src/app/projects/page.test.tsx (app router)
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ProjectsPage from './page';

// Mock the database
vi.mock('@/lib/db', () => ({
  db: {
    project: {
      findMany: vi.fn(),
    },
  },
}));

describe('ProjectsPage', () => {
  it('should render list of projects', async () => {
    const mockProjects = [
      { id: '1', name: 'Project 1' },
      { id: '2', name: 'Project 2' },
    ];

    const { db } = await import('@/lib/db');
    (db.project.findMany as any).mockResolvedValue(mockProjects);

    // For Server Components, test the rendered output
    const { container } = render(await ProjectsPage());
    expect(screen.getByText('Project 1')).toBeInTheDocument();
    expect(screen.getByText('Project 2')).toBeInTheDocument();
  });

  it('should show empty state when no projects', async () => {
    const { db } = await import('@/lib/db');
    (db.project.findMany as any).mockResolvedValue([]);

    render(await ProjectsPage());
    expect(screen.getByText(/no projects found/i)).toBeInTheDocument();
  });
});
```

### Testing Forms

```typescript
// src/components/forms/ProjectForm.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ProjectForm } from './ProjectForm';

describe('ProjectForm Component', () => {
  it('should validate required fields', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<ProjectForm onSubmit={handleSubmit} />);

    const submitButton = screen.getByRole('button', { name: /create project/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('should submit form with valid data', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<ProjectForm onSubmit={handleSubmit} />);

    await user.type(screen.getByLabelText(/project name/i), 'Test Project');
    await user.type(screen.getByLabelText(/description/i), 'Test Description');

    await user.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        name: 'Test Project',
        description: 'Test Description',
        type: 'web',
      });
    });
  });

  it('should show validation errors for invalid input', async () => {
    const user = userEvent.setup();

    render(<ProjectForm onSubmit={vi.fn()} />);

    const nameInput = screen.getByLabelText(/project name/i);
    await user.type(nameInput, 'AB');

    await waitFor(() => {
      expect(screen.getByText(/name must be at least 3 characters/i)).toBeInTheDocument();
    });
  });

  it('should reset form after successful submission', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<ProjectForm onSubmit={handleSubmit} />);

    await user.type(screen.getByLabelText(/project name/i), 'Test Project');
    await user.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/project name/i)).toHaveValue('');
    });
  });
});
```

---

## API Route Testing

### Testing GET Endpoint

```typescript
// src/app/api/projects/route.test.ts
import { GET } from './route';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('@/lib/db', () => ({
  db: {
    project: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

describe('GET /api/projects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return list of projects', async () => {
    const mockProjects = [
      { id: '1', name: 'Project 1' },
      { id: '2', name: 'Project 2' },
    ];

    const { db } = await import('@/lib/db');
    (db.project.findMany as any).mockResolvedValue(mockProjects);
    (db.project.count as any).mockResolvedValue(2);

    const request = new Request('http://localhost:3000/api/projects');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.projects).toEqual(mockProjects);
    expect(data.pagination.total).toBe(2);
  });

  it('should handle pagination', async () => {
    const { db } = await import('@/lib/db');
    (db.project.findMany as any).mockResolvedValue([]);
    (db.project.count as any).mockResolvedValue(0);

    const request = new Request('http://localhost:3000/api/projects?page=2&limit=20');
    const response = await GET(request);
    const data = await response.json();

    expect(db.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20,
      })
    );
  });

  it('should handle search query', async () => {
    const { db } = await import('@/lib/db');
    (db.project.findMany as any).mockResolvedValue([]);
    (db.project.count as any).mockResolvedValue(0);

    const request = new Request('http://localhost:3000/api/projects?search=test');
    const response = await GET(request);

    expect(db.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: expect.any(Object),
        }),
      })
    );
  });

  it('should handle errors gracefully', async () => {
    const { db } = await import('@/lib/db');
    (db.project.findMany as any).mockRejectedValue(new Error('Database error'));

    const request = new Request('http://localhost:3000/api/projects');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch projects');
  });
});
```

### Testing POST Endpoint

```typescript
// src/app/api/projects/route.test.ts
import { POST } from './route';
import { describe, it, expect, vi } from 'vitest';

describe('POST /api/projects', () => {
  it('should create new project', async () => {
    const mockProject = { id: '1', name: 'New Project' };

    const { db } = await import('@/lib/db');
    (db.project.create as any).mockResolvedValue(mockProject);

    const request = new Request('http://localhost:3000/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Project', type: 'web' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toEqual(mockProject);
  });

  it('should validate input', async () => {
    const request = new Request('http://localhost:3000/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation error');
  });

  it('should handle validation errors', async () => {
    const request = new Request('http://localhost:3000/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'a'.repeat(101) }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.details).toBeDefined();
  });
});
```

### Testing Dynamic Routes

```typescript
// src/app/api/projects/[id]/route.test.ts
import { GET, PATCH, DELETE } from './route';
import { describe, it, expect, vi } from 'vitest';

describe('/api/projects/[id]', () => {
  it('should get single project', async () => {
    const mockProject = { id: '1', name: 'Project 1' };

    const { db } = await import('@/lib/db');
    (db.project.findUnique as any).mockResolvedValue(mockProject);

    const params = Promise.resolve({ id: '1' });
    const request = new Request('http://localhost:3000/api/projects/1');
    const response = await GET(request, { params: await params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockProject);
  });

  it('should return 404 for non-existent project', async () => {
    const { db } = await import('@/lib/db');
    (db.project.findUnique as any).mockResolvedValue(null);

    const params = Promise.resolve({ id: '999' });
    const request = new Request('http://localhost:3000/api/projects/999');
    const response = await GET(request, { params: await params });

    expect(response.status).toBe(404);
  });

  it('should update project', async () => {
    const updatedProject = { id: '1', name: 'Updated Project' };

    const { db } = await import('@/lib/db');
    (db.project.update as any).mockResolvedValue(updatedProject);

    const params = Promise.resolve({ id: '1' });
    const request = new Request('http://localhost:3000/api/projects/1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated Project' }),
    });

    const response = await PATCH(request, { params: await params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe('Updated Project');
  });

  it('should delete project', async () => {
    const { db } = await import('@/lib/db');
    (db.project.delete as any).mockResolvedValue({ id: '1' });

    const params = Promise.resolve({ id: '1' });
    const request = new Request('http://localhost:3000/api/projects/1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: await params });

    expect(response.status).toBe(200);
  });
});
```

---

## Integration Testing

### Testing Component Integration

```typescript
// src/components/features/ProjectList.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ProjectList } from './ProjectList';

vi.mock('@/hooks/useProjects', () => ({
  useProjects: vi.fn(),
}));

vi.mock('@/hooks/useDeleteProject', () => ({
  useDeleteProject: vi.fn(),
}));

describe('ProjectList Integration', () => {
  it('should display projects and handle deletion', async () => {
    const mockProjects = [
      { id: '1', name: 'Project 1' },
      { id: '2', name: 'Project 2' },
    ];

    const { useProjects } = await import('@/hooks/useProjects');
    const { useDeleteProject } = await import('@/hooks/useDeleteProject');

    (useProjects as any).mockReturnValue({
      data: mockProjects,
      isLoading: false,
      isError: false,
    });

    (useDeleteProject as any).mockReturnValue({
      mutateAsync: vi.fn(),
    });

    render(<ProjectList />);

    expect(screen.getByText('Project 1')).toBeInTheDocument();
    expect(screen.getByText('Project 2')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    const { useProjects } = require('@/hooks/useProjects');
    useProjects.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
    });

    render(<ProjectList />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should show error state', () => {
    const { useProjects } = require('@/hooks/useProjects');
    useProjects.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
    });

    render(<ProjectList />);
    expect(screen.getByText(/error loading projects/i)).toBeInTheDocument();
  });
});
```

### Testing with MSW (Mock Service Worker)

```typescript
// test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/projects', ({ request }) => {
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    const limit = url.searchParams.get('limit') || '10';

    return HttpResponse.json({
      projects: [
        { id: '1', name: 'Project 1' },
        { id: '2', name: 'Project 2' },
      ],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 2,
        totalPages: 1,
      },
    });
  }),

  http.post('/api/projects', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { id: 'new-id', ...body },
      { status: 201 }
    );
  }),

  http.get('/api/projects/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'Project ' + params.id,
    });
  }),
];

// test/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// test/setup.ts
import { server } from './mocks/server';
import { beforeAll, afterEach, afterAll } from 'vitest';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Integration test with MSW
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProjectList } from '@/components/features/ProjectList';

describe('ProjectList with MSW', () => {
  it('should fetch and display projects', async () => {
    render(<ProjectList />);

    await waitFor(() => {
      expect(screen.getByText('Project 1')).toBeInTheDocument();
      expect(screen.getByText('Project 2')).toBeInTheDocument();
    });
  });
});
```

---

## E2E Testing

### Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### E2E Test Example

```typescript
// __tests__/e2e/project-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Project Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/projects');
  });

  test('should create a new project', async ({ page }) => {
    await page.click('button:has-text("Create Project")');

    await page.fill('input[name="name"]', 'Test Project');
    await page.fill('textarea[name="description"]', 'Test Description');
    await page.selectOption('select[name="type"]', 'web');

    await page.click('button:has-text("Create")');

    await expect(page).toHaveURL(/\/projects\/[a-z0-9]+/);
    await expect(page.locator('h1')).toContainText('Test Project');
  });

  test('should display project list', async ({ page }) => {
    await expect(page.locator('[data-testid="project-list"]')).toBeVisible();

    const projectCards = page.locator('[data-testid="project-card"]');
    await expect(projectCards.first()).toBeVisible();
  });

  test('should search projects', async ({ page }) => {
    await page.fill('input[placeholder*="search"]', 'Test');
    await page.press('input[placeholder*="search"]', 'Enter');

    await page.waitForTimeout(500); // Wait for debounced search
    const results = page.locator('[data-testid="project-card"]');
    await expect(results.first()).toContainText('Test');
  });

  test('should delete a project', async ({ page }) => {
    await page.goto('/projects');
    await page.click('[data-testid="project-card"]:first-child button[aria-label*="delete"]');

    await page.click('button:has-text("Confirm")');

    await expect(page.locator('text=Project deleted')).toBeVisible();
  });
});
```

### API E2E Tests

```typescript
// __tests__/e2e/api/projects.spec.ts
import { test, expect } from '@playwright/test';

const baseURL = 'http://localhost:3000';

test.describe('Projects API', () => {
  let projectId: string;

  test('POST /api/projects - Create project', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/projects`, {
      data: {
        name: 'E2E Test Project',
        description: 'Created by E2E test',
        type: 'web',
      },
    });

    expect(response.status()).toBe(201);
    const project = await response.json();
    expect(project.name).toBe('E2E Test Project');
    projectId = project.id;
  });

  test('GET /api/projects - Get all projects', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/projects`);

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.projects).toBeInstanceOf(Array);
  });

  test('GET /api/projects/:id - Get single project', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/projects/${projectId}`);

    expect(response.status()).toBe(200);
    const project = await response.json();
    expect(project.id).toBe(projectId);
  });

  test('PATCH /api/projects/:id - Update project', async ({ request }) => {
    const response = await request.patch(`${baseURL}/api/projects/${projectId}`, {
      data: {
        name: 'Updated E2E Test Project',
      },
    });

    expect(response.status()).toBe(200);
    const project = await response.json();
    expect(project.name).toBe('Updated E2E Test Project');
  });

  test('DELETE /api/projects/:id - Delete project', async ({ request }) => {
    const response = await request.delete(`${baseURL}/api/projects/${projectId}`);

    expect(response.status()).toBe(200);
  });
});
```

---

## Performance Testing

### Lighthouse CI Configuration

```typescript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000',
        'http://localhost:3000/projects',
      ],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
```

### Bundle Size Testing

```typescript
// __tests__/performance/bundle-size.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Bundle Size', () => {
  test('should not exceed bundle size limits', async ({ page }) => {
    const metrics = await page.evaluate(async () => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const jsFiles = entries.filter((e) => e.name.endsWith('.js'));

      return {
        totalSize: jsFiles.reduce((sum, entry) => sum + entry.transferSize, 0),
        fileCount: jsFiles.length,
        largestFile: Math.max(...jsFiles.map((e) => e.transferSize)),
      };
    });

    // Total bundle should be less than 500KB
    expect(metrics.totalSize).toBeLessThan(500 * 1024);
    // Individual files should be less than 200KB
    expect(metrics.largestFile).toBeLessThan(200 * 1024);
  });
});
```

---

## Accessibility Testing

### jest-axe Integration

```typescript
// src/components/features/ProjectCard.a11y.test.tsx
import { render, screen } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import { ProjectCard } from './ProjectCard';

expect.extend(toHaveNoViolations);

describe('ProjectCard Accessibility', () => {
  it('should not have accessibility violations', async () => {
    const { container } = render(<ProjectCard project={mockProject} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have accessible buttons', () => {
    render(<ProjectCard project={mockProject} onDelete={vi.fn()} />);

    const deleteButton = screen.getByRole('button', { name: /delete project/i });
    expect(deleteButton).toHaveAttribute('aria-label');
  });

  it('should have proper heading hierarchy', () => {
    const { container } = render(<ProjectCard project={mockProject} />);

    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    expect(headings.length).toBeGreaterThan(0);
  });
});
```

---

## Testing Best Practices

### Test Naming Conventions

```typescript
// Good
describe('ProjectService', () => {
  describe('create', () => {
    it('should create project with valid data', async () => {
      // Test implementation
    });

    it('should throw error when name is empty', async () => {
      // Test implementation
    });

    it('should throw error when name exceeds max length', async () => {
      // Test implementation
    });
  });
});

// Bad
describe('ProjectService', () => {
  it('should work', async () => {
    // Vague - what is being tested?
  });
});
```

### AAA Pattern (Arrange, Act, Assert)

```typescript
it('should update project', async () => {
  // Arrange - Set up test data and conditions
  const project = { id: '1', name: 'Old Name' };
  const updateData = { name: 'New Name' };
  vi.mocked(db.project.update).mockResolvedValue({ ...project, ...updateData });

  // Act - Execute the function being tested
  const result = await projectService.update('1', updateData);

  // Assert - Verify the outcome
  expect(result.name).toBe('New Name');
  expect(db.project.update).toHaveBeenCalledWith('1', updateData);
});
```

### Testing Edge Cases

```typescript
describe('ProjectService edge cases', () => {
  it('should handle null values', async () => {
    vi.mocked(db.project.findUnique).mockResolvedValue(null);
    await expect(projectService.findOne('1')).rejects.toThrow(NotFoundException);
  });

  it('should handle concurrent updates', async () => {
    const updates = [
      projectService.update('1', { name: 'Name 1' }),
      projectService.update('1', { name: 'Name 2' }),
    ];
    await expect(Promise.all(updates)).resolves.toBeDefined();
  });

  it('should handle special characters in names', async () => {
    const specialName = "Test's \"Project\" & <More>";
    const result = await projectService.create({ name: specialName });
    expect(result.name).toBe(specialName);
  });
});
```

---

## Bun.js Runtime Specifics

### Bun Test Configuration

```typescript
// package.json
{
  "scripts": {
    "test": "bun test",
    "test:unit": "bun test --watch",
    "test:coverage": "bun test --coverage"
  }
}

// Example Bun test
// utils.test.ts
import { describe, test, expect } from 'bun:test';

describe('Utils', () => {
  test('cn merges classes', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });
});
```

---

## Additional Resources

- [Vitest Documentation](https://vitest.dev)
- [Playwright Documentation](https://playwright.dev)
- [Testing Library Documentation](https://testing-library.com)
- [MSW Documentation](https://mswjs.io)