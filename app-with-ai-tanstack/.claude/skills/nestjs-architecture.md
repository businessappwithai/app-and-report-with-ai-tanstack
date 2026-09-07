# NestJS Architecture Skills

## Overview

This skill provides comprehensive architectural guidelines for building NestJS applications with Knex.js in the ERDwithAI project. This guide follows the latest NestJS 10+ standards and is specifically designed for the Bun.js runtime.

## Table of Contents

1. [Project Structure](#project-structure)
2. [Module Architecture](#module-architecture)
3. [Controller Patterns](#controller-patterns)
4. [Service Layer](#service-layer)
5. [Repository Pattern with Knex.js](#repository-pattern-with-knexjs)
6. [Middleware and Interceptors](#middleware-and-interceptors)
7. [Guards and Authentication](#guards-and-authentication)
8. [Pipes and Validation](#pipes-and-validation)
9. [Exception Handling](#exception-handling)
10. [Database Migrations](#database-migrations)
11. [Testing Strategies](#testing-strategies)
12. [Configuration Management](#configuration-management)
13. [OData Integration](#odata-integration)
14. [WebSocket Support](#websocket-support)
15. [Bun.js Runtime Specifics](#bunjs-runtime-specifics)

---

## Project Structure

### Standard NestJS Monorepo Structure

```
packages/backend/
├── src/
│   ├── modules/
│   │   ├── project/
│   │   │   ├── dto/
│   │   │   │   ├── create-project.dto.ts
│   │   │   │   ├── update-project.dto.ts
│   │   │   │   └── query-project.dto.ts
│   │   │   ├── entities/
│   │   │   │   └── project.entity.ts
│   │   │   ├── project.controller.ts
│   │   │   ├── project.service.ts
│   │   │   ├── project.repository.ts
│   │   │   ├── project.module.ts
│   │   │   └── project.spec.ts
│   │   ├── entity/
│   │   ├── relationship/
│   │   ├── generation/
│   │   └── auth/
│   ├── common/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── middleware/
│   │   ├── pipes/
│   │   └── interfaces/
│   ├── config/
│   │   ├── database.config.ts
│   │   ├── auth.config.ts
│   │   └── odata.config.ts
│   ├── database/
│   │   ├── knex/
│   │   │   ├── knexfile.ts
│   │   │   ├── migrations/
│   │   │   └── seeds/
│   │   └── knex.service.ts
│   ├── odata/
│   │   ├── odata.module.ts
│   │   ├── odata.server.ts
│   │   └── processors/
│   ├── app.module.ts
│   ├── app.controller.ts
│   ├── app.service.ts
│   └── main.ts
├── test/
│   ├── unit/
│   └── e2e/
├── nest-cli.json
├── tsconfig.json
└── package.json
```

### Key Architecture Principles

1. **Modular Organization**: Each feature in its own module
2. **Separation of Concerns**: Controllers, Services, Repositories separated
3. **Dependency Injection**: Leverage NestJS DI container
4. **Single Responsibility**: Each class has one clear purpose
5. **Type Safety**: Full TypeScript with strict mode

---

## Module Architecture

### Feature Module Structure

```typescript
// src/modules/project/project.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { ProjectRepository } from './project.repository';
import { DatabaseModule } from '@/database/database.module';

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [ProjectController],
  providers: [
    ProjectService,
    ProjectRepository,
    {
      provide: 'PROJECT_REPOSITORY',
      useClass: ProjectRepository,
    },
  ],
  exports: [ProjectService],
})
export class ProjectModule {}
```

### Global Module Pattern

```typescript
// src/common/logger/logger.module.ts
import { Module, Global } from '@nestjs/common';
import { LoggerService } from './logger.service';

@Global()
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
```

### Dynamic Module Pattern

```typescript
// src/common/database/database.module.ts
import { Module, DynamicModule } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Module({})
export class DatabaseModule {
  static register(options: DatabaseOptions): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        {
          provide: 'DATABASE_OPTIONS',
          useValue: options,
        },
        DatabaseService,
      ],
      exports: [DatabaseService],
    };
  }

  static forRoot(): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [DatabaseService],
      exports: [DatabaseService],
    };
  }
}
```

### Async Module Configuration

```typescript
// src/config/config.module.ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from './database.module';

@Module({
  imports: [
    DatabaseModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USER'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

---

## Controller Patterns

### Standard REST Controller

```typescript
// src/modules/project/project.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectDto } from './dto/query-project.dto';

@Controller('projects')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TransformInterceptor)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  async findAll(@Query() query: QueryProjectDto) {
    return this.projectService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createProjectDto: CreateProjectDto) {
    return this.projectService.create(createProjectDto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProjectDto: UpdateProjectDto
  ) {
    return this.projectService.update(id, updateProjectDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.remove(id);
  }
}
```

### Controller with Custom Decorators

```typescript
// src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserData {
  userId: string;
  email: string;
  roles: string[];
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserData | undefined, ctx: ExecutionContext): CurrentUserData | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUserData;

    return data ? user[data] : user;
  }
);

// Usage in controller
@Post()
async create(
  @Body() createProjectDto: CreateProjectDto,
  @CurrentUser('userId') userId: string
) {
  return this.projectService.create(createProjectDto, userId);
}
```

### Pagination Controller Pattern

```typescript
// src/common/decorators/pagination.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface PaginationDto {
  page: number;
  limit: number;
  offset: number;
}

export const Pagination = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): PaginationDto => {
    const request = ctx.switchToHttp().getRequest();
    const page = parseInt(request.query.page || '1', 10);
    const limit = parseInt(request.query.limit || '10', 10);
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }
);

// Usage
@Get()
async findAll(@Pagination() pagination: PaginationDto) {
  return this.projectService.findAll(pagination);
}
```

### File Upload Controller

```typescript
// src/modules/upload/upload.controller.ts
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('single')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'image/jpeg',
          'image/png',
          'application/pdf',
          'application/json',
        ];
        if (!allowedMimes.includes(file.mimetype)) {
          return cb(new BadRequestException('Invalid file type'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    })
  )
  async uploadSingle(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.saveFile(file);
  }

  @Post('multiple')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
    })
  )
  async uploadMultiple(@UploadedFiles() files: Express.Multer.File[]) {
    return this.uploadService.saveFiles(files);
  }
}
```

---

## Service Layer

### Standard Service Pattern

```typescript
// src/modules/project/project.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { ProjectRepository } from './project.repository';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectDto } from './dto/query-project.dto';
import { Project } from './entities/project.entity';

@Injectable()
export class ProjectService {
  constructor(private readonly projectRepository: ProjectRepository) {}

  async create(createProjectDto: CreateProjectDto, userId: string): Promise<Project> {
    // Check for duplicate
    const existing = await this.projectRepository.findByName(createProjectDto.name);
    if (existing) {
      throw new ConflictException('Project with this name already exists');
    }

    const project = await this.projectRepository.create({
      ...createProjectDto,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return project;
  }

  async findAll(query: QueryProjectDto): Promise<{ data: Project[]; total: number }> {
    return this.projectRepository.findAll(query);
  }

  async findOne(id: number): Promise<Project> {
    const project = await this.projectRepository.findOne(id);
    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }
    return project;
  }

  async update(id: number, updateProjectDto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(id);
    const updated = await this.projectRepository.update(id, {
      ...updateProjectDto,
      updatedAt: new Date(),
    });
    return updated;
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.projectRepository.remove(id);
  }
}
```

### Service with Events

```typescript
// src/modules/project/project.service.ts
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProjectCreatedEvent } from './events/project-created.event';

@Injectable()
export class ProjectService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async create(createProjectDto: CreateProjectDto): Promise<Project> {
    const project = await this.projectRepository.create(createProjectDto);

    // Emit event
    this.eventEmitter.emit(
      'project.created',
      new ProjectCreatedEvent(project.id, project.name)
    );

    return project;
  }
}

// Event handler
// src/modules/project/events/project-created.event.ts
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { ProjectCreatedEvent } from './project-created.event';

@EventsHandler(ProjectCreatedEvent)
export class ProjectCreatedHandler implements IEventHandler<ProjectCreatedEvent> {
  handle(event: ProjectCreatedEvent) {
    console.log(`Project created: ${event.projectId} - ${event.projectName}`);
    // Send notification, update cache, etc.
  }
}
```

### Caching Service

```typescript
// src/modules/project/project.service.ts
import { Injectable, CacheInterceptor, UseInterceptors, CacheTTL } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class ProjectService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache
  ) {}

  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60) // 60 seconds
  async findAll(query: QueryProjectDto) {
    return this.projectRepository.findAll(query);
  }

  async findOne(id: number) {
    // Check cache first
    const cacheKey = `project:${id}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    const project = await this.projectRepository.findOne(id);
    await this.cacheManager.set(cacheKey, project, 300); // 5 minutes

    return project;
  }

  async update(id: number, updateProjectDto: UpdateProjectDto) {
    const project = await this.projectRepository.update(id, updateProjectDto);

    // Invalidate cache
    await this.cacheManager.del(`project:${id}`);

    return project;
  }
}
```

---

## Repository Pattern with Knex.js

### Base Repository Interface

```typescript
// src/common/interfaces/repository.interface.ts
import { Knex } from 'knex';

export interface BaseRepository<T> {
  create(data: Partial<T>): Promise<T>;
  findOne(id: number | string): Promise<T | null>;
  findAll(filter?: any): Promise<T[]>;
  update(id: number | string, data: Partial<T>): Promise<T>;
  remove(id: number | string): Promise<void>;
  findWhere(condition: any): Promise<T[]>;
  exists(condition: any): Promise<boolean>;
  count(filter?: any): Promise<number>;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

### Base Repository Implementation

```typescript
// src/common/repositories/base.repository.ts
import { Knex } from 'knex';
import { BaseRepository, PaginatedResult, PaginationOptions } from '../interfaces/repository.interface';

export abstract class BaseRepositoryImpl<T> implements BaseRepository<T> {
  constructor(
    protected readonly knex: Knex,
    protected readonly tableName: string
  ) {}

  async create(data: Partial<T>): Promise<T> {
    const [result] = await this.knex(this.tableName)
      .insert(data)
      .returning('*');
    return result;
  }

  async findOne(id: number | string): Promise<T | null> {
    const result = await this.knex(this.tableName)
      .where('id', id)
      .first();
    return result || null;
  }

  async findAll(filter?: any): Promise<T[]> {
    let query = this.knex(this.tableName);

    if (filter) {
      query = this.applyFilters(query, filter);
    }

    return query.select('*');
  }

  async update(id: number | string, data: Partial<T>): Promise<T> {
    const [result] = await this.knex(this.tableName)
      .where('id', id)
      .update({ ...data, updated_at: this.knex.fn.now() })
      .returning('*');
    return result;
  }

  async remove(id: number | string): Promise<void> {
    await this.knex(this.tableName).where('id', id).delete();
  }

  async findWhere(condition: any): Promise<T[]> {
    return this.knex(this.tableName).where(condition).select('*');
  }

  async exists(condition: any): Promise<boolean> {
    const result = await this.knex(this.tableName)
      .where(condition)
      .first('id');
    return !!result;
  }

  async count(filter?: any): Promise<number> {
    let query = this.knex(this.tableName);

    if (filter) {
      query = this.applyFilters(query, filter);
    }

    const [result] = await query.count('* as count');
    return Number(result?.count || 0);
  }

  async paginate(options: PaginationOptions, filter?: any): Promise<PaginatedResult<T>> {
    const { page, limit, sort = 'created_at', order = 'desc' } = options;
    const offset = (page - 1) * limit;

    let query = this.knex(this.tableName);

    if (filter) {
      query = this.applyFilters(query, filter);
    }

    const [data, totalResult] = await Promise.all([
      query
        .clone()
        .select('*')
        .orderBy(sort, order)
        .limit(limit)
        .offset(offset),
      query.clone().count('* as count').first(),
    ]);

    const total = Number(totalResult?.count || 0);
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  protected applyFilters(query: Knex.QueryBuilder, filter: any): Knex.QueryBuilder {
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.where(key, value);
      }
    });
    return query;
  }

  async transaction<R>(callback: (trx: Knex.Transaction) => Promise<R>): Promise<R> {
    return this.knex.transaction(async (trx) => {
      return callback(trx);
    });
  }
}
```

### Specific Repository Implementation

```typescript
// src/modules/project/project.repository.ts
import { Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { BaseRepositoryImpl } from '@/common/repositories/base.repository';
import { Project } from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectDto } from './dto/query-project.dto';

