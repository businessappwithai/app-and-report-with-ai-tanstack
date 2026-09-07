# Two-Phase App Generation Architecture

## Overview

The app generator now uses a **two-phase approach** to create production-ready applications:

### Phase 1: Official CLI Scaffolding
- Uses official project scaffolding tools to create base project structure
- NestJS: `nest new` command for backend scaffolding
- TanStack Start: `bun create tanstack-start` for frontend scaffolding
- Ensures best practices and up-to-date configurations from framework authors

### Phase 2: Template Overlay
- Custom Handlebars templates are applied on top of the scaffolded base
- Generates domain-specific code based on ERD entities and relationships
- Adds Compiere-style Application Dictionary infrastructure
- Integrates hooks system, business rules, workflows, etc.

## Benefits

1. **Framework Best Practices**: Base scaffolding follows official framework standards
2. **Latest Dependencies**: Uses latest stable versions of frameworks
3. **Customization**: Your templates add domain logic without fighting framework conventions
4. **Maintainability**: Easier to upgrade frameworks as they evolve
5. **Developer Experience**: Generated projects feel like they were hand-crafted
6. **Integration**: All development tools, scripts, and configs come from official sources

## Backend Generation (NestJS)

### Phase 1: NestJS CLI Scaffolding
```bash
bun create nest my-project --package-manager bun --skip-git
```

Creates:
- `src/main.ts` - Bootstrap file
- `src/app.module.ts` - Root module
- `src/` - Base project structure
- `package.json` - Dependencies
- `tsconfig.json` - TypeScript configuration
- `.eslintrc.cjs` - Linting configuration
- Other configuration files

### Phase 2: Template Overlay

Our generator overlays:

**Core Infrastructure**
```
src/
├── modules/
│   ├── sys/           # Application Dictionary (sys_ tables)
│   ├── bus/           # Business entities (bus_ tables)
│   ├── auth/          # Authentication & Authorization
│   ├── hooks/         # Business hook system
│   ├── rules/         # Business rules engine
│   ├── workflow/      # Workflow orchestration
│   ├── jobs/          # Job queue management
│   └── modules.ts     # Generated module registry
├── database/
│   ├── database.module.ts      # Database connections
│   ├── database.service.ts     # Query builder service
│   └── database.constants.ts
├── common/
│   ├── decorators/    # @Etag, @Public, @Roles, etc.
│   ├── filters/       # HTTP exception filters
│   ├── guards/        # JWT, Session, Roles guards
│   ├── interceptors/  # Request/response transforms
│   └── pipes/         # Validation pipes
└── config/            # Feature configuration
```

**Generated Entity-Specific Code**
```
src/
├── migrations/        # Database schema migrations
├── seeds/             # Test data seeding
├── trigger/           # Trigger.dev integration
└── modules/rules/jdm/ # JDM rules per entity
```

**Configuration Files**
```
├── migrate.ts         # Kysely migration runner
├── .env.example       # Environment template
├── .env               # Development environment
├── package.json       # Updated dependencies (merged)
└── vitest.config.ts   # Testing configuration
```

### Directory Structure After Generation

```
backend/
├── src/
│   ├── main.ts                    # [NestJS CLI]
│   ├── app.module.ts              # [NestJS CLI] + [Template]
│   ├── app.controller.ts          # [NestJS CLI]
│   ├── app.service.ts             # [NestJS CLI]
│   ├── modules/
│   │   ├── sys/                   # [Template]
│   │   ├── bus/                   # [Template]
│   │   ├── auth/                  # [Template]
│   │   ├── hooks/                 # [Template]
│   │   ├── rules/                 # [Template]
│   │   └── ...
│   └── ...
├── migrations/                    # [Template]
├── seeds/                         # [Template]
├── test/                          # [NestJS CLI] + [Template]
├── package.json                   # [Merged]
├── tsconfig.json                  # [Template]
├── migrate.ts                     # [Template] Kysely migration runner
├── vitest.config.ts               # [Template]
└── ...
```

## Frontend Generation (TanStack Start)

### Phase 1: TanStack Start CLI Scaffolding
```bash
bun create tanstack-start@latest my-project --yes
```

Creates:
- `src/routes/` - File-based routing structure
- `src/` - React component structure
- `package.json` - TanStack + React dependencies
- `vite.config.ts` - Vite configuration
- `tsconfig.json` - TypeScript configuration
- Other build and dev tools

