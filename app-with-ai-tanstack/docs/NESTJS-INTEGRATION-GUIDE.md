# NestJS Integration Guide - Auth, Workflow & Rules Engine

This guide shows how to integrate the Auth, Workflow, and Rules Engine modules from `@appwithai/core` into a NestJS backend.

## Target Project

**Generated Project**: `hospital-swiss-clean-new` (NestJS Backend)
**Location**: `/Users/pramodkoshy/projects/dynamic/test/app-with-ai/generated-projects/hospital-swiss-clean-new/backend`

---

## Prerequisites

1. Ensure you have the latest `@appwithai/core` package
2. Run database migrations for auth/workflow/rules tables
3. Set up environment variables

---

## Step 1: Install Dependencies

### Add to `package.json`

```json
{
  "dependencies": {
    "@appwithai/core": "workspace:*",
    "better-auth": "^1.5.6"
  }
}
```

### Install

```bash
cd /Users/pramodkoshy/projects/dynamic/test/app-with-ai/generated-projects/hospital-swiss-clean-new/backend
bun install
```

---

## Step 2: Environment Configuration

### Add to `.env`

```bash
# Better Auth
BETTER_AUTH_SECRET=your-32-character-secret-key-here
BETTER_AUTH_URL=http://localhost:3001

# Trigger.dev (for workflows)
TRIGGER_PROJECT_ID=your-project-id
TRIGGER_SECRET_KEY=your-secret-key
TRIGGER_API_URL=http://localhost:8888

# Feature Flags
ENABLE_WORKFLOW_ENGINE=true
ENABLE_RULES_ENGINE=true
```

---

## Step 3: Database Migrations

The following migrations should already exist in your `migrations/` directory from `@appwithai/core`:

- `004_add_better_auth_tables.ts`
- `005_add_workflow_rules_tables.ts`
- `006_add_entity_workflow_columns.ts`
- `007_seed_roles_and_permissions.ts`

Copy these migrations to your project:

```bash
cp /Users/pramodkoshy/projects/dynamic/test/app-with-ai/database/migrations/004_*.ts \
   /Users/pramodkoshy/projects/dynamic/test/app-with-ai/generated-projects/hospital-swiss-clean-new/backend/migrations/

cp /Users/pramodkoshy/projects/dynamic/test/app-with-ai/database/migrations/005_*.ts \
   /Users/pramodkoshy/projects/dynamic/test/app-with-ai/generated-projects/hospital-swiss-clean-new/backend/migrations/

cp /Users/pramodkoshy/projects/dynamic/test/app-with-ai/database/migrations/006_*.ts \
   /Users/pramodkoshy/projects/dynamic/test/app-with-ai/generated-projects/hospital-swiss-clean-new/backend/migrations/

cp /Users/pramodkoshy/projects/dynamic/test/app-with-ai/database/migrations/007_*.ts \
   /Users/pramodkoshy/projects/dynamic/test/app-with-ai/generated-projects/hospital-swiss-clean-new/backend/migrations/
```

Run migrations:

```bash
bun run migrate
```

---

## Step 4: Create Auth Module

### File: `src/modules/auth/auth.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
```

### File: `src/modules/auth/auth.service.ts`

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAuthService, type LoginCredentials, type RegisterData } from '@appwithai/core/auth';
import { getDatabase } from '@appwithai/core/services';

@Injectable()
export class AuthService {
  private authService;

  constructor(private configService: ConfigService) {
    this.authService = createAuthService({
      db: getDatabase(),
      secret: this.configService.get('BETTER_AUTH_SECRET')!,
      baseURL: this.configService.get('BETTER_AUTH_URL')!,
    });
  }

  async login(credentials: LoginCredentials) {
    return await this.authService.login(credentials);
  }

  async register(data: RegisterData) {
    return await this.authService.register(data);
  }

  async validateSession(sessionToken: string) {
    const session = await this.authService.getSession(sessionToken);
    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }
    return session;
  }

  async hasPermission(userId: string, entityName: string, operation: string) {
    return await this.authService.hasPermission(userId, entityName, operation as any);
  }

  async getUserRoles(userId: string) {
    return await this.authService.getUserRoles(userId);
  }
}
```