@Injectable()
export class ProjectRepository extends BaseRepositoryImpl<Project> {
  constructor(@InjectKnex() knex: Knex) {
    super(knex, 'projects');
  }

  async findByName(name: string): Promise<Project | null> {
    return this.knex('projects')
      .where('name', name)
      .first();
  }

  async findByUserId(userId: string, options: PaginationOptions): Promise<PaginatedResult<Project>> {
    return this.paginate(options, { user_id: userId });
  }

  async findWithEntities(id: number): Promise<Project | null> {
    return this.knex('projects')
      .leftJoin('entities', 'projects.id', 'entities.project_id')
      .select(
        'projects.*',
        this.knex.raw('json_agg(entities.*) as entities')
      )
      .where('projects.id', id)
      .groupBy('projects.id')
      .first();
  }

  async search(searchTerm: string, options: PaginationOptions): Promise<PaginatedResult<Project>> {
    const { page, limit } = options;
    const offset = (page - 1) * limit;

    const query = this.knex('projects')
      .where('name', 'ilike', `%${searchTerm}%`)
      .orWhere('description', 'ilike', `%${searchTerm}%`);

    const [data, totalResult] = await Promise.all([
      query.clone()
        .select('*')
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset),
      query.clone().count('* as count').first(),
    ]);

