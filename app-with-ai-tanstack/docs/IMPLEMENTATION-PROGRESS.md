# Auth/Workflow/Rules Engine Implementation Progress

**Date**: March 30, 2026
**Status**: Phase 1 (Foundation & Authentication) - In Progress

## Completed Work ✅

### Phase 1.1: Better Auth Core Configuration

**Location**: `packages/core/src/auth/`

Created the following files:

1. **auth.types.ts** - Type definitions for:
   - `AuthUser`, `AuthSession`
   - `UserRole` (admin, doctor, nurse, receptionist, billing, readonly)
   - `EntityOperation` (CREATE, READ, UPDATE, DELETE)
   - `PermissionCheck`, `UserContext`
   - `IAuthService` interface
   - `LoginCredentials`, `RegisterData`, `AuthOptions`

2. **better-auth.config.ts** - Better Auth configuration:
   - `createBetterAuth()` - Factory function to create auth instance
   - `DEFAULT_ROLES` - Role definitions with permissions
   - `ENTITY_PERMISSIONS` - Entity operation mappings
   - Email/password authentication
   - Social login providers (Google, Microsoft, GitHub)
   - Session configuration (7-day default)
   - Security settings (sameSite, secure cookies)
   - Rate limiting

3. **auth.service.ts** - Auth service implementation:
   - `AuthService` class implementing `IAuthService`
   - `login()` - Email/password authentication
   - `register()` - User registration with role assignment
   - `logout()` - Session invalidation
   - `getSession()` - Session validation
   - `hasRole()` - Role checking
   - `hasPermission()` - Permission checking (RBAC)
   - `assignRole()` / `removeRole()` - Role management
   - `getUserRoles()` - Get user's roles

4. **guards.types.ts** - Guard type definitions:
   - `SessionContext` - User session structure
   - `GuardResult` - Guard check result
   - `IGuard` - Guard interface
   - `GuardContext` - Context passed to guards
   - `AuthGuardOptions`, `RoleGuardOptions`, `PermissionGuardOptions`

5. **guards.ts** - Guard implementations:
   - `AuthGuard` - Session validation
   - `RoleGuard` - Role-based access control
   - `PermissionGuard` - Permission-based access control
   - `CombinedGuard` - Combine multiple guards
   - `PublicGuard` - Always allows access
   - `GuardFactory` - Factory for creating guards

6. **decorators.ts** - NestJS decorators:
   - `@Public()` - Mark route as public
   - `@Roles(...)` - Require specific roles
   - `@RequirePermission(entity, operation)` - Require permission
   - `@CurrentUser()` - Inject current user
   - `@CurrentSession()` - Inject current session

7. **session-helpers.ts** - Session utilities:
   - `extractSessionToken()` - Extract token from headers/cookies
   - `parseCookies()` - Parse cookie header
   - `formatSetCookie()` - Format Set-Cookie header
   - `getUserFromRequest()` - Get user from request headers

### Phase 1.2: Database Migrations

**Location**: `database/migrations/`

Created the following migration files:

1. **004_add_better_auth_tables.ts**:
   - `better_auth_users` table
   - `better_auth_sessions` table
   - `better_auth_accounts` table (for social login)
   - `better_auth_verification` table
   - Performance indexes

2. **005_add_workflow_rules_tables.ts**:
   - `sys_rule_definitions` table (JDM rules)
   - `sys_workflow_runs` table (workflow execution tracking)
   - Performance indexes
   - Check constraints for status and operations

3. **006_add_entity_workflow_columns.ts**:
   - Adds `workflow_status` column to all bus_* tables
   - Adds `workflow_run_id` reference
   - Adds `created_by` and `updated_by` audit columns
   - Creates performance indexes

4. **007_seed_roles_and_permissions.ts**:
   - Seeds default roles: admin, doctor, nurse, receptionist, billing, readonly
   - Role descriptions included

### Package Updates

**Updated**: `packages/core/package.json`
- Added `better-auth@^1.5.6` dependency
- Added `./auth` export path
- Updated build script to include auth module

**Updated**: `packages/core/src/index.ts`
- Added `export * from './auth';`

## In Progress 🚧

### Phase 1.3: NestJS Better Auth Integration

**Status**: Pending
**Location**: To be created in generated HMS or as templates

Required files:
- `src/modules/auth/auth.module.ts`
- `src/modules/auth/auth.controller.ts`
- `src/modules/auth/auth.service.ts` (wrapper)
- `src/modules/auth/guards/` - NestJS guard implementations
- `src/modules/auth/strategies/` - Auth strategies

### Phase 1.4: OData V4 Better Auth Integration

**Status**: Pending
**Location**: To be created in generated HMS or as templates

Required files:
- `src/auth/better-auth.ts`
- `src/middleware/auth.middleware.ts`
- `src/middleware/rbac.middleware.ts`

## Next Steps 📋

### Immediate (Phase 1 Completion)

1. **Build core package** to verify no compilation errors
2. **Create NestJS auth module** template
3. **Create OData V4 auth middleware** template
4. **Write unit tests** for auth service and guards
5. **Run migrations** on test database

