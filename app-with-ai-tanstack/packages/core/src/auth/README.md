# Auth Module

Authentication and authorization module for APPWITHAI. Provides Better Auth integration, RBAC, and guards for both NestJS and OData V4 stacks.

## Features

- ✅ **Better Auth Integration**: Modern, session-based authentication
- ✅ **Role-Based Access Control (RBAC)**: Six predefined roles (admin, doctor, nurse, receptionist, billing, readonly)
- ✅ **Permission Guards**: Entity-level operation permissions (CREATE, READ, UPDATE, DELETE)
- ✅ **Platform Agnostic**: Works with both NestJS and OData V4 stacks
- ✅ **Flexible Guards**: Composable guard system for authentication/authorization
- ✅ **Session Management**: Secure server-side sessions with configurable expiry
- ✅ **Social Login Ready**: Support for Google, Microsoft, GitHub OAuth (optional)
- ✅ **NestJS Decorators**: Easy-to-use decorators for protecting endpoints

## Installation

The auth module is part of `@appwithai/core`. Dependencies are already installed.

```bash
bun add better-auth
```

## Quick Start

### 1. Initialize Auth Service

```typescript
import { createAuthService } from "@appwithai/core/auth";
import knex from "knex";

const db = knex({
  client: "pg",
  connection: process.env.DATABASE_URL,
});

const authService = createAuthService({
  db,
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,
});
```

### 2. Authenticate User

```typescript
// Login
const session = await authService.login({
  email: "user@example.com",
  password: "password123",
});

// Get user from request
import { getUserFromRequest, extractSessionToken } from "@appwithai/core/auth";

const token = extractSessionToken(request.headers);
const { user, session, error } = await getUserFromRequest(request.headers, authService);
```

### 3. Use Guards

```typescript
import { GuardFactory } from "@appwithai/core/auth";

const guardFactory = new GuardFactory(authService);

// Create authentication guard
const authGuard = guardFactory.auth();

// Create role guard
const roleGuard = guardFactory.role({
  roles: ["admin", "doctor"],
});

// Create permission guard
const permissionGuard = guardFactory.permission({
  entityName: "patient",
  operation: "CREATE",
});

// Combine guards
const combinedGuard = guardFactory.combined([authGuard, permissionGuard]);

// Check permission
const result = await combinedGuard.canProceed({
  sessionToken: token,
  entityName: "patient",
  operation: "CREATE",
});

if (result.granted) {
  // Proceed with request
  console.log("User:", result.user);
} else {
  // Deny access
  console.log("Reason:", result.reason);
}
```

### 4. NestJS Integration

```typescript
import { Controller, Get, UseGuards } from "@nestjs/common";
import { Roles, RequirePermission, CurrentUser } from "@appwithai/core/auth";
import { AuthGuard, RoleGuard, PermissionGuard } from "./guards";

@Controller("patients")
@UseGuards(AuthGuard)
export class PatientController {

  @Get()
  @Roles("admin", "doctor", "nurse")
  async findAll(@CurrentUser() user: User) {
    // Only accessible by users with admin, doctor, or nurse roles
    return this.patientService.findAll();
  }

  @Post()
  @RequirePermission("patient", "CREATE")
  async create(@CurrentUser() user: User, createDto: CreatePatientDto) {
    // Only accessible by users with CREATE permission on patient entity
    return this.patientService.create(createDto);
  }
}
```

### 5. OData V4 Integration

```typescript
import { authMiddleware } from "./middleware/auth.middleware";
import { rbacMiddleware } from "./middleware/rbac.middleware";

// Apply auth middleware to all OData routes
app.use("/odata/*", authMiddleware);

// Apply RBAC to specific entity sets
app.use("/odata/Patients", rbacMiddleware({
  entity: "patient",
  operation: "READ", // Default operation, can be overridden per method
}));
```

## Roles