### Phase 2: Template Overlay

Our generator overlays:

**Application Structure**
```
src/
├── routes/
│   ├── __root.tsx              # [Template] Root layout + providers
│   ├── index.tsx               # [Template] Redirect to projects/dashboard
│   ├── projects/
│   │   ├── index.tsx           # [Template] Projects list
│   │   └── $id/
│   │       ├── init.tsx        # [Template] Project initialization
│   │       ├── design.tsx      # [Template] ERD design & approval
│   │       ├── generate.tsx    # [Template] Code generation
│   │       ├── enhance/        # [Template] AI enhancements
│   │       └── deploy.tsx      # [Template] Deployment
│   └── api/
│       ├── copilotkit.ts       # [Template] CopilotKit endpoint
│       ├── projects/           # [Template] Project CRUD APIs
│       └── ...
├── components/
│   ├── ui/                     # [Template] Shadcn UI components
│   ├── forms/                  # [Template] Dynamic form builder
│   ├── tables/                 # [Template] Dynamic table viewer
│   ├── layout/                 # [Template] App layout & sidebar
│   ├── approval/               # [Template] Human-in-loop components
│   ├── code-agent/             # [Template] AI code assistant
│   └── ...
├── hooks/
│   ├── use-entities.ts         # [Template] Entity data fetching
│   ├── use-field-metadata.ts   # [Template] Field configuration
│   └── ...
├── lib/
│   ├── api-client.ts           # [Template] API client
│   ├── translations.tsx        # [Template] i18n utilities
│   ├── auth.ts                 # [Template] Auth client
│   └── ...
├── stores/
│   └── projectStore.ts         # [Template] Zustand state
├── i18n/
│   └── config.ts               # [Template] i18n setup
├── messages/
│   ├── en.json                 # [Template] English translations
│   └── de.json                 # [Template] German translations
└── ...
```

**Generated Entity Pages**
```
src/routes/projects/$id/
├── (entities)/
│   ├── [entity]/
│   │   ├── page.tsx            # [Template] Entity list page
│   │   └── $id/
│   │       └── page.tsx        # [Template] Entity detail page
│   └── ...
└── admin/
    ├── page.tsx                # [Template] Admin dashboard
    ├── fields/page.tsx         # [Template] Field layout editor
    ├── rules/page.tsx          # [Template] Business rules UI
    └── workflows/page.tsx      # [Template] Workflow monitoring
```

**Configuration Files**
```
├── vite.config.ts              # [TanStack Start] + [Custom]
├── tsconfig.json               # [Template]
├── tailwind.config.js          # [Template]
├── package.json                # [Merged]
├── vitest.config.ts            # [Template]
├── playwright.config.ts        # [Template]
├── .env.local                  # [Template] with VITE_* variables
└── ...
```

### Directory Structure After Generation

```
frontend/
├── src/
│   ├── routes/                 # [TanStack Start] + [Template]
│   ├── components/             # [Template]
│   ├── hooks/                  # [Template]
│   ├── stores/                 # [Template]
│   ├── lib/                    # [Template]
│   ├── i18n/                   # [Template]
│   └── ...
├── e2e/                        # [Template] E2E tests
├── test/                       # [Template] Unit tests
├── public/                     # [TanStack Start]
├── package.json                # [Merged]
├── vite.config.ts              # [Template]
├── tsconfig.json               # [Template]
├── vitest.config.ts            # [Template]
├── playwright.config.ts        # [Template]
└── ...
```

## Configuration Merging Strategy

When a config file exists from the CLI scaffold, the template version:

1. **Completely replaces** if it's generated entirely by template (e.g., `knexfile.ts`, migration files)
2. **Is intelligently merged** if it's shared (e.g., `package.json`, `tsconfig.json`)
3. **Enhances gracefully** if template is optional (e.g., custom ESLint rules)

### Example: package.json Merging

**Step 1: CLI Scaffold Creates**
```json
{
  "name": "backend",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0"
  }
}
```

**Step 2: Template Rendering Prepares**
```json
{
  "name": "backend",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/fastify": "^10.0.0",
    "kysely": "^0.27.0",
    "better-auth": "^0.21.0"
  },
  "scripts": {
    "start": "node dist/main",
    "start:dev": "nest start --watch",
    "build": "nest build",
    "migrate": "bun run migrate",
    "seed": "bun run seed"
  }
}
```

