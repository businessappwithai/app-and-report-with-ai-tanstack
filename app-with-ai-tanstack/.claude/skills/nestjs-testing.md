# NestJS API Testing Skills

## Overview

This skill provides comprehensive testing guidelines for NestJS applications with Knex.js in the ERDwithAI project. This guide covers unit testing, integration testing, E2E testing, and is designed for the Bun.js runtime.

## Table of Contents

1. [Testing Strategy](#testing-strategy)
2. [Testing Setup](#testing-setup)
3. [Unit Testing](#unit-testing)
4. [Controller Testing](#controller-testing)
5. [Service Testing](#service-testing)
6. [Repository Testing](#repository-testing)
7. [Integration Testing](#integration-testing)
8. [E2E Testing](#e2e-testing)
9. [Testing with Knex.js](#testing-with-knexjs)
10. [Mocking and Stubs](#mocking-and-stubs)
11. [Testing Best Practices](#testing-best-practices)
12. [Bun.js Runtime Specifics](#bunjs-runtime-specifics)

---

## Testing Strategy

### Testing Pyramid for NestJS

```
                /\
               /  \
              / E2E \
             /______\
            /        \
           /Integration\
          /__________\
         /            \
        /   Unit Tests \
       /______________\
```

- **Unit Tests (70%)**: Isolated tests for services, repositories, utilities
- **Integration Tests (20%)**: Tests for controllers with mocked services
- **E2E Tests (10%)**: Full HTTP request/response tests

### Test File Organization

```
packages/backend/
├── src/
│   ├── modules/
│   │   ├── project/
│   │   │   ├── project.controller.ts
│   │   │   ├── project.service.ts
│   │   │   ├── project.repository.ts
│   │   │   ├── project.controller.spec.ts
│   │   │   ├── project.service.spec.ts
│   │   │   └── project.repository.spec.ts
│   │   └── ...
│   └── common/
│       └── ...
├── test/
│   ├── unit/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   └── pipes/
│   ├── integration/
│   │   └── modules/
│   └── e2e/
│       ├── project.e2e-spec.ts
│       ├── auth.e2e-spec.ts
│       └── app.e2e-spec.ts
└── jest.config.js
```

---

## Testing Setup

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.(spec|e2e-spec)\\.(ts|js)$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.interface.ts',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/', '<rootDir>/test/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^test/(.*)$': '<rootDir>/test/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  globalSetup: '<rootDir>/test/global-setup.ts',
  globalTeardown: '<rootDir>/test/global-teardown.ts',
  testTimeout: 10000,
};
```

### Test Setup File

```typescript
// test/setup.ts
import { Test } from '@nestjs/testing';

// Global test utilities
global.mockDate = new Date('2024-01-15T10:30:00Z');

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error to see actual errors
  // error: jest.fn(),
};

// Set default timeout
jest.setTimeout(10000);
```

### Global Setup and Teardown

```typescript
// test/global-setup.ts
export default async function globalSetup() {
  // Setup database for testing
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://localhost/test_db';

  // Run migrations
  const { execSync } = require('child_process');
  try {
    execSync('bun run migrate:latest', { stdio: 'inherit' });
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// test/global-teardown.ts
export default async function globalTeardown() {
  // Cleanup database
  const { execSync } = require('child_process');
  try {
    execSync('bun run migrate:rollback', { stdio: 'inherit' });
  } catch (error) {
    console.error('Rollback failed:', error);
  }
}
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest --testPathPatterns=test/unit",
    "test:integration": "jest --testPathPatterns=test/integration",
    "test:e2e": "jest --config jest-e2e.json",
    "test:ci": "jest --coverage --watchAll=false --ci"
  }
}
```

---

## Unit Testing

### Testing Utility Functions

```typescript
// src/common/utils/helpers.spec.ts
import { formatDate, generateId, slugify } from './helpers';

describe('Utility Functions', () => {
  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      expect(formatDate(date)).toBe('2024-01-15 10:30');
    });

    it('should handle null dates', () => {
      expect(formatDate(null)).toBe('N/A');
    });

    it('should handle invalid dates', () => {
      expect(formatDate(new Date('invalid'))).toBe('Invalid Date');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with correct length', () => {
      const id = generateId();
      expect(id).toHaveLength(36); // UUID format
    });
  });

  describe('slugify', () => {
    it('should convert string to slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('should remove special characters', () => {
      expect(slugify('Hello @#$ World')).toBe('hello-world');
    });

    it('should handle empty strings', () => {
      expect(slugify('')).toBe('');
    });
  });
});
```

---

## Controller Testing

### Basic Controller Test

```typescript
// src/modules/project/project.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';

describe('ProjectController', () => {
  let controller: ProjectController;
  let service: ProjectService;

  const mockProjectService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectController],
      providers: [
        {
          provide: ProjectService,
          useValue: mockProjectService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<ProjectController>(ProjectController);
    service = module.get<ProjectService>(ProjectService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of projects', async () => {
      const expectedProjects = [
        { id: 1, name: 'Project 1' },
        { id: 2, name: 'Project 2' },
      ];

      mockProjectService.findAll.mockResolvedValue({
        data: expectedProjects,
        total: 2,
      });

      const result = await controller.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(expectedProjects);
      expect(service.findAll).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });

    it('should handle errors', async () => {
      mockProjectService.findAll.mockRejectedValue(new Error('Database error'));

      await expect(controller.findAll({})).rejects.toThrow('Database error');
    });
  });

  describe('findOne', () => {
    it('should return a single project', async () => {
      const expectedProject = { id: 1, name: 'Project 1' };
      mockProjectService.findOne.mockResolvedValue(expectedProject);

      const result = await controller.findOne(1);

      expect(result).toEqual(expectedProject);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockProjectService.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new project', async () => {
      const createDto = { name: 'New Project', type: 'web' };
      const createdProject = { id: 1, ...createDto };

      mockProjectService.create.mockResolvedValue(createdProject);

      const result = await controller.create(createDto, 'user-123');

      expect(result).toEqual(createdProject);
      expect(service.create).toHaveBeenCalledWith(createDto, 'user-123');
    });

    it('should handle validation errors', async () => {
      const invalidDto = { name: '' };

      mockProjectService.create.mockRejectedValue(
        new BadRequestException('Name is required')
      );

      await expect(controller.create(invalidDto, 'user-123')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('update', () => {
    it('should update a project', async () => {
      const updateDto = { name: 'Updated Project' };
      const updatedProject = { id: 1, ...updateDto };

      mockProjectService.update.mockResolvedValue(updatedProject);

      const result = await controller.update(1, updateDto);

      expect(result).toEqual(updatedProject);
      expect(service.update).toHaveBeenCalledWith(1, updateDto);
    });
  });

  describe('remove', () => {
    it('should remove a project', async () => {
      mockProjectService.remove.mockResolvedValue(undefined);

      await controller.remove(1);

      expect(service.remove).toHaveBeenCalledWith(1);
    });
  });
});
```

### Controller with Authentication

```typescript
// src/modules/project/project.controller.spec.ts
describe('ProjectController with Authentication', () => {
  let controller: ProjectController;
  let service: ProjectService;

  const mockProjectService = { ... };

  const mockJwtGuard = { canActivate: jest.fn(() => true) };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectController],
      providers: [
        {
          provide: ProjectService,
          useValue: mockProjectService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<ProjectController>(ProjectController);
    service = module.get<ProjectService>(ProjectService);
  });

  describe('Authorization', () => {
    it('should require authentication', async () => {
      mockJwtGuard.canActivate.mockReturnValue(false);

      await expect(controller.findAll({})).rejects.toThrow(UnauthorizedException);
    });

    it('should require admin role for delete', async () => {
      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { roles: ['user'] },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      };

      mockRolesGuard.canActivate.mockReturnValue(false);

      await expect(controller.remove(1)).rejects.toThrow(ForbiddenException);
    });
  });
});
```

---

## Service Testing

### Basic Service Test

```typescript
// src/modules/project/project.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectService } from './project.service';
import { ProjectRepository } from './project.repository';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('ProjectService', () => {
  let service: ProjectService;
  let repository: ProjectRepository;

  const mockProjectRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findByName: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        {
          provide: ProjectRepository,
          useValue: mockProjectRepository,
        },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
    repository = module.get<ProjectRepository>(ProjectRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      name: 'Test Project',
      description: 'Test Description',
      type: 'web',
    };

    it('should create a project successfully', async () => {
      const expectedProject = { id: 1, ...createDto };
      mockProjectRepository.findByName.mockResolvedValue(null);
      mockProjectRepository.create.mockResolvedValue(expectedProject);

      const result = await service.create(createDto, 'user-123');

      expect(result).toEqual(expectedProject);
      expect(repository.findByName).toHaveBeenCalledWith(createDto.name);
      expect(repository.create).toHaveBeenCalledWith({
        ...createDto,
        userId: 'user-123',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should throw ConflictException if project name exists', async () => {
      mockProjectRepository.findByName.mockResolvedValue({ id: 1, name: createDto.name });

      await expect(service.create(createDto, 'user-123')).rejects.toThrow(
        new ConflictException('Project with this name already exists')
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated projects', async () => {
      const projects = [
        { id: 1, name: 'Project 1' },
        { id: 2, name: 'Project 2' },
      ];
      mockProjectRepository.findAll.mockResolvedValue(projects);
      mockProjectRepository.count.mockResolvedValue(2);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.projects).toEqual(projects);
      expect(result.total).toBe(2);
    });
  });

  describe('findOne', () => {
    it('should return a project', async () => {
      const project = { id: 1, name: 'Project 1' };
      mockProjectRepository.findOne.mockResolvedValue(project);

      const result = await service.findOne(1);

      expect(result).toEqual(project);
    });

    it('should throw NotFoundException if project not found', async () => {
      mockProjectRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(
        new NotFoundException('Project with ID 999 not found')
      );
    });
  });
});
```

### Service with Events

```typescript
// src/modules/project/project.service.spec.ts
describe('ProjectService with Events', () => {
  let service: ProjectService;
  let repository: ProjectRepository;
  let eventEmitter: EventEmitter2;

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        {
          provide: ProjectRepository,
          useValue: mockProjectRepository,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
    repository = module.get<ProjectRepository>(ProjectRepository);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should emit event when project is created', async () => {
    const createDto = { name: 'Test Project' };
    const createdProject = { id: 1, ...createDto };

    mockProjectRepository.findByName.mockResolvedValue(null);
    mockProjectRepository.create.mockResolvedValue(createdProject);

    await service.create(createDto, 'user-123');

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'project.created',
      expect.objectContaining({
        projectId: 1,
        projectName: 'Test Project',
      })
    );
  });
});
```

---

## Repository Testing

### Repository with In-Memory Database

```typescript
// src/modules/project/project.repository.spec.ts
import { Knex } from 'knex';
import { ProjectRepository } from './project.repository';
import { createTestDatabase } from '@/test/utils/database';

describe('ProjectRepository', () => {
  let repository: ProjectRepository;
  let knex: Knex;

  beforeAll(async () => {
    knex = await createTestDatabase();
    repository = new ProjectRepository(knex);
  });

  afterAll(async () => {
    await knex.destroy();
  });

  beforeEach(async () => {
    // Clean up before each test
    await knex('projects').delete();
  });

  describe('create', () => {
    it('should create a project', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'Test Description',
        type: 'web',
        userId: 'user-123',
      };

      const project = await repository.create(projectData);

      expect(project).toHaveProperty('id');
      expect(project.name).toBe(projectData.name);
      expect(project.userId).toBe(projectData.userId);
    });
  });

  describe('findOne', () => {
    it('should find a project by id', async () => {
      const created = await repository.create({
        name: 'Test Project',
        userId: 'user-123',
      });

      const found = await repository.findOne(created.id);

      expect(found).not.toBeNull();
      expect(found.id).toBe(created.id);
    });

    it('should return null if project not found', async () => {
      const found = await repository.findOne(99999);
      expect(found).toBeNull();
    });
  });

  describe('findAll', () => {
    beforeEach(async () => {
      await knex('projects').insert([
        { name: 'Project 1', user_id: 'user-1' },
        { name: 'Project 2', user_id: 'user-1' },
        { name: 'Project 3', user_id: 'user-2' },
      ]);
    });

    it('should return all projects', async () => {
      const projects = await repository.findAll();
      expect(projects).toHaveLength(3);
    });

    it('should filter by user_id', async () => {
      const projects = await repository.findWhere({ userId: 'user-1' });
      expect(projects).toHaveLength(2);
    });
  });
});
```

---

## Integration Testing

### Module Integration Test

```typescript
// test/integration/project.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { createTestDatabase, seedTestData } from '@/test/utils/database';

describe('Project Module Integration (e2e)', () => {
  let app: INestApplication;
  let knex: Knex;

  beforeAll(async () => {
    knex = await createTestDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('DATABASE_CONNECTION')
      .useValue(knex)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await knex.destroy();
  });

  beforeEach(async () => {
    await knex.migrate.latest();
    await seedTestData(knex);
  });

  afterEach(async () => {
    await knex.migrate.rollback();
  });

  describe('/projects (GET)', () => {
    it('should return array of projects', () => {
      return request(app.getHttpServer())
        .get('/projects')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.projects)).toBe(true);
          expect(res.body.projects.length).toBeGreaterThan(0);
        });
    });

    it('should support pagination', () => {
      return request(app.getHttpServer())
        .get('/projects?page=1&limit=5')
        .expect(200)
        .expect((res) => {
          expect(res.body.pagination.page).toBe(1);
          expect(res.body.pagination.limit).toBe(5);
        });
    });

    it('should support search', () => {
      return request(app.getHttpServer())
        .get('/projects?search=Test')
        .expect(200)
        .expect((res) => {
          expect(res.body.projects.every(p =>
            p.name.includes('Test')
          )).toBe(true);
        });
    });
  });

  describe('/projects (POST)', () => {
    it('should create a project', () => {
      const newProject = {
        name: 'New Project',
        type: 'web',
      };

      return request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', 'Bearer valid-token')
        .send(newProject)
        .expect(201)
        .expect((res) => {
          expect(res.body.name).toBe(newProject.name);
          expect(res.body).toHaveProperty('id');
        });
    });

    it('should validate input', () => {
      return request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: '' })
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Validation error');
        });
    });
  });

  describe('/projects/:id (GET)', () => {
    it('should return a single project', () => {
      return request(app.getHttpServer())
        .get('/projects/1')
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(1);
        });
    });

    it('should return 404 for non-existent project', () => {
      return request(app.getHttpServer())
        .get('/projects/99999')
        .expect(404);
    });
  });
});
```

---

## E2E Testing

### E2E Test Configuration

```json
// jest-e2e.json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "moduleNameMapper": {
    "^@/(.*)$": "<rootDir>/../src/$1"
  }
}
```

### Full E2E Test

```typescript
// test/e2e/project.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { getAuthToken } from '@/test/utils/auth';