### File: `src/modules/auth/auth.controller.ts`

```typescript
import { Controller, Post, Body, Get, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    const session = await this.authService.login({
      email: body.email,
      password: body.password,
    });
    return session;
  }

  @Post('register')
  async register(@Body() body: { email: string; password: string; name: string }) {
    const session = await this.authService.register({
      email: body.email,
      password: body.password,
      name: body.name,
    });
    return session;
  }

  @UseGuards(AuthGuard)
  @Get('me')
  async getProfile(@Req() req) {
    return req.user;
  }

  @Post('logout')
  async logout(@Req() req) {
    // In production, invalidate session token
    return { success: true };
  }
}
```

### File: `src/modules/auth/guards/auth.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const sessionToken = this.extractToken(request);

    if (!sessionToken) {
      throw new UnauthorizedException('No session token provided');
    }

    try {
      const session = await this.authService.validateSession(sessionToken);
      request.user = session.user;
      request.session = session;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid session');
    }
  }

  private extractToken(request: any): string | undefined {
    // Try authorization header first
    const authHeader = request.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try cookie
    return request.cookies?.['better-auth.session_token'];
  }
}
```

### File: `src/modules/auth/guards/role.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    const userRoles = await this.authService.getUserRoles(user.id);
    return requiredRoles.some((role) => userRoles.includes(role));
  }
}
```

### File: `src/modules/auth/guards/permission.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const requiredPermission = this.reflector.get<string>('permission', context.getHandler());

    if (!user || !requiredPermission) {
      return false;
    }

    const [entityName, operation] = requiredPermission.split(':');
    const hasPermission = await this.authService.hasPermission(
      user.id,
      entityName,
      operation
    );

    return hasPermission.allowed;
  }
}
```

### Decorators: `src/modules/auth/decorators/roles.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

### Decorators: `src/modules/auth/decorators/permissions.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permission';
export const RequirePermission = (permission: string) =>
  SetMetadata(PERMISSION_KEY, permission);
```

---

## Step 5: Create Workflow Module

### File: `src/modules/workflow/workflow.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';

@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
```

### File: `src/modules/workflow/workflow.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWorkflowService } from '@appwithai/core/workflow';
import { getDatabase } from '@appwithai/core/services';

@Injectable()
export class WorkflowService {
  private workflowService;

  constructor(private configService: ConfigService) {
    const enabled = this.configService.get('ENABLE_WORKFLOW_ENGINE') === 'true';

    this.workflowService = createWorkflowService(getDatabase(), {
      projectId: this.configService.get('TRIGGER_PROJECT_ID') || '',
      apiKey: this.configService.get('TRIGGER_SECRET_KEY') || '',
      enabled,
    });
  }

  async triggerWorkflow(data: {
    entityName: string;
    entityId: string;
    operation: 'CREATE' | 'UPDATE' | 'DELETE';
    userId?: string;
  }) {
    return await this.workflowService.trigger({
      entityName: data.entityName,
      entityId: data.entityId,
      operation: data.operation,
      userId: data.userId,
      timestamp: new Date().toISOString(),
    });
  }

  async getWorkflowStatus(workflowRunId: string) {
    return await this.workflowService.getStatus(workflowRunId);
  }

  async completeWorkflow(workflowRunId: string, status: 'success' | 'error', error?: string) {
    return await this.workflowService.complete(workflowRunId, status, error);
  }

  async retryWorkflow(workflowRunId: string) {
    return await this.workflowService.retry(workflowRunId);
  }

  getService() {
    return this.workflowService;
  }
}
```

### File: `src/modules/workflow/workflow.controller.ts`

```typescript
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('workflows')
@UseGuards(AuthGuard)
export class WorkflowController {
  constructor(private workflowService: WorkflowService) {}

  @Get()
  async getWorkflows() {
    // Return all workflow runs
    const db = getDatabase();
    return await db('sys_workflow_runs')
      .orderBy('created_at', 'desc')
      .limit(100);
  }

