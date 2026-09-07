---
name: appwithai-core
description: Core business logic, types, hooks, RBAC, validation, and utilities for APPWITHAI
---

# @appwithai/core Skill

This skill provides guidance for working with the core package of APPWITHAI, which contains all shared business logic, types, hooks, RBAC definitions, validation schemas, and utilities.

## Package Overview

The core package is the foundation of APPWITHAI and is used by all other packages. It provides:

- **Dictionary Types**: AD_Table, AD_Column, AD_Window, AD_Tab, AD_Field definitions
- **RBAC Types**: AD_User, AD_Role, AD_Access for role-based access control
- **Hook System**: Registry, Executor, Builder for lifecycle hooks
- **Base Services**: Abstract service classes with automatic hook execution
- **Validation**: Zod schemas for entity validation
- **Utilities**: Naming conventions, formatting helpers

## Directory Structure

```
packages/core/
├── src/
│   ├── types/
│   │   ├── entity.types.ts      # Entity, EntityAttribute, EntityDefinition
│   │   ├── dictionary.types.ts  # AD_Table, AD_Column, etc.
│   │   ├── rbac.types.ts        # AD_User, AD_Role, AD_Access
│   │   └── hook.types.ts        # Hook, HookContext, HookLifecycle
│   ├── hooks/
│   │   ├── hook-registry.ts     # Global hook registry
│   │   ├── hook-executor.ts     # Hook execution engine
│   │   └── hook-builder.ts      # Fluent hook builder API
│   ├── services/
│   │   ├── base.service.ts      # Abstract base service with hooks
│   │   └── entity.service.ts    # Entity CRUD service
│   ├── validation/
│   │   └── entity.validation.ts # Zod validation schemas
│   └── utils/
│       ├── naming.ts            # pascalCase, camelCase, snakeCase, etc.
│       └── formatting.ts        # Type formatting utilities
└── package.json
```

## Key Concepts

### Entity Types

```typescript
import { Entity, EntityAttribute, Relationship } from '@appwithai/core';

const userEntity: Entity = {
  name: 'User',
  tableName: 'users',
  description: 'System users',
  attributes: [
    { name: 'id', type: 'string', required: true, unique: true },
    { name: 'email', type: 'string', required: true, unique: true },
    { name: 'name', type: 'string', required: true }
  ],
  primaryKey: 'id',
  timestamps: true
};
```

### Hook System

The hook system allows intercepting entity lifecycle events:

```typescript
import { globalHookRegistry, HookExecutor } from '@appwithai/core/hooks';

// Register a hook
globalHookRegistry.register({
  id: 'audit-log',
  entity: 'User',
  lifecycle: 'afterCreate',
  execute: async (context) => {
    console.log(`User created: ${context.data.id}`);
    return context.data;
  }
});
```

### Base Service Pattern

All services should extend BaseService to get automatic hook execution:

```typescript
import { BaseService } from '@appwithai/core/services';

class UserService extends BaseService<User> {
  protected entityName = 'User';
  
  protected async performCreate(data: Partial<User>): Promise<User> {
    // Implementation - hooks are called automatically
  }
}
```

## Building the Package

```bash
# Build only core
bun run build:core

# Watch mode
cd packages/core && bun run dev
```

## Dependencies

- **zod**: ^3.22.4 - Schema validation
- **typescript**: ^5.3.3 - Type definitions

## Common Tasks

### Adding a New Entity Type

1. Define the interface in `src/types/entity.types.ts`
2. Add Zod schema in `src/validation/entity.validation.ts`
3. Export from `src/types/index.ts`

### Adding a New Utility Function

1. Add function to appropriate file in `src/utils/`
2. Export from `src/utils/index.ts`
3. Ensure it's available via `@appwithai/core/utils`

### Creating a New Service

1. Create file in `src/services/`
2. Extend `BaseService<T>`
3. Implement `performCreate`, `performUpdate`, `performDelete`
4. Export from `src/services/index.ts`

## Exports

The package provides these subpath exports:

- `@appwithai/core` - Main entry point
- `@appwithai/core/types` - Type definitions
- `@appwithai/core/hooks` - Hook system
- `@appwithai/core/services` - Service classes
- `@appwithai/core/utils` - Utility functions

## Testing

```bash
cd packages/core
bun test
```