    const total = Number(totalResult?.count || 0);
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async updateEntities(id: number, entityIds: number[]): Promise<void> {
    await this.transaction(async (trx) => {
      // Delete existing relationships
      await trx('project_entities')
        .where('project_id', id)
        .delete();

      // Insert new relationships
      if (entityIds.length > 0) {
        await trx('project_entities').insert(
          entityIds.map(entityId => ({
            project_id: id,
            entity_id: entityId,
          }))
        );
      }
    });
  }
}
```

### Complex Queries with Knex

```typescript
// Complex query examples
export class ProjectRepository extends BaseRepositoryImpl<Project> {
  // Join queries
  async findWithRelationships(id: number) {
    return this.knex('projects')
      .leftJoin('entities', 'projects.id', 'entities.project_id')
      .leftJoin('relationships', 'entities.id', 'relationships.source_entity_id')
      .select(
        'projects.id',
        'projects.name',
        'projects.description',
        this.knex.raw(`
          json_agg(
            distinct jsonb_build_object(
              'id', entities.id,
              'name', entities.name,
              'relationships', json_agg(
                jsonb_build_object(
                  'id', relationships.id,
                  'type', relationships.type
                )
              ) filter (where relationships.id is not null)
            )
          ) filter (where entities.id is not null) as entities
        `)
      )
      .where('projects.id', id)
      .groupBy('projects.id')
      .first();
  }