describe('Project E2E', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    authToken = await getAuthToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Project CRUD Flow', () => {
    let projectId: number;

    it('should create a project', () => {
      return request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'E2E Test Project',
          description: 'Created by E2E test',
          type: 'web',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.name).toBe('E2E Test Project');
          expect(res.body).toHaveProperty('id');
          projectId = res.body.id;
        });
    });

    it('should get the created project', () => {
      return request(app.getHttpServer())
        .get(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(projectId);
          expect(res.body.name).toBe('E2E Test Project');
        });
    });

    it('should update the project', () => {
      return request(app.getHttpServer())
        .patch(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated E2E Test Project',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Updated E2E Test Project');
        });
    });

    it('should list all projects', () => {
      return request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.projects)).toBe(true);
          expect(res.body.projects.some(p => p.id === projectId)).toBe(true);
        });
    });

    it('should delete the project', () => {
      return request(app.getHttpServer())
        .delete(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    it('should not find deleted project', () => {
      return request(app.getHttpServer())
        .get(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Authentication Flow', () => {
    it('should fail without auth token', () => {
      return request(app.getHttpServer())
        .get('/projects')
        .expect(401);
    });

    it('should fail with invalid auth token', () => {
      return request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
```

---

## Testing with Knex.js

### Test Database Utilities

```typescript
// test/utils/database.ts
import { Knex } from 'knex';
import knexConfig from '@/knexfile';

export async function createTestDatabase(): Promise<Knex> {
  const config = knexConfig.test;

  // Create test database connection
  const knex = require('knex')(config);

  // Run migrations
  await knex.migrate.latest();

  return knex;
}

export async function seedTestData(knex: Knex): Promise<void> {
  await knex('projects').insert([
    {
      id: 1,
      name: 'Test Project 1',
      description: 'Description 1',
      type: 'web',
      user_id: 'test-user-1',
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 2,
      name: 'Test Project 2',
      description: 'Description 2',
      type: 'mobile',
      user_id: 'test-user-1',
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);
}

export async function cleanDatabase(knex: Knex): Promise<void> {
  const tables = await knex.raw(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `);

  for (const row of tables.rows) {
    await knex(row.table_name).delete();
  }
}

export async function rollbackMigrations(knex: Knex): Promise<void> {
  await knex.migrate.rollback({}, true);
}
```

### Repository Transaction Tests

```typescript
// src/modules/project/project.repository.spec.ts
describe('ProjectRepository with Transactions', () => {
  let repository: ProjectRepository;
  let knex: Knex;

  beforeAll(async () => {
    knex = await createTestDatabase();
    repository = new ProjectRepository(knex);
  });

  it('should rollback on error', async () => {
    await expect(
      repository.transaction(async (trx) => {
        await trx('projects').insert({
          name: 'Project 1',
          user_id: 'user-1',
        });

        throw new Error('Intentional error');
      })
    ).rejects.toThrow('Intentional error');

    // Verify rollback
    const projects = await knex('projects').select('*');
    expect(projects).toHaveLength(0);
  });

  it('should commit on success', async () => {
    await repository.transaction(async (trx) => {
      await trx('projects').insert({
        name: 'Project 1',
        user_id: 'user-1',
      });
    });

    const projects = await knex('projects').select('*');
    expect(projects).toHaveLength(1);
  });
});
```

---

## Mocking and Stubs

### Mocking External Services

```typescript
// src/modules/ai/ai.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';

describe('AiService', () => {
  let service: AiService;
  let httpService: HttpService;

  const mockHttpService = {
    post: jest.fn(),
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    httpService = module.get<HttpService>(HttpService);
  });

  it('should call external API', async () => {
    const mockResponse = {
      data: { result: 'AI generated content' },
      status: 200,
    };

    mockHttpService.post.mockReturnValue(of(mockResponse));

    const result = await service.generateContent('test prompt');

    expect(result).toBe('AI generated content');
    expect(httpService.post).toHaveBeenCalledWith(
      expect.any(String),
      { prompt: 'test prompt' },
      expect.any(Object)
    );
  });
});
```

---

## Testing Best Practices

### Test Organization

```typescript
// Good: Clear test structure
describe('ProjectService', () => {
  describe('create', () => {
    it('should create project with valid data', async () => {
      // Arrange
      const dto = { name: 'Test' };

      // Act
      const result = await service.create(dto);

      // Assert
      expect(result).toHaveProperty('id');
    });

    it('should throw error with invalid data', async () => {
      // Arrange, Act, Assert...
    });
  });
});

// Bad: No organization
it('should work', async () => {
  // What is being tested?
});
```

### Mock Only What's Necessary

```typescript
// Good: Mock only dependencies
const mockRepository = {
  create: jest.fn().mockResolvedValue({ id: 1, name: 'Test' }),
};

// Bad: Mock entire implementation
const mockService = {
  create: jest.fn(async (dto) => {
    // Don't reimplement logic in tests
    return { id: 1, ...dto };
  }),
};
```

---

## Bun.js Runtime Specifics

### Bun Test Configuration

```typescript
// package.json
{
  "scripts": {
    "test": "bun test",
    "test:unit": "bun test --test-name-pattern='unit'",
    "test:integration": "bun test --test-name-pattern='integration'",
    "test:coverage": "bun test --coverage"
  }
}

// Example Bun test
// project.repository.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';

describe('ProjectRepository', () => {
  let knex: Knex;

  beforeAll(async () => {
    knex = await createTestDatabase();
  });

  afterAll(async () => {
    await knex.destroy();
  });

  test('should create project', async () => {
    const repo = new ProjectRepository(knex);
    const project = await repo.create({ name: 'Test', userId: '1' });
    expect(project.id).toBeDefined();
  });
});
```

---

## Additional Resources

- [NestJS Testing Documentation](https://docs.nestjs.com/fundamentals/testing)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [supertest Documentation](https://github.com/visionmedia/supertest)
- [Knex.js Testing Best Practices](https://knexjs.org/guide/#testing)