  @Get(':id')
  async getWorkflow(@Param('id') id: string) {
    const db = getDatabase();
    return await db('sys_workflow_runs').where('id', id).first();
  }

  @Post(':id/retry')
  @Roles('admin')
  async retryWorkflow(@Param('id') id: string) {
    return await this.workflowService.retryWorkflow(id);
  }
}
```

---

## Step 6: Create Rules Module

### File: `src/modules/rules/rules.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RulesService } from './rules.service';
import { RulesController } from './rules.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [RulesController],
  providers: [RulesService],
  exports: [RulesService],
})
export class RulesModule {}
```

### File: `src/modules/rules/rules.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { createRulesEngineService } from '@appwithai/core/rules';
import { getDatabase } from '@appwithai/core/services';

@Injectable()
export class RulesService {
  private rulesEngine;

  constructor() {
    this.rulesEngine = createRulesEngineService(getDatabase());
  }

  async evaluateRule(entityName: string, operation: string, context: any) {
    const rule = await this.rulesEngine.getRule(entityName, operation as any);

    if (!rule) {
      return { success: true, mutations: {} };
    }

    return await this.rulesEngine.evaluate(rule.jdmContent, context);
  }

  async createRule(data: {
    entityName: string;
    ruleName: string;
    operation: string;
    jdmContent: any;
    userId?: string;
  }) {
    return await this.rulesEngine.createRule(
      data.entityName,
      data.ruleName,
      data.operation as any,
      data.jdmContent,
      data.userId
    );
  }

  async updateRule(ruleId: string, jdmContent: any) {
    return await this.rulesEngine.updateRule(ruleId, jdmContent);
  }

  async deleteRule(ruleId: string) {
    return await this.rulesEngine.deleteRule(ruleId);
  }

  async listRules(entityName?: string) {
    return await this.rulesEngine.listRules(entityName);
  }

  async validateRule(jdmContent: any) {
    return await this.rulesEngine.validateRule(jdmContent);
  }
}
```

### File: `src/modules/rules/rules.controller.ts`

```typescript
import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { RulesService } from './rules.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('rules')
@UseGuards(AuthGuard)
export class RulesController {
  constructor(private rulesService: RulesService) {}

  @Get()
  async getRules() {
    return await this.rulesService.listRules();
  }

  @Get(':id')
  async getRule(@Param('id') id: string) {
    const db = getDatabase();
    return await db('sys_rule_definitions').where('id', id).first();
  }

  @Post()
  @Roles('admin')
  async createRule(@Body() body: any) {
    return await this.rulesService.createRule(body);
  }

  @Put(':id')
  @Roles('admin')
  async updateRule(@Param('id') id: string, @Body() body: { jdmContent: any }) {
    return await this.rulesService.updateRule(id, body.jdmContent);
  }

  @Delete(':id')
  @Roles('admin')
  async deleteRule(@Param('id') id: string) {
    return await this.rulesService.deleteRule(id);
  }

  @Post('validate')
  async validateRule(@Body() body: { jdm: any }) {
    return await this.rulesService.validateRule(body.jdm);
  }
}
```

---

## Step 7: Update Existing Bus Service

### Modify `src/modules/bus/bus.service.ts`

Import and extend BaseService:

```typescript
import { Injectable } from '@nestjs/common';
import { BaseService } from '@appwithai/core/services';
import { getDatabase } from '@appwithai/core/services';
import { WorkflowService } from '../workflow/workflow.service';

@Injectable()
export class BusService extends BaseService<any> {
  protected entityName = 'bus_patient'; // or appropriate entity

  constructor(
    private workflowService: WorkflowService,
  ) {
    super();
    // Set workflow service
    this.setWorkflowService(workflowService.getService());
  }

  // Implement required abstract methods
  protected async performCreate(data: any): Promise<any> {
    const db = getDatabase();
    const [entity] = await db('bus_patient').insert(data).returning('*');
    return entity;
  }

