# Integration Patterns Between Frameworks

## Overview

This skill provides comprehensive integration patterns for the ERDwithAI project, which combines Next.js, NestJS, OpenUI5, and OData v4 all running on the Bun.js runtime. This guide covers how to integrate these technologies effectively.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Next.js and NestJS Integration](#nextjs-and-nestjs-integration)
3. [NestJS and OData Integration](#nestjs-and-odata-integration)
4. [OpenUI5 and OData Integration](#openui5-and-odata-integration)
5. [Cross-Framework Authentication](#cross-framework-authentication)
6. [API Gateway Pattern](#api-gateway-pattern)
7. [Service-to-Service Communication](#service-to-service-communication)
8. [Shared Types and Validation](#shared-types-and-validation)
9. [Database Integration](#database-integration)
10. [Logging and Monitoring](#logging-and-monitoring)
11. [Deployment Integration](#deployment-integration)
12. [Bun.js Monorepo Integration](#bunjs-monorepo-integration)

---

## Architecture Overview

### Monorepo Structure

```
erdwithai-v5.1-complete/
├── packages/
│   ├── web/              # Next.js frontend
│   ├── backend/          # NestJS API
│   ├── openui5-app/      # OpenUI5 application
│   ├── core/             # Shared business logic
│   ├── ai/               # AI services
│   └── generator/        # Code generator
├── migrations/           # Database migrations
├── docs/                 # Documentation
└── bun.lockb
```

### Service Communication Flow

```
┌─────────────┐     HTTP/REST     ┌─────────────┐
│   Next.js   │──────────────────>│  NestJS API │
│   Frontend  │<──────────────────│   Backend   │
└─────────────┘                 └─────────────┘
       │                                 │
       │                                 │
       v                                 v
┌─────────────┐                 ┌─────────────┐
│   OpenUI5   │                 │   OData     │
│   App       │<────────────────│   Server    │
└─────────────┘                 └─────────────┘
                                         │
                                         v
                                  ┌─────────────┐
                                  │  Database   │
                                  │  (Knex.js)  │
                                  └─────────────┘
```

---

## Next.js and NestJS Integration

### API Client Configuration

```typescript
// packages/web/lib/api-client.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Handle token refresh
          await this.refreshToken();
          // Retry original request
          return this.client.request(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
  }

  private async refreshToken() {
    // Implement token refresh logic
  }

  // CRUD methods
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

// Singleton instance
export const apiClient = new ApiClient();
```

### Next.js API Routes as Proxy

```typescript
// packages/web/app/api/proxy/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '@/lib/api-client';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const url = new URL(request.url);
    const queryString = url.search;

    const data = await apiClient.get(`/${path}${queryString}`);

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.response?.status || 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const body = await request.json();

    const data = await apiClient.post(`/${path}`, body);

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.response?.status || 500 }
    );
  }
}
```

### Server-Side Data Fetching

```typescript
// packages/web/app/projects/page.tsx
import { apiClient } from '@/lib/api-client';
import { ProjectList } from './components/ProjectList';

export default async function ProjectsPage() {
  const projects = await fetchProjects();

  return <ProjectList initialProjects={projects} />;
}

async function fetchProjects() {
  try {
    // Direct fetch on server, bypassing API client
    const response = await fetch(`${process.env.API_URL}/projects`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        // Add server-side auth headers if needed
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch projects');
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching projects:', error);
    return { projects: [] };
  }
}
```

---

## NestJS and OData Integration

### OData Module in NestJS

```typescript
// packages/backend/src/odata/odata.module.ts
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ODataController } from './odata.controller';
import { ODataServer } from 'odata-v4-server';
import { ProjectService } from '../project/project.service';

@Module({
  controllers: [ODataController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ODataModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply OData middleware to specific routes
    consumer.apply(ODataMiddleware).forRoutes('odata');
  }
}
```

### OData Controller with NestJS Services

```typescript
// packages/backend/src/odata/odata.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ODataController, odata, ODataQuery } from 'odata-v4-server';
import { ProjectService } from '../project/project.service';

@Controller('odata')
@ODataController
export class ODataController {
  constructor(private readonly projectService: ProjectService) {}

  @odata.GET
  async findAll(@odata.query query: ODataQuery) {
    return this.projectService.findAll(query);
  }

  @odata.GET
  @odata.key('id')
  async findOne(@odata.key id: string) {
    return this.projectService.findOne(id);
  }

  @odata.POST
  async create(@odata.body data: any) {
    return this.projectService.create(data);
  }

  // Custom OData actions
  @ODataAction
  async export(@odata.key id: string) {
    return this.projectService.export(id);
  }

  @ODataFunction
  async search(@odata.param('term') term: string) {
    return this.projectService.search(term);
  }
}
```

### Shared Entity Definitions

```typescript
// packages/core/src/entities/project.entity.ts
export interface Project {
  id: string;
  name: string;
  description?: string;
  type: ProjectType;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum ProjectType {
  WEB = 'web',
  MOBILE = 'mobile',
  DESKTOP = 'desktop',
}

// Used in both NestJS and OData
export const PROJECT_ENTITY = 'Project';
```

---

## OpenUI5 and OData Integration

### OData Model Configuration

```javascript
// packages/openui5-app/webapp/model/odata.js
sap.ui.define([
  "sap/ui/model/odata/v4/ODataModel"
], function(ODataModel) {
  "use strict";

  return {
    createODataModel: function() {
      var sServiceUrl = "/api/odata/";

      var oModel = new ODataModel({
        serviceUrl: sServiceUrl,
        synchronizationMode: "None",
        operationMode: "Server",
        autoExpandSelect: true,
        earlyRequests: true,
        groupId: "$direct",
        updateGroupId: "$auto"
      });

      // Enable batch
      oModel.setUseBatch(true);

      // Attach request handlers
      oModel.attachRequestCompleted(function(oEvent) {
        // Handle success
      });

      oModel.attachRequestFailed(function(oEvent) {
        // Handle errors
        var oParameters = oEvent.getParameters();
        // Show error message
      });

      return oModel;
    }
  };
});
```

### OData List Binding

```xml
<!-- packages/openui5-app/webapp/view/Master/Master.view.xml -->
<mvc:View
  controllerName="com.erdwithai.controller.Master"
  xmlns:mvc="sap.ui.core.mvc"
  xmlns="sap.m">
  <List
    id="projectList"
    items="{
      path: '/Projects',
      parameters: {
        $select: 'ID,Name,Description,Type,CreatedAt',
        $orderby: 'CreatedAt desc',
        $top: 20
      },
      events: {
        dataReceived: '.onDataReceived'
      }
    }"
    growing="true"
    growingThreshold="20">
    <items>
      <ObjectListItem
        title="{Name}"
        type="Navigation"
        press="onItemPress">
        <attributes>
          <ObjectListItem text="{Description}" />
        </attributes>
        <firstStatus>
          <ObjectStatus
            text="{Type}"
            state="Success" />
        </firstStatus>
      </ObjectListItem>
    </items>
  </List>
</mvc:View>
```

### CRUD Operations in OpenUI5

```javascript
// packages/openui5-app/webapp/controller/Detail/Detail.controller.js
sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast"
], function(Controller, MessageToast) {
  "use strict";

  return Controller.extend("com.erdwithai.controller.Detail", {

    getRouter: function() {
      return this.getOwnerComponent().getRouter();
    },

    // Read
    onInit: function() {
      this.getRouter().getRoute("detail").attachPatternMatched(this._onDetailMatched, this);
    },

    _onDetailMatched: function(oEvent) {
      var sObjectId = oEvent.getParameter("arguments").projectId;
      this.getView().bindElement({
        path: "/Projects(" + sObjectId + ")",
        parameters: {
          $expand: "Entities"
        }
      });
    },

    // Create
    onCreate: function() {
      var oModel = this.getView().getModel();
      var oData = {
        Name: "New Project",
        Type: "web"
      };

      oModel.create("/Projects", oData, {
        success: function() {
          MessageToast.show("Project created");
        },
        error: function() {
          MessageToast.show("Error creating project");
        }
      });
    },

    // Update
    onSave: function() {
      var oModel = this.getView().getModel();
      var oData = this.getView().getBindingContext().getObject();
      var sPath = this.getView().getBindingContext().getPath();

      oModel.update(sPath, oData, {
        success: function() {
          MessageToast.show("Changes saved");
        },
        error: function() {
          MessageToast.show("Error saving changes");
        }
      });
    },

    // Delete
    onDelete: function() {
      var oModel = this.getView().getModel();
      var sPath = this.getView().getBindingContext().getPath();

      oModel.remove(sPath, {
        success: function() {
          MessageToast.show("Project deleted");
          this.getRouter().navTo("master");
        }.bind(this),
        error: function() {
          MessageToast.show("Error deleting project");
        }
      });
    }
  });
});
```

---

## Cross-Framework Authentication

### JWT Token Management

```typescript
// packages/core/src/auth/jwt.service.ts
import { Injectable } from '@nestjs/common';
import jwt from 'jsonwebtoken';

@Injectable()
export class JwtService {
  private readonly secret = process.env.JWT_SECRET || 'secret';
  private readonly expiresIn = process.env.JWT_EXPIRES_IN || '1h';

  generateToken(payload: any): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
    });
  }

  verifyToken(token: string): any {
    return jwt.verify(token, this.secret);
  }

  decodeToken(token: string): any {
    return jwt.decode(token);
  }
}
```

### Next.js Auth Integration

```typescript
// packages/web/lib/auth.ts
import { apiClient } from './api-client';

export class AuthService {
  async login(email: string, password: string) {
    const response = await apiClient.post('/auth/login', { email, password });
    this.setToken(response.access_token);
    return response;
  }

  async logout() {
    await apiClient.post('/auth/logout');
    this.removeToken();
  }

  private setToken(token: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', token);
    }
  }

  private removeToken() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
    }
  }

  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('access_token');
    }
    return null;
  }

  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }
}

export const authService = new AuthService();
```

### OpenUI5 Auth Integration

```javascript
// packages/openui5-app/webapp/model/auth.js
sap.ui.define([
  "sap/ui/base/Object"
], function(BaseObject) {
  "use strict";

  return BaseObject.extend("com.erdwithai.model.Auth", {

    constructor: function() {
      this._oToken = null;
      this._loadToken();
    },

    login: function(sEmail, sPassword) {
      var that = this;
      return fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: sEmail,
          password: sPassword
        })
      }).then(function(oResponse) {
        return oResponse.json();
      }).then(function(oData) {
        that._oToken = oData.access_token;
        that._saveToken();
        return oData;
      });
    },

    logout: function() {
      this._oToken = null;
      this._removeToken();
    },

    getToken: function() {
      return this._oToken;
    },

    isAuthenticated: function() {
      return !!this._oToken;
    },

    _loadToken: function() {
      var sToken = localStorage.getItem("access_token");
      if (sToken) {
        this._oToken = sToken;
      }
    },

    _saveToken: function() {
      if (this._oToken) {
        localStorage.setItem("access_token", this._oToken);
      }
    },

    _removeToken: function() {
      localStorage.removeItem("access_token");
    }
  });
});
```

---

## API Gateway Pattern

### Bun.js API Gateway

```typescript
// packages/gateway/src/index.ts
import { serve } from 'bun';
import { parse } from 'url';

const routes = {
  '/api': 'http://localhost:3001',  // NestJS
  '/odata': 'http://localhost:3002', // OData
  '/web': 'http://localhost:3000',    // Next.js
  '/openui5': 'http://localhost:3003', // OpenUI5
};

serve({
  port: 8080,
  async fetch(req) {
    const url = parse(req.url, true);
    const pathname = url.pathname || '';

    // Find matching route
    const route = Object.keys(routes).find(key => pathname.startsWith(key));

    if (!route) {
      return new Response('Not Found', { status: 404 });
    }

    const targetUrl = routes[route as keyof typeof routes];

    // Proxy request
    const proxyUrl = `${targetUrl}${pathname}${url.search || ''}`;

    const proxyReq = new Request(proxyUrl, {
      method: req.method,
      headers: req.headers,
      body: req.body,
    });

    return fetch(proxyReq);
  },
});

console.log('API Gateway running on http://localhost:8080');
```

---

## Service-to-Service Communication

### Event Bus Pattern

```typescript
// packages/core/src/events/event-bus.ts
import { EventEmitter } from 'events';

export class EventBus extends EventEmitter {
  private static instance: EventBus;

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  publish(event: string, data: any): void {
    this.emit(event, data);
  }

  subscribe(event: string, handler: (data: any) => void): void {
    this.on(event, handler);
  }

  unsubscribe(event: string, handler: (data: any) => void): void {
    this.off(event, handler);
  }
}

// Usage
const eventBus = EventBus.getInstance();
eventBus.publish('project.created', { id: '1', name: 'Test' });
eventBus.subscribe('project.created', (data) => {
  console.log('Project created:', data);
});
```

---

## Shared Types and Validation

### Shared Types Package

```typescript
// packages/core/src/types/project.types.ts
export interface Project {
  id: string;
  name: string;
  description?: string;
  type: ProjectType;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum ProjectType {
  WEB = 'web',
  MOBILE = 'mobile',
  DESKTOP = 'desktop',
}

export interface CreateProjectDto {
  name: string;
  description?: string;
  type: ProjectType;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  type?: ProjectType;
}
```

### Zod Validation Schema

```typescript
// packages/core/src/validation/project.schema.ts
import { z } from 'zod';

export const projectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['web', 'mobile', 'desktop']),
  userId: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['web', 'mobile', 'desktop']),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  type: z.enum(['web', 'mobile', 'desktop']).optional(),
});
```

---

## Database Integration

### Knex.js Configuration

```typescript
// packages/backend/src/database/knex.config.ts
import { Knex } from 'knex';
import { config } from 'dotenv';

config();

const knexConfig: Knex.Config = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'erdwithai',
  },
  pool: {
    min: 2,
    max: 10,
  },
  migrations: {
    directory: './migrations',
  },
  seeds: {
    directory: './seeds',
  },
};

export const knex = require('knex')(knexConfig);
```

---

## Logging and Monitoring

### Structured Logging

```typescript
// packages/core/src/logging/logger.ts
export interface LogData {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: string;
  data?: any;
  timestamp: string;
}

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private log(level: LogData['level'], message: string, data?: any) {
    const logData: LogData = {
      level,
      message,
      context: this.context,
      data,
      timestamp: new Date().toISOString(),
    };

    console.log(JSON.stringify(logData));
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  error(message: string, data?: any) {
    this.log('error', message, data);
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }
}
```

---

## Bun.js Monorepo Integration

### Root Build Script

```typescript
// build.ts
import { $ } from 'bun';

async function build() {
  console.log('Building all packages...');

  await $`bun run build --filter @erdwithai/core`;
  await $`bun run build --filter @erdwithai/web`;
  await $`bun run build --filter @erdwithai/backend`;
  await $`bun run build --filter @erdwithai/openui5`;

  console.log('Build complete!');
}

build();
```

---

## Additional Resources

- [Monorepo Patterns](https://monorepo.tools)
- [Microservices Integration](https://microservices.io/patterns/apigateway.html)
- [Bun.js Documentation](https://bun.sh/docs)