**Result: Merged package.json**
```json
{
  "name": "backend",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/fastify": "^10.0.0",
    "kysely": "^0.27.0",
    "better-auth": "^0.21.0"
  },
  "scripts": {
    "start": "node dist/main",
    "start:dev": "nest start --watch",
    "build": "nest build",
    "migrate": "bun run migrate",
    "seed": "bun run seed"
  }
}
```

## Generated Code Characteristics

### Phase 1 Output (Framework Scaffolding)
- Minimal, clean project structure
- Framework conventions and best practices
- Standard configuration files
- Build/dev tooling setup
- Package manager integration

### Phase 2 Output (Template Overlay)
- Entity-driven code generation
- Domain-specific modules and services
- Application Dictionary infrastructure
- Business logic patterns (hooks, rules, workflows)
- E2E test scaffolding
- Development helper utilities

## Error Handling

### If Phase 1 Fails
- Generator continues with manual directory creation
- Templates still apply correctly
- Project is functional but missing CLI optimizations

### If Phase 2 Fails
- User has a working framework scaffold from Phase 1
- Can manually adjust templates if needed
- Can regenerate Phase 2 with corrections

## Customization Points

### Before Phase 1
1. Modify `NestJsBackendGenerator.scaffoldNestJsProject()` for NestJS options
2. Modify `TanStackFrontendGenerator.scaffoldTanStackProject()` for TanStack options
3. Pass custom CLI arguments

### During Phase 2
1. Create/modify templates in `packages/generator/templates/`
2. Update template context in `prepareContext()` methods
3. Add new generation methods following existing patterns

### After Generation
1. All generated files are your code - modify freely
2. Run `nest new` / `bun create tanstack-start` separately to compare
3. Use framework CLIs for additional scaffolding (e.g., `nest generate`)

## Migration from Single-Phase

If you were using the old single-phase generation:

1. **No breaking changes** - all templates remain compatible
2. **Install requirements**:
   - NestJS CLI: `npm install -g @nestjs/cli` (or use `bunx`)
   - TanStack Start: Available via `bun create tanstack-start`
3. **Re-run generation** - will use new two-phase approach
4. **Compare outputs** - check if you prefer the new structure

## Performance

### Generation Time
- Phase 1 (CLI): 2-5 minutes (one-time dependency installation)
- Phase 2 (Templates): 10-30 seconds (depends on entity count)

### Disk Space
- Backend: ~200MB (node_modules included)
- Frontend: ~300MB (node_modules included)

### Optimization Tips
- Use `--skip-install` equivalent if available (Phase 2 installs are minimal)
- Run phase 1 and 2 in parallel for multiple projects
- Cache installed dependencies between generations

## Troubleshooting

### NestJS CLI not found
```bash
# Install globally
npm install -g @nestjs/cli

# Or use bunx (automatic)
bunx nest new project-name
```

### TanStack Start creation hangs
- Increase timeout in `CliExecutor.executeAsync()` calls
- Check network connectivity for npm registry
- Try running `bun create tanstack-start` manually first

### Configuration conflicts
- Template configs intentionally override CLI defaults
- If you need CLI behavior, edit generated files post-generation
- Submit enhancement requests for conflicting configurations

### Generated code differs from expectations
- Check template files in `packages/generator/templates/`
- Verify ERD entities and relationships are correct
- Review template context in `prepareContext()` methods

## Future Enhancements

Potential improvements to the two-phase approach:

1. **OpenUI5/OData Stack**: Add similar scaffolding for `openui5-odatav4` stack
2. **Configuration Merging**: More intelligent package.json and config merging
3. **Incremental Generation**: Support re-running generation on existing projects
4. **Template Customization**: Allow user-provided template directories
5. **Performance**: Parallel execution of Phase 1 CLI scaffolding
6. **Caching**: Cache npm/bun installs between generations

## References

- [NestJS CLI Documentation](https://docs.nestjs.com/cli/overview)
- [TanStack Start Documentation](https://tanstack.com/start)
- [Generator Architecture](./../../docs/architecture.md)
- [Template System](./templates/README.md)