  protected async performUpdate(id: string, data: any): Promise<any> {
    const db = getDatabase();
    const [entity] = await db('bus_patient')
      .where('id', id)
      .update(data)
      .returning('*');
    return entity;
  }

  protected async performDelete(id: string): Promise<void> {
    const db = getDatabase();
    await db('bus_patient').where('id', id).delete();
  }

  protected async performFindMany(filters?: any): Promise<any[]> {
    const db = getDatabase();
    return await db('bus_patient').where(filters || {});
  }

  protected async performFindOne(id: string): Promise<any> {
    const db = getDatabase();
    return await db('bus_patient').where('id', id).first();
  }
}
```

---

## Step 8: Update Bus Controller with Guards

### Modify `src/modules/bus/bus.controller.ts`

Add guards to protect routes:

```typescript
import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { BusService } from './bus.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';

@Controller('patients')
@UseGuards(AuthGuard)
export class BusController {
  constructor(private busService: BusService) {}

  @Get()
  @RequirePermission('Patient:READ')
  async findAll() {
    return await this.busService.findMany();
  }

  @Get(':id')
  @RequirePermission('Patient:READ')
  async findOne(@Param('id') id: string) {
    return await this.busService.findOne(id);
  }

  @Post()
  @RequirePermission('Patient:CREATE')
  async create(@Body() data: any) {
    return await this.busService.create(data);
  }

  @Put(':id')
  @RequirePermission('Patient:UPDATE')
  async update(@Param('id') id: string, @Body() data: any) {
    return await this.busService.update(id, data);
  }

  @Delete(':id')
  @Roles('admin', 'doctor')
  @RequirePermission('Patient:DELETE')
  async delete(@Param('id') id: string) {
    return await this.busService.delete(id);
  }
}
```

---

## Step 9: Update App Module

### Modify `src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BusModule } from './modules/bus/bus.module';
import { AuthModule } from './modules/auth/auth.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { RulesModule } from './modules/rules/rules.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BusModule,
    AuthModule,
    WorkflowModule,
    RulesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

---

## Step 10: Add User Context

### Create Middleware: `src/middleware/user-context.middleware.ts`

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: any;
      session?: any;
    }
  }
}

@Injectable()
export class UserContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // User will be set by AuthGuard
    // This middleware can inject user context into services
    next();
  }
}
```

---

## Testing the Integration

### 1. Test Auth

```bash
# Register
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hospital.com","password":"admin123","name":"Admin User"}'

# Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hospital.com","password":"admin123"}'
```

### 2. Test Rules

```bash
# Create a rule
curl -X POST http://localhost:3001/rules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{
    "entityName": "Patient",
    "ruleName": "Age Stratification",
    "operation": "CREATE",
    "jdmContent": {
      "name": "Age Stratification",
      "nodes": [{
        "id": "rule-1",
        "type": "decisionTable",
        "name": "Age Check",
        "content": {
          "inputs": ["entity.age"],
          "outputs": ["age_category"],
          "rules": [{
            "id": "r1",
            "condition": "entity.age < 18",
            "output": {"age_category": "pediatric"}
          }]
        }
      }]
    }
  }'
```

### 3. Test Workflows

```bash
# Create a patient (should trigger workflow)
curl -X POST http://localhost:3001/patients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "age": 25
  }'
```

---

## Benefits of Integration

1. **Authentication**: Users can log in and authenticate via Better Auth
2. **Authorization**: Role-based and permission-based access control
3. **Workflow Automation**: Automatic workflow triggering on CRUD operations
4. **Business Rules**: Dynamic business rules applied during entity lifecycle
5. **Audit Trail**: Created by/updated by tracking
6. **Admin Interface**: API endpoints for managing rules and monitoring workflows

---

## Next Steps

1. Add frontend integration (Next.js admin pages)
2. Set up Trigger.dev for actual background job processing
3. Add comprehensive error handling
4. Add logging and monitoring
5. Write unit and integration tests

---

**Generated**: March 30, 2026
**For**: APPWITHAI v5.1.0+