  // Aggregate queries
  async getProjectStats(userId: string) {
    return this.knex('projects')
      .where('user_id', userId)
      .select(
        this.knex.raw('count(*) as total'),
        this.knex.raw('count(*) filter (where created_at > now() - interval \'30 days\') as recent'),
        this.knex.raw('max(created_at) as last_created')
      )
      .first();
  }

  // Subquery
  async findProjectsWithEntityCount(options: PaginationOptions) {
    const { page, limit } = options;
    const offset = (page - 1) * limit;

    const entityCountSubquery = this.knex('entities')
      .select('project_id')
      .count('* as count')
      .groupBy('project_id')
      .as('entity_counts');

    const query = this.knex('projects')
      .leftJoin(entityCountSubquery, 'projects.id', 'entity_counts.project_id')
      .select(
        'projects.*',
        this.knex.raw('coalesce(entity_counts.count, 0) as entity_count')
      );

    const [data, totalResult] = await Promise.all([
      query.clone()
        .limit(limit)
        .offset(offset),
      this.knex('projects').count('* as count').first(),
    ]);

    const total = Number(totalResult?.count || 0);
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
```

---

## Middleware and Interceptors

### Logging Middleware

```typescript
// src/common/middleware/logger.middleware.ts
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { ip, method, originalUrl } = req;
    const userAgent = req.get('user-agent') || '';
    const startTime = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const contentLength = res.get('content-length');
      const responseTime = Date.now() - startTime;

      this.logger.log(
        `${method} ${originalUrl} ${statusCode} ${contentLength} - ${responseTime}ms - ${userAgent} ${ip}`
      );
    });

    next();
  }
}

// Apply in module
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('*');
  }
}
```

### CORS Middleware

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
```

### Response Transform Interceptor

```typescript
// src/common/interceptors/transform.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: any;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const request = context.switchToHttp().getRequest();
    const statusCode = context.switchToHttp().getResponse().statusCode;

    return next.handle().pipe(
      map((data) => ({
        success: statusCode < 400,
        data,
        message: data?.message,
        meta: {
          timestamp: new Date().toISOString(),
          path: request.url,
          statusCode,
        },
      }))
    );
  }
}
```

### Timeout Interceptor

```typescript
// src/common/interceptors/timeout.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(30000), // 30 seconds
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException());
        }
        return throwError(() => err);
      })
    );
  }
}
```

