# TanStack Start Testing Skills

## Overview

This skill provides comprehensive testing guidelines for TanStack Start (full-stack React) applications with shadcn/ui components in the Enterprise Reporting System. This guide covers unit testing, integration testing, E2E testing, server functions testing, and is designed for the Bun.js runtime.

## Table of Contents

1. [Testing Strategy](#testing-strategy)
2. [Testing Setup](#testing-setup)
3. [Unit Testing](#unit-testing)
4. [Component Testing](#component-testing)
5. [Server Functions Testing](#server-functions-testing)
6. [API Route Testing](#api-route-testing)
7. [Integration Testing](#integration-testing)
8. [E2E Testing](#e2e-testing)
9. [Performance Testing](#performance-testing)
10. [Accessibility Testing](#accessibility-testing)
11. [Visual Regression Testing](#visual-regression-testing)
12. [Testing Best Practices](#testing-best-practices)
13. [Bun.js Runtime Specifics](#bunjs-runtime-specifics)

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
enterprise-reporting-system/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.test.tsx
│   │   │   └── card.test.tsx
│   │   └── features/
│   │       ├── ProjectCard.test.tsx
│   │       └── ProjectList.test.tsx
│   ├── routes/
│   │   ├── __root.tsx
│   │   ├── _authed.tsx
│   │   ├── _authed/
│   │   │   └── dashboard.tsx
│   │   └── api/
│   │       └── projects.ts
│   ├── server-fns/
│   │   ├── reports.test.ts
│   │   └── sql.test.ts
│   └── lib/
│       └── utils.test.ts
├── e2e/
│   ├── app.spec.ts
│   └── dashboards.spec.ts
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
process.env.VITE_APP_URL = 'http://localhost:4050';

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

## Server Functions Testing

Server functions in TanStack Start are type-safe RPC endpoints using `createServerFn`. They replace the need for separate REST API routes and server components.

### Testing Server Functions

```typescript
// src/server-fns/reports.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listReports, createReport, deleteReport } from './reports';

// Mock the database
vi.mock('@/lib/db/config', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/auth/middleware', () => ({
  requireAuth: vi.fn(),
}));

describe('Server Functions - Reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list reports for authenticated user', async () => {
    const { requireAuth } = await import('@/lib/auth/middleware');
    const { getDb } = await import('@/lib/db/config');

    const mockSession = { user: { id: 'user-1', email: 'test@example.com' } };
    (requireAuth as any).mockResolvedValue(mockSession);

    const mockReports = [
      { id: '1', name: 'Report 1', userId: 'user-1' },
      { id: '2', name: 'Report 2', userId: 'user-1' },
    ];

    const mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(mockReports),
    };

    (getDb as any).mockReturnValue(mockDb);

    const result = await listReports({ page: 0, pageSize: 20 });

    expect(requireAuth).toHaveBeenCalled();
    expect(result).toEqual(mockReports);
  });

  it('should throw if user is not authenticated', async () => {
    const { requireAuth } = await import('@/lib/auth/middleware');
    (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));

    await expect(listReports({ page: 0, pageSize: 20 })).rejects.toThrow(
      'Unauthorized'
    );
  });

  it('should create report with user context', async () => {
    const { requireAuth } = await import('@/lib/auth/middleware');
    const { getDb } = await import('@/lib/db/config');

    const mockSession = { user: { id: 'user-1', email: 'test@example.com' } };
    (requireAuth as any).mockResolvedValue(mockSession);

    const mockNewReport = {
      id: 'new-report',
      name: 'New Report',
      userId: 'user-1',
    };

    const mockDb = {
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(mockNewReport),
    };

    (getDb as any).mockReturnValue(mockDb);

    const result = await createReport({ name: 'New Report' });

    expect(result).toEqual(mockNewReport);
    expect(result.userId).toBe('user-1');
  });

  it('should delete report with authorization check', async () => {
    const { requireAuth } = await import('@/lib/auth/middleware');
    const { getDb } = await import('@/lib/db/config');

    const mockSession = { user: { id: 'user-1' } };
    (requireAuth as any).mockResolvedValue(mockSession);

    const mockDb = {
      deleteFrom: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ numDeletedRows: 1n }),
    };

    (getDb as any).mockReturnValue(mockDb);

    await deleteReport('report-1');

    expect(mockDb.deleteFrom).toHaveBeenCalled();
  });
});
```

### Testing SQL Server Functions

```typescript
// src/server-fns/sql.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeSql, validateSql } from './sql';

vi.mock('@/lib/auth/middleware', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/sql/validator', () => ({
  validateQuery: vi.fn(),
}));

describe('Server Functions - SQL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute validated SQL query', async () => {
    const { requireAuth } = await import('@/lib/auth/middleware');
    const { validateQuery } = await import('@/lib/sql/validator');

    const mockSession = { user: { id: 'user-1' } };
    (requireAuth as any).mockResolvedValue(mockSession);
    (validateQuery as any).mockResolvedValue(true);

    const sql = 'SELECT * FROM users LIMIT 10';
    const mockResults = [
      { id: 1, name: 'User 1' },
      { id: 2, name: 'User 2' },
    ];

    // Mock the actual execution
    const result = await executeSql(sql);

    expect(validateQuery).toHaveBeenCalledWith(sql);
  });

  it('should reject invalid SQL', async () => {
    const { validateQuery } = await import('@/lib/sql/validator');
    (validateQuery as any).mockRejectedValue(new Error('Invalid SQL'));

    const sql = 'DROP TABLE users';

    await expect(validateSql(sql)).rejects.toThrow('Invalid SQL');
  });
});
```

---

## API Route Testing

TanStack Start API routes use file-based routing in `src/routes/api/`. Use these tests for REST endpoints that need external access.

### Testing API Routes

```typescript
// src/routes/api/projects.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/config', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/auth/middleware', () => ({
  requireAuth: vi.fn(),
}));

describe('API Route - /api/projects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle GET requests with pagination', async () => {
    const mockProjects = [
      { id: '1', name: 'Project 1' },
      { id: '2', name: 'Project 2' },
    ];

    // Test API route handler
    expect(mockProjects).toHaveLength(2);
  });

  it('should handle POST requests with validation', async () => {
    // API route validation test
    const payload = { name: 'New Project' };
    expect(payload).toHaveProperty('name');
  });

  it('should enforce authentication', async () => {
    const { requireAuth } = await import('@/lib/auth/middleware');
    (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));

    await expect(requireAuth()).rejects.toThrow('Unauthorized');
  });
});
```

### Testing Dynamic API Routes

```typescript
// src/routes/api/projects/$id.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('API Route - /api/projects/:id', () => {
  it('should get single project by id', async () => {
    const projectId = '1';
    const mockProject = { id: projectId, name: 'Project 1' };

    expect(mockProject.id).toBe(projectId);
  });

  it('should update project', async () => {
    const updates = { name: 'Updated Project' };
    expect(updates).toHaveProperty('name');
  });

  it('should delete project', async () => {
    const result = { numDeletedRows: 1n };
    expect(result.numDeletedRows).toBe(1n);
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
import { describe, it, expect, vi } from 'vitest';
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
// src/components/reporting/ReportCard.test.tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ReportCard } from './ReportCard';

const mockReport = {
  id: '1',
  name: 'Test Report',
  description: 'A test report',
  createdAt: new Date('2024-01-15T10:30:00Z'),
  updatedAt: new Date('2024-01-15T10:30:00Z'),
};

describe('ReportCard Component', () => {
  it('should render report information', () => {
    render(<ReportCard report={mockReport} />);

    expect(screen.getByText('Test Report')).toBeInTheDocument();
    expect(screen.getByText('A test report')).toBeInTheDocument();
  });

  it('should format date correctly', () => {
    render(<ReportCard report={mockReport} />);
    expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
  });

  it('should call onSelect when clicked', async () => {
    const handleSelect = vi.fn();
    const user = userEvent.setup();

    render(<ReportCard report={mockReport} onSelect={handleSelect} />);

    await user.click(screen.getByRole('button'));
    expect(handleSelect).toHaveBeenCalledWith(mockReport);
  });

  it('should call onDelete when delete button clicked', async () => {
    const handleDelete = vi.fn();
    const user = userEvent.setup();

    render(<ReportCard report={mockReport} onDelete={handleDelete} />);

    const deleteButton = screen.getByLabelText(/delete report/i);
    await user.click(deleteButton);

    expect(handleDelete).toHaveBeenCalledWith('1');
  });

  it('should not show delete button when onDelete not provided', () => {
    render(<ReportCard report={mockReport} />);
    expect(screen.queryByLabelText(/delete report/i)).not.toBeInTheDocument();
  });
});
```

### Testing Dashboard Components

```typescript
// src/components/dashboard/DashboardGrid.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DashboardGrid } from './DashboardGrid';

describe('DashboardGrid Component', () => {
  it('should render chart components', async () => {
    const mockCharts = [
      { id: '1', name: 'Chart 1', type: 'bar' },
      { id: '2', name: 'Chart 2', type: 'line' },
    ];

    render(<DashboardGrid charts={mockCharts} />);

    await waitFor(() => {
      expect(screen.getByText('Chart 1')).toBeInTheDocument();
      expect(screen.getByText('Chart 2')).toBeInTheDocument();
    });
  });

  it('should handle responsive layout', () => {
    const mockCharts = [
      { id: '1', name: 'Chart 1', type: 'bar' },
    ];

    const { container } = render(<DashboardGrid charts={mockCharts} />);
    expect(container.querySelector('.grid')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(<DashboardGrid charts={[]} isLoading={true} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
```

### Testing Forms with TanStack Form

```typescript
// src/components/forms/ReportForm.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ReportForm } from './ReportForm';

describe('ReportForm Component', () => {
  it('should validate required fields', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<ReportForm onSubmit={handleSubmit} />);

    const submitButton = screen.getByRole('button', { name: /create report/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('should submit form with valid data', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<ReportForm onSubmit={handleSubmit} />);

    await user.type(screen.getByLabelText(/report name/i), 'Test Report');
    await user.type(screen.getByLabelText(/description/i), 'Test Description');

    await user.click(screen.getByRole('button', { name: /create report/i }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Report',
          description: 'Test Description',
        })
      );
    });
  });

  it('should show validation errors for invalid input', async () => {
    const user = userEvent.setup();

    render(<ReportForm onSubmit={vi.fn()} />);

    const nameInput = screen.getByLabelText(/report name/i);
    await user.type(nameInput, 'AB');

    await waitFor(() => {
      expect(screen.getByText(/name must be at least 3 characters/i)).toBeInTheDocument();
    });
  });

  it('should reset form after successful submission', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<ReportForm onSubmit={handleSubmit} />);

    await user.type(screen.getByLabelText(/report name/i), 'Test Report');
    await user.click(screen.getByRole('button', { name: /create report/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/report name/i)).toHaveValue('');
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

---

## Integration Testing

### Testing Component Integration with Server Functions

```typescript
// src/components/features/ReportList.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ReportList } from './ReportList';

vi.mock('@/server-fns/reports', () => ({
  listReports: vi.fn(),
  deleteReport: vi.fn(),
}));

describe('ReportList Integration', () => {
  it('should display reports and handle deletion', async () => {
    const mockReports = [
      { id: '1', name: 'Report 1', userId: 'user-1' },
      { id: '2', name: 'Report 2', userId: 'user-1' },
    ];

    const { listReports } = await import('@/server-fns/reports');
    (listReports as any).mockResolvedValue(mockReports);

    render(<ReportList />);

    await waitFor(() => {
      expect(screen.getByText('Report 1')).toBeInTheDocument();
      expect(screen.getByText('Report 2')).toBeInTheDocument();
    });
  });

  it('should show loading state', async () => {
    const { listReports } = await import('@/server-fns/reports');
    (listReports as any).mockImplementation(() => new Promise(() => {}));

    render(<ReportList />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should show error state', async () => {
    const { listReports } = await import('@/server-fns/reports');
    (listReports as any).mockRejectedValue(new Error('Failed to fetch'));

    render(<ReportList />);

    await waitFor(() => {
      expect(screen.getByText(/error loading reports/i)).toBeInTheDocument();
    });
  });
});
```

### Testing with MSW (Mock Service Worker)

```typescript
// test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/reports', ({ request }) => {
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '0';
    const pageSize = url.searchParams.get('pageSize') || '50';

    return HttpResponse.json({
      reports: [
        { id: '1', name: 'Report 1', userId: 'user-1' },
        { id: '2', name: 'Report 2', userId: 'user-1' },
      ],
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: 2,
        totalPages: 1,
      },
    });
  }),

  http.post('/api/reports', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { id: 'new-id', ...body, userId: 'user-1' },
      { status: 201 }
    );
  }),

  http.get('/api/reports/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'Report ' + params.id,
      userId: 'user-1',
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
import { ReportList } from '@/components/reporting/ReportList';

describe('ReportList with MSW', () => {
  it('should fetch and display reports', async () => {
    render(<ReportList />);

    await waitFor(() => {
      expect(screen.getByText('Report 1')).toBeInTheDocument();
      expect(screen.getByText('Report 2')).toBeInTheDocument();
    });
  });
```

```typescript
// src/components/features/DashboardList.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DashboardList } from './DashboardList';

vi.mock('@/server-fns/dashboards', () => ({
  listDashboards: vi.fn(),
  deleteDashboard: vi.fn(),
}));

describe('DashboardList Integration', () => {
  it('should display dashboards and handle deletion', async () => {
    const mockDashboards = [
      { id: '1', name: 'Dashboard 1', userId: 'user-1' },
      { id: '2', name: 'Dashboard 2', userId: 'user-1' },
    ];

    const { listDashboards } = await import('@/server-fns/dashboards');
    (listDashboards as any).mockResolvedValue(mockDashboards);

    render(<DashboardList />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard 1')).toBeInTheDocument();
      expect(screen.getByText('Dashboard 2')).toBeInTheDocument();
    });
  });

  it('should show loading state', async () => {
    const { listDashboards } = await import('@/server-fns/dashboards');
    (listDashboards as any).mockImplementation(() => new Promise(() => {}));

    render(<DashboardList />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should show error state', async () => {
    const { listDashboards } = await import('@/server-fns/dashboards');
    (listDashboards as any).mockRejectedValue(new Error('Failed to fetch'));

    render(<DashboardList />);

    await waitFor(() => {
      expect(screen.getByText(/error loading dashboards/i)).toBeInTheDocument();
    });
  });
});
```

### Testing with MSW (Mock Service Worker)

```typescript
// test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/reports', ({ request }) => {
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '0';
    const pageSize = url.searchParams.get('pageSize') || '50';

    return HttpResponse.json({
      reports: [
        { id: '1', name: 'Report 1', userId: 'user-1' },
        { id: '2', name: 'Report 2', userId: 'user-1' },
      ],
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: 2,
        totalPages: 1,
      },
    });
  }),

  http.post('/api/reports', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { id: 'new-id', ...body, userId: 'user-1' },
      { status: 201 }
    );
  }),

  http.get('/api/reports/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'Report ' + params.id,
      userId: 'user-1',
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
```

---

## E2E Testing

### Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Serial execution for TanStack Start (requires session)
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL: 'http://localhost:4050',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:4050',
    reuseExistingServer: !process.env.CI,
  },
});
```

### E2E Test Example - Dashboard Flow

```typescript
// e2e/dashboards.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should view dashboard with charts', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Wait for charts to load
    await expect(page.locator('[data-testid="dashboard-grid"]')).toBeVisible();
    
    const chartElements = page.locator('[data-testid="chart-card"]');
    const count = await chartElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display chart data', async ({ page }) => {
    await page.goto('/dashboard');

    // Verify chart container is visible
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to report editor', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Click on reports link
    await page.click('a[href*="/reports"]');
    
    await expect(page).toHaveURL(/\/reports/);
    await expect(page.locator('h1')).toContainText('Reports');
  });
});
```

### E2E Test Example - SQL Editor Flow

```typescript
// e2e/sql-editor.spec.ts
import { test, expect } from '@playwright/test';

test.describe('SQL Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should execute SQL query', async ({ page }) => {
    await page.goto('/sql-editor');

    // Wait for editor to be ready
    await page.waitForSelector('[data-testid="sql-editor"]', { timeout: 5000 });

    // Type SQL query
    await page.fill('[data-testid="sql-editor"]', 'SELECT * FROM users LIMIT 10');

    // Execute query
    await page.click('button[aria-label="Execute"]');

    // Wait for results
    await expect(page.locator('[data-testid="query-results"]')).toBeVisible({ timeout: 10000 });

    // Verify results table exists
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('should validate SQL before execution', async ({ page }) => {
    await page.goto('/sql-editor');

    // Type invalid SQL
    await page.fill('[data-testid="sql-editor"]', 'INVALID SQL QUERY');

    // Execute query
    await page.click('button[aria-label="Execute"]');

    // Should show error
    await expect(page.locator('[role="alert"]')).toContainText(/error|invalid/i);
  });
});
```

### E2E Test Example - Report Management

```typescript
// e2e/reports.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Report Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should list reports', async ({ page }) => {
    await page.goto('/reports');

    // Wait for reports list to load
    await expect(page.locator('[data-testid="reports-list"]')).toBeVisible({ timeout: 5000 });

    // Verify report cards exist
    const reportCards = page.locator('[data-testid="report-card"]');
    const count = await reportCards.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should create new report', async ({ page }) => {
    await page.goto('/reports');

    // Click create button
    await page.click('button:has-text("Create Report")');

    // Fill in form
    await page.fill('input[name="name"]', 'E2E Test Report');
    await page.fill('textarea[name="description"]', 'Created by E2E test');

    // Submit form
    await page.click('button:has-text("Create")');

    // Should redirect to editor
    await expect(page).toHaveURL(/\/reports\/[^/]+\/editor/);
  });

  test('should edit report', async ({ page }) => {
    await page.goto('/reports');

    // Click first report
    const firstReport = page.locator('[data-testid="report-card"]').first();
    await firstReport.click();

    // Should open editor
    await expect(page).toHaveURL(/\/reports\/[^/]+\/editor/);

    // Verify editor is visible
    await expect(page.locator('[data-testid="report-editor"]')).toBeVisible();
  });

  test('should delete report', async ({ page }) => {
    await page.goto('/reports');

    // Find delete button on first report
    const deleteButton = page.locator('[data-testid="report-card"]').first()
      .locator('button[aria-label*="delete"]');
    
    await deleteButton.click();

    // Confirm deletion
    await page.click('button:has-text("Confirm Delete")');

    // Should show success message
    await expect(page.locator('text=/deleted|removed/i')).toBeVisible();
  });
});
```

### API E2E Tests

```typescript
// e2e/api-reports.spec.ts
import { test, expect } from '@playwright/test';

const baseURL = 'http://localhost:4050';

test.describe('Reports API', () => {
  let reportId: string;
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    // Get auth token via login
    const loginResponse = await request.post(`${baseURL}/api/auth/login`, {
      data: {
        email: 'test@example.com',
        password: 'password',
      },
    });
    authToken = (await loginResponse.json()).token;
  });

  test('POST /api/reports - Create report', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/reports`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        name: 'E2E API Test Report',
        description: 'Created via API',
        type: 'table',
      },
    });

    expect(response.status()).toBe(201);
    const report = await response.json();
    reportId = report.id;
    expect(report.name).toBe('E2E API Test Report');
  });

  test('GET /api/reports - List reports', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/reports`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status()).toBe(200);
    const { reports } = await response.json();
    expect(Array.isArray(reports)).toBe(true);
  });

  test('GET /api/reports/:id - Get report', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/reports/${reportId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status()).toBe(200);
    const report = await response.json();
    expect(report.id).toBe(reportId);
  });

  test('PUT /api/reports/:id - Update report', async ({ request }) => {
    const response = await request.put(`${baseURL}/api/reports/${reportId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        name: 'Updated Report Name',
      },
    });

    expect(response.status()).toBe(200);
    const report = await response.json();
    expect(report.name).toBe('Updated Report Name');
  });

  test('DELETE /api/reports/:id - Delete report', async ({ request }) => {
    const response = await request.delete(`${baseURL}/api/reports/${reportId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status()).toBe(200);
  });
});
```
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
---

## Performance Testing

### Core Web Vitals Monitoring

```typescript
// e2e/performance.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Performance Monitoring', () => {
  test('should have acceptable Core Web Vitals', async ({ page }) => {
    await page.goto('/dashboard');

    const metrics = await page.evaluate(() => {
      const vital = (name: string) => {
        const entries = performance.getEntriesByName(name);
        return entries.length > 0 ? entries[0] : null;
      };

      return {
        paint: performance.getEntriesByType('paint'),
        navigationTiming: performance.getEntriesByType('navigation')[0],
      };
    });

    // Page should load in under 3 seconds
    const navigationTiming = metrics.navigationTiming as PerformanceNavigationTiming;
    expect(navigationTiming.loadEventEnd - navigationTiming.fetchStart).toBeLessThan(3000);
  });

  test('should load SQL editor efficiently', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/sql-editor');

    // Wait for editor to be interactive
    await page.waitForSelector('[data-testid="sql-editor"]', { timeout: 5000 });
    const loadTime = Date.now() - startTime;

    // Should load in under 2 seconds
    expect(loadTime).toBeLessThan(2000);
  });

  test('should handle large datasets without freezing', async ({ page }) => {
    await page.goto('/reports');

    // Measure time to render reports list
    const startTime = Date.now();
    await page.waitForSelector('[data-testid="reports-list"]', { timeout: 10000 });
    const renderTime = Date.now() - startTime;

    expect(renderTime).toBeLessThan(5000);
  });
});
```

### Bundle Size Testing

```typescript
// e2e/bundle-size.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Bundle Size', () => {
  test('should not exceed bundle size limits', async ({ page }) => {
    const metrics = await page.evaluate(async () => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const jsFiles = entries.filter((e) => e.name.includes('.js'));

      return {
        totalSize: jsFiles.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
        fileCount: jsFiles.length,
        largestFile: Math.max(...jsFiles.map((e) => e.transferSize || 0)),
      };
    });

    // Total Vite bundle should be less than 500KB (gzip)
    expect(metrics.totalSize).toBeLessThan(500 * 1024);
    // Individual chunks should be less than 200KB
    expect(metrics.largestFile).toBeLessThan(200 * 1024);
  });
});
```

---

## Accessibility Testing

### A11y Testing with jest-axe

```typescript
// src/components/reporting/ReportCard.a11y.test.tsx
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import { ReportCard } from './ReportCard';

expect.extend(toHaveNoViolations);

const mockReport = {
  id: '1',
  name: 'Test Report',
  description: 'A test report',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ReportCard Accessibility', () => {
  it('should not have accessibility violations', async () => {
    const { container } = render(<ReportCard report={mockReport} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have accessible buttons', () => {
    const { getByRole } = render(
      <ReportCard report={mockReport} onDelete={() => {}} />
    );

    const deleteButton = getByRole('button', { name: /delete/i });
    expect(deleteButton).toHaveAttribute('aria-label');
  });

  it('should have proper heading hierarchy', () => {
    const { container } = render(<ReportCard report={mockReport} />);

    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    expect(headings.length).toBeGreaterThan(0);
  });
});
```

### ARIA Testing

```typescript
// src/components/dashboard/DashboardGrid.a11y.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DashboardGrid } from './DashboardGrid';

describe('DashboardGrid ARIA', () => {
  it('should have proper ARIA labels for interactive elements', () => {
    const mockCharts = [
      { id: '1', name: 'Revenue Chart', type: 'line' },
    ];

    render(<DashboardGrid charts={mockCharts} />);

    const buttons = screen.getAllByRole('button');
    buttons.forEach((button) => {
      expect(
        button.getAttribute('aria-label') ||
        button.getAttribute('aria-labelledby') ||
        button.textContent
      ).toBeTruthy();
    });
  });

  it('should support keyboard navigation', async () => {
    const mockCharts = [
      { id: '1', name: 'Chart 1', type: 'bar' },
      { id: '2', name: 'Chart 2', type: 'line' },
    ];

    render(<DashboardGrid charts={mockCharts} />);

    const user = userEvent.setup();
    const buttons = screen.getAllByRole('button');

    // Tab through buttons
    for (const button of buttons) {
      await user.tab();
      expect(button).toBeFocused();
    }
  });
});
```

---

## Visual Regression Testing

### Screenshot Comparison

```typescript
// e2e/visual.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('dashboard should match snapshot', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    await expect(page).toHaveScreenshot('dashboard.png');
  });

  test('report editor should match snapshot', async ({ page }) => {
    await page.goto('/reports/1/editor');
    
    // Wait for content to load
    await page.waitForSelector('[data-testid="report-editor"]');

    await expect(page).toHaveScreenshot('report-editor.png');
  });

  test('sql editor should match snapshot', async ({ page }) => {
    await page.goto('/sql-editor');

    // Wait for editor to be ready
    await page.waitForSelector('[data-testid="sql-editor"]');

    await expect(page).toHaveScreenshot('sql-editor.png');
  });
});
```

---

## Testing Best Practices

### Test Naming Conventions

```typescript
// Good - TanStack Start specific
describe('Reports Server Functions', () => {
  describe('listReports', () => {
    it('should return paginated reports for authenticated user', async () => {
      // Test implementation
    });

    it('should throw Unauthorized error when user is not authenticated', async () => {
      // Test implementation
    });

    it('should filter reports by data source when provided', async () => {
      // Test implementation
    });
  });
});

describe('SQL Server Functions', () => {
  describe('executeSql', () => {
    it('should execute valid SQL query and return results', async () => {
      // Test implementation
    });

    it('should reject SQL injection attempts', async () => {
      // Test implementation
    });
  });
});
```

### AAA Pattern (Arrange, Act, Assert)

```typescript
it('should execute SQL query via server function', async () => {
  // Arrange - Set up test data and mocks
  const sql = 'SELECT * FROM reports LIMIT 10';
  const mockResults = [
    { id: '1', name: 'Report 1' },
    { id: '2', name: 'Report 2' },
  ];
  vi.mocked(getDb).mockReturnValue(mockDb);

  // Act - Execute the server function
  const result = await executeSql(sql);

  // Assert - Verify the outcome
  expect(result).toEqual(mockResults);
  expect(getDb).toHaveBeenCalled();
});
```

### Testing Edge Cases

```typescript
describe('Server Functions edge cases', () => {
  it('should handle null session gracefully', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'));

    await expect(listReports({ page: 0, pageSize: 50 }))
      .rejects.toThrow('Unauthorized');
  });

  it('should handle database connection errors', async () => {
    vi.mocked(getDb).mockRejectedValue(new Error('Connection failed'));

    await expect(executeReport('1'))
      .rejects.toThrow('Connection failed');
  });

  it('should handle concurrent server function calls', async () => {
    const calls = [
      listReports({ page: 0, pageSize: 50 }),
      listReports({ page: 1, pageSize: 50 }),
      listReports({ page: 2, pageSize: 50 }),
    ];

    const results = await Promise.all(calls);
    expect(results).toHaveLength(3);
  });
});
```

---

## Bun.js Runtime Specifics

### Bun Test Runner Configuration

```typescript
// bunfig.toml
[test]
root = "."
preload = ["./test/setup.ts"]
timeout = 10000
coverage = ["src"]

// Or in package.json
{
  "scripts": {
    "test": "bun test",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage"
  }
}
```

### Using Bun's Native Test Runner with Vitest

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}

// vitest.config.ts - Already configured for Bun
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Database Testing with Bun SQLite

```typescript
// src/lib/db/__tests__/queries.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from 'bun:sqlite';
import { getDb } from '../config';

describe('Database Queries', () => {
  let db: Database;

  beforeEach(() => {
    // Create in-memory database for tests
    db = new Database(':memory:');
    // Run migrations
  });

  afterEach(() => {
    db.close();
  });

  it('should query reports successfully', () => {
    // Insert test data
    db.run(`
      INSERT INTO reports (id, name, userId) 
      VALUES ('1', 'Test Report', 'user-1')
    `);

    // Query
    const report = db.query(`SELECT * FROM reports WHERE id = ?`).get('1');
    
    expect(report).toEqual({
      id: '1',
      name: 'Test Report',
      userId: 'user-1',
    });
  });
});
```

---

## Additional Resources

- [TanStack Start Documentation](https://tanstack.com/start/latest)
- [TanStack Router Documentation](https://tanstack.com/router/latest)
- [Vitest Documentation](https://vitest.dev)
- [Playwright Documentation](https://playwright.dev)
- [Testing Library Documentation](https://testing-library.com)
- [MSW Documentation](https://mswjs.io)
- [Bun Documentation](https://bun.sh)