### Phase 2: Workflow Interception (Trigger.dev)

1. Install `@trigger.dev/sdk`
2. Create `/trigger/entity-lifecycle-workflow.ts`
3. Update `BaseService` to trigger workflows
4. Create workflow monitoring APIs
5. Create workflow monitor UI

### Phase 3: Rules Engine (GoRules)

1. Install `@gorules/zen-engine` and `@gorules/jdm-editor`
2. Create ZenEngine service
3. Create rules management APIs
4. Create JDM Editor UI
5. Seed default HMS rules

### Phase 4: Template Updates & Hardening

1. Update all generator templates
2. Add comprehensive E2E tests
3. Implement circuit breakers
4. Update documentation

## Testing Strategy 🧪

### Unit Tests Needed

- ✅ Auth service (login, register, logout)
- ✅ Guards (auth, role, permission)
- ✅ RBAC permission checking
- ✅ Session helpers
- ⏳ Migration tests

### Integration Tests Needed

- ⏳ End-to-end authentication flow
- ⏳ Role-based access control
- ⏳ Permission-based access control
- ⏳ Session management
- ⏳ OAuth social login (if implemented)

### E2E Tests Needed

- ⏳ User login/logout
- ⏳ Role-restricted endpoints
- ⏳ Permission-restricted endpoints
- ⏳ Admin user access
- ⏳ Read-only user access

## Dependencies 🔗

### Installed

- ✅ `better-auth@^1.5.6`

### To Install

- ⏳ `@trigger.dev/sdk@^3.0`
- ⏳ `@gorules/zen-engine@^0.31+`
- ⏳ `@gorules/jdm-editor@^0.19+`
- ⏳ `@nestjs/common` (for NestJS stack)
- ⏳ `@thallesp/nestjs-better-auth` (for NestJS stack)

## Environment Variables 📝

### Required

```bash
# Better Auth
BETTER_AUTH_SECRET=<random-32-char-string>
BETTER_AUTH_URL=http://localhost:3000

# Trigger.dev (Phase 2)
TRIGGER_SECRET_KEY=<trigger-dev-secret>
TRIGGER_API_URL=http://localhost:8888
TRIGGER_PROJECT_ID=<project-id>

# Database (existing)
DATABASE_URL=postgresql://user:password@localhost:5432/hms_db
```

### Optional (Social Login)

```bash
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
MICROSOFT_CLIENT_ID=<microsoft-client-id>
MICROSOFT_CLIENT_SECRET=<microsoft-client-secret>
```

## Architecture Notes 🏗️

### Design Decisions

1. **Platform-Agnostic**: Core auth module works with both NestJS and OData V4
2. **Guard-Based**: Flexible guard system for authentication/authorization
3. **RBAC**: Role-based access control with granular permissions
4. **Session-Based**: Server-side sessions (more secure than JWT-only)
5. **Composable**: Guards can be combined (auth + role + permission)

### Integration Points

1. **NestJS Stack**: Use decorators (`@Roles()`, `@RequirePermission()`) + Guards
2. **OData V4 Stack**: Use middleware (`auth.middleware.ts`, `rbac.middleware.ts`)
3. **Both**: Use `AuthService` and `GuardFactory` from `@appwithai/core/auth`

## Migration Path 🔄

For existing APPWITHAI-generated projects:

1. **Run migrations** to add new tables and columns
2. **Install dependencies** (better-auth)
3. **Add auth module** (follow stack-specific guide)
4. **Configure environment variables**
5. **Update existing routes** to use guards/decorators
6. **Migrate existing users** to `better_auth_users` table
7. **Test thoroughly** before deploying to production

## Known Issues & Limitations ⚠️

1. **Knex Adapter**: Currently using a simple placeholder. Better Auth has official adapter support that needs to be integrated.
2. **Migration 006**: Dynamically adds columns to tables - needs testing on various entity structures.
3. **Social Login**: Not yet implemented (requires OAuth provider setup).
4. **2FA**: Not yet implemented (defined in types but not configured).

## Documentation 📚

### Created

- ✅ `docs/ARCHITECTURAL-DESIGN-AUTH-WORKFLOW-RULES.md` - Full architectural design
- ✅ `docs/IMPLEMENTATION-PROGRESS.md` - This document

### To Update

- ⏳ `docs/DEVELOPMENT.md` - Add auth/workflow/rules setup instructions
- ⏳ `CLAUDE.md` - Add new env vars and scripts
- ⏳ `docs/architecture.md` - Update with new components
- ⏳ `README.md` - Highlight new capabilities

## References 🔗

- [Better Auth Documentation](https://www.better-auth.com)
- [Trigger.dev Documentation](https://trigger.dev)
- [GoRules Documentation](https://gorules.com)
- [Compiere Application Dictionary Pattern](https://www.compiere.com)
- [Architectural Design Document](./ARCHITECTURAL-DESIGN-AUTH-WORKFLOW-RULES.md)

---

**Last Updated**: March 30, 2026
**Next Review**: After Phase 1 completion