---

## Guards and Authentication

### JWT Authentication Guard

```typescript
// src/common/guards/jwt-auth.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token not found');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      request.user = payload;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    return true;
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
```

### Role-Based Access Control Guard

```typescript
// src/common/guards/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    const hasRole = requiredRoles.some((role) => user.roles?.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(
        `You do not have permission to access this resource. Required roles: ${requiredRoles.join(', ')}`
      );
    }

    return true;
  }
}

// Decorator
// src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// Usage
@Controller('projects')
export class ProjectController {
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'project-manager')
  async findAll() {
    return this.projectService.findAll();
  }
}
```

### Custom Permission Guard

```typescript
// src/common/guards/permission.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly caslAbilityFactory: CaslAbilityFactory
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<string[]>(
      PERMISSIONS_KEY,
      context.getHandler()
    );

    if (!requiredPermissions) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    const ability = this.caslAbilityFactory.createForUser(user);

    const hasPermission = requiredPermissions.every((permission) => {
      const [action, subject] = permission.split(':');
      return ability.can(action, subject);
    });

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
```

---

## Pipes and Validation

### DTO with class-validator

```typescript
// src/modules/project/dto/create-project.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ProjectType {
  WEB = 'web',
  MOBILE = 'mobile',
  DESKTOP = 'desktop',
}

export class CreateEntityDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}

export class CreateProjectDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ enum: ProjectType })
  @IsEnum(ProjectType)
  type: ProjectType;

  @ApiProperty({ type: [CreateEntityDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEntityDto)
  entities: CreateEntityDto[];

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  timeout?: number;
}
```

### Custom Validation Pipe

```typescript
// src/common/pipes/validation.pipe.ts
import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToInstance(metatype, value);
    const errors = await validate(object);

    if (errors.length > 0) {
      const messages = errors.map((error) => {
        return Object.values(error.constraints || {}).join(', ');
      });
      throw new BadRequestException({
        message: 'Validation failed',
        errors: messages,
      });
    }

    return value;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
```

### Custom Pipe for Transformations

```typescript
// src/common/pipes/parse-int.pipe.ts
import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';

@Injectable()
export class ParseIntPipe implements PipeTransform<string, number> {
  transform(value: string, metadata: ArgumentMetadata): number {
    const val = parseInt(value, 10);
    if (isNaN(val)) {
      throw new BadRequestException('Validation failed: "${value}" is not an integer');
    }
    return val;
  }
}

// Usage
@Get(':id')
async findOne(@Param('id', ParseIntPipe) id: number) {
  return this.projectService.findOne(id);
}
```

---

## Exception Handling

### Global Exception Filter

```typescript
// src/common/filters/all-exceptions.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message = typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any).message || message;
      details = typeof exceptionResponse === 'object'
        ? (exceptionResponse as any)
        : undefined;
    }

    const errorResponse = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      details: process.env.NODE_ENV === 'development' ? details : undefined,
    };

    this.logger.error(
      `${request.method} ${request.url} - ${status}`,
      exception instanceof Error ? exception.stack : exception
    );

    response.status(status).json(errorResponse);
  }
}

// Apply in main.ts
app.useGlobalFilters(new AllExceptionsFilter());
```

### Custom Business Exceptions

```typescript
// src/common/exceptions/business.exception.ts
import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(message: string, statusCode: HttpStatus = HttpStatus.BAD_REQUEST, details?: any) {
    super(
      {
        success: false,
        message,
        details,
        statusCode,
      },
      statusCode
    );
  }
}

// Specific exceptions
export class ProjectNotFoundException extends BusinessException {
  constructor(id: number) {
    super(`Project with ID ${id} not found`, HttpStatus.NOT_FOUND);
  }
}

export class DuplicateProjectException extends BusinessException {
  constructor(name: string) {
    super(`Project with name "${name}" already exists`, HttpStatus.CONFLICT);
  }
}

// Usage in service
throw new ProjectNotFoundException(id);
throw new DuplicateProjectException(name);
```

---

## Database Migrations

### Migration Structure with Knex

```typescript
// migrations/YYYYMMDDHHMMSS_create_projects_table.ts
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('projects', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable().unique();
    table.text('description').nullable();
    table.enum('type', ['web', 'mobile', 'desktop']).defaultTo('web');
    table.string('user_id', 255).notNullable().index();
    table.json('metadata').nullable();
    table.timestamps(true, true);

    // Foreign key
    table
      .foreign('user_id')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('projects');
}
```