### Predefined Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `admin` | Full system access | `*` (wildcard) |
| `doctor` | Clinical access | Patient CRUD, Appointment CRUD, Prescription CRUD |
| `nurse` | Clinical with limited edit | Patient read/update vitals, Appointment update, Prescription read |
| `receptionist` | Front desk | Patient create, Appointment CRUD, Invoice create |
| `billing` | Financial access | Invoice CRUD, Payment CRUD |
| `readonly` | Read-only access | `*:read` |

### Assigning Roles

```typescript
// Assign role to user
await authService.assignRole(userId, "doctor");

// Remove role from user
await authService.removeRole(userId, "doctor");

// Check if user has role
const hasRole = await authService.hasRole(userId, "doctor");
```

## Permissions

### Permission Structure

Permissions follow the pattern: `{entity}:{operation}`

- `patient:read` - Read patient records
- `patient:create` - Create new patient
- `patient:update` - Update patient
- `patient:delete` - Delete patient
- `*:read` - Read any entity (wildcard)

### Checking Permissions

```typescript
// Check permission
const permission = await authService.hasPermission(
  userId,
  "patient",  // entity name
  "CREATE"   // operation
);

if (permission.granted) {
  // User has permission
} else {
  // User lacks permission
  console.log("Reason:", permission.reason);
}
```

## Guards

### Available Guards

1. **AuthGuard** - Validates session token
2. **RoleGuard** - Checks if user has required role(s)
3. **PermissionGuard** - Checks if user has permission for entity operation
4. **CombinedGuard** - Combines multiple guards (AND logic)
5. **PublicGuard** - Always allows access (no authentication)

### Guard Factory

```typescript
const guardFactory = new GuardFactory(authService);

// Create guards
const authGuard = guardFactory.auth();
const roleGuard = guardFactory.role({ roles: ["admin"] });
const permissionGuard = guardFactory.permission({
  entityName: "patient",
  operation: "CREATE",
});
const publicGuard = guardFactory.public();

// Convenience methods
const authAndRole = guardFactory.authAndRole({
  roles: ["admin"],
});
const authAndPermission = guardFactory.authAndPermission({
  entityName: "patient",
  operation: "CREATE",
});
```

## Session Management

### Extract Session Token

```typescript
import { extractSessionToken } from "@appwithai/core/auth";

// From request headers
const token = extractSessionToken({
  authorization: "Bearer <token>",
  cookie: "better-auth.session_token=<token>",
  "x-session-token": "<token>",
});
```

### Get User from Request

```typescript
import { getUserFromRequest } from "@appwithai/core/auth";

const { user, session, error } = await getUserFromRequest(
  request.headers,
  authService
);

if (user) {
  console.log("Authenticated user:", user);
} else {
  console.log("Error:", error);
}
```

## Database Schema

### Better Auth Tables

- `better_auth_users` - User accounts
- `better_auth_sessions` - Active sessions
- `better_auth_accounts` - OAuth provider accounts
- `better_auth_verification` - Email verification & password reset tokens

### Workflow Tables

- `sys_rule_definitions` - JDM rules per entity
- `sys_workflow_runs` - Workflow execution tracking

### Entity Tables

All `bus_*` tables gain:
- `workflow_status` - none, draft, success, error
- `workflow_run_id` - Reference to workflow run
- `created_by` - User who created the record
- `updated_by` - User who last updated the record

## Environment Variables

```bash
# Required
BETTER_AUTH_SECRET=<random-32-char-string>
BETTER_AUTH_URL=http://localhost:3000
DATABASE_URL=postgresql://user:password@localhost:5432/hms_db

# Optional (Social Login)
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
MICROSOFT_CLIENT_ID=<microsoft-client-id>
MICROSOFT_CLIENT_SECRET=<microsoft-client-secret>
```

## API Reference

### AuthService