### Complex Migration Example

```typescript
// migrations/YYYYMMDDHHMMSS_create_entities_and_relationships.ts
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create entities table
  await knex.schema.createTable('entities', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable();
    table.text('description').nullable();
    table.integer('project_id').unsigned().notNullable();
    table.json('attributes').nullable();
    table.timestamps(true, true);

    table
      .foreign('project_id')
      .references('id')
      .inTable('projects')
      .onDelete('CASCADE');

    table.index(['project_id', 'name']);
  });

  // Create relationships table
  await knex.schema.createTable('relationships', (table) => {
    table.increments('id').primary();
    table
      .integer('source_entity_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('entities')
      .onDelete('CASCADE');
    table
      .integer('target_entity_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('entities')
      .onDelete('CASCADE');
    table.enum('cardinality', ['1:1', '1:N', 'N:1', 'N:M']).notNullable();
    table.boolean('is_required').defaultTo(false);
    table.timestamps(true, true);

    table.unique(['source_entity_id', 'target_entity_id']);
    table.index(['source_entity_id']);
    table.index(['target_entity_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('relationships');
  await knex.schema.dropTableIfExists('entities');
}
```

### Migration with Data Seeding

```typescript
// migrations/YYYYMMDDHHMMSS_seed_initial_data.ts
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Insert default roles
  await knex('roles').insert([
    { name: 'admin', description: 'System administrator' },
    { name: 'user', description: 'Regular user' },
    { name: 'viewer', description: 'Read-only access' },
  ]);

  // Insert admin user
  await knex('users').insert([
    {
      email: 'admin@example.com',
      password_hash: await hash('admin123'),
      role_id: 1,
    },
  ]);
}

export async function down(knex: Knex): Promise<void> {
  await knex('users').where('email', 'admin@example.com').delete();
  await knex('roles').whereIn('name', ['admin', 'user', 'viewer']).delete();
}
```

---

## OData Integration

### OData Server Configuration

```typescript
// src/odata/odata.server.ts
import { ODataServer, ODataController, odata c, Edm } from 'odata-v4-server';
import { ProjectService } from '@/modules/project/project.service';

@ODataController
export class ProjectODataController {
  constructor(private readonly projectService: ProjectService) {}

  @OData
  @odata c.GET
  async findAll(@odata c.query query: any) {
    return this.projectService.findAll(query);
  }

  @OData
  @odata c.GET
  async findOne(@odata c.key key: string) {
    return this.projectService.findOne(parseInt(key));
  }

  @OData
  @odata c.POST
  async create(@odata c.body body: any) {
    return this.projectService.create(body);
  }

  @OData
  @odata c.PATCH
  async update(@odata c.key key: string, @odata c.body body: any) {
    return this.projectService.update(parseInt(key), body);
  }

  @OData
  @odata c.DELETE
  async remove(@odata c.key key: string) {
    return this.projectService.remove(parseInt(key));
  }
}

export class ProjectODataServer extends ODataServer {
  constructor() {
    super();
    this.controller(ProjectODataController);
  }
}
```

### OData Entity Model

```typescript
// src/odata/entities/project.entity.ts
import { Edm, edm } from 'odata-v4-server';

@Edm.EntityType
export class ProjectODataEntity {
  @Edm.Key
  @Edm.Int32
  id: number;

  @Edm.String
  name: string;

  @Edm.String
  @Edm.Nullable
  description: string;

  @Edm.EnumType
  type: string;

  @Edm.DateTimeOffset
  createdAt: Date;

  @Edm.DateTimeOffset
  updatedAt: Date;
}
```

---

## Bun.js Runtime Specifics

### NestJS Configuration for Bun

```typescript
// nest-cli.json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "webpack": false,
    "tsConfigPath": "tsconfig.json"
  }
}
```

### TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false,
    "esModuleInterop": true
  }
}
```

### Application Bootstrap

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  // Enable versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global filters and interceptors
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Enable CORS
  app.enableCors({
    origin: configService.get('CORS_ORIGIN') || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Start server
  const port = configService.get('PORT') || 3001;
  await app.listen(port);

  console.log(`Application is running on: http://localhost:${port}`);
}

bootstrap();
```

---

## Additional Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Knex.js Documentation](https://knexjs.org)
- [OData v4 Server Documentation](https://github.com/jaystack/odata-v4-server)
- [Bun.js Documentation](https://bun.sh/docs)