| Method | Description |
|--------|-------------|
| `login(credentials)` | Authenticate with email/password |
| `register(data)` | Create new user account |
| `logout(sessionToken)` | Invalidate session |
| `getSession(sessionToken)` | Validate session token |
| `hasRole(userId, roles)` | Check if user has role(s) |
| `hasPermission(userId, entity, operation)` | Check permission |
| `assignRole(userId, role)` | Assign role to user |
| `removeRole(userId, role)` | Remove role from user |
| `getUserRoles(userId)` | Get user's roles |

### Guards

| Guard | Purpose |
|-------|---------|
| `AuthGuard` | Validate session |
| `RoleGuard` | Require role(s) |
| `PermissionGuard` | Require permission |
| `CombinedGuard` | Combine multiple guards |
| `PublicGuard` | No authentication required |

### NestJS Decorators

| Decorator | Purpose |
|----------|---------|
| `@Public()` | Mark route as public |
| `@Roles(...)` | Require role(s) |
| `@RequirePermission(entity, operation)` | Require permission |
| `@CurrentUser()` | Inject authenticated user |
| `@CurrentSession()` | Inject session |

## Migration Guide

### From JWT-Only Auth

1. **Run migrations** to add Better Auth tables
2. **Install dependency**: `bun add better-auth`
3. **Initialize auth service** with database connection
4. **Replace JWT guards** with `AuthGuard`
5. **Update controllers** to use `@CurrentUser()` decorator
6. **Migrate existing users** to `better_auth_users` table
7. **Update frontend** to use session-based auth

### Example Migration

**Before (JWT)**:
```typescript
@UseGuards(JwtAuthGuard)
@Controller("patients")
export class PatientController {
  @Get()
  findAll(@Request() req) {
    return this.patientService.findAll();
  }
}
```

**After (Better Auth)**:
```typescript
@UseGuards(AuthGuard)
@Controller("patients")
export class PatientController {
  @Get()
  findAll(@CurrentUser() user: User) {
    return this.patientService.findAll();
  }
}
```

## Testing

### Unit Tests

```typescript
import { AuthService } from "@appwithai/core/auth";

describe("AuthService", () => {
  it("should authenticate valid credentials", async () => {
    const session = await authService.login({
      email: "test@example.com",
      password: "password123",
    });
    expect(session).toBeDefined();
    expect(session.user).toBeDefined();
  });
});
```

### Integration Tests

```typescript
import request from "supertest";
import { app } from "./app";

describe("Authentication (e2e)", () => {
  it("should login and access protected route", async () => {
    // Login
    const loginRes = await request(app)
      .post("/api/auth/sign-in/email")
      .send({
        email: "admin@hospital.com",
        password: "password123",
      });

    expect(loginRes.status).toBe(200);

    // Access protected route
    const protectedRes = await request(app)
      .get("/api/patients")
      .set("Authorization", `Bearer ${loginRes.body.session.token}`);

    expect(protectedRes.status).toBe(200);
  });
});
```

## Troubleshooting

### Common Issues

**Issue**: "INVALID_SESSION" error
- **Solution**: Check that session token is being sent correctly in Authorization header

**Issue**: "NO_SESSION_TOKEN" error
- **Solution**: Ensure request includes Authorization header or cookie

**Issue**: "INSUFFICIENT_ROLE" error
- **Solution**: Check that user has been assigned required role in ad_user_roles table

**Issue**: "NO_TABLE_ACCESS" error
- **Solution**: Ensure ad_access record exists for user's role and entity

## Contributing

When adding new features to the auth module:

1. Update types in `auth.types.ts`
2. Update `auth.service.ts` to implement new methods
3. Add guards if needed
4. Update this README
5. Add unit tests
6. Update architectural design document

## License

MIT

---

**See Also**:
- [Architectural Design Document](../../docs/ARCHITECTURAL-DESIGN-AUTH-WORKFLOW-RULES.md)
- [Implementation Progress](../../docs/IMPLEMENTATION-PROGRESS.md)
- [Better Auth Documentation](https://www.better-auth.com)
