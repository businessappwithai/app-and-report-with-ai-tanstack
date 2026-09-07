# APPWITHAI Generator Enhancement Plan
## Natural Language AI Data Access for Generated Applications

**Document Version:** 2.0
**Date:** January 19, 2026
**Status:** PENDING APPROVAL
**Author:** Claude Code Assistant

**Version 2.0 Changes:**
- Clarified ANTLR4 is for VALIDATION ONLY (syntax, schema, role-based permissions)
- Updated to use Knex.js Query Builder DIRECTLY (no SQL-to-Knex conversion)
- Added AI NL as optional add-on selectable during stack generation
- Added role-based permission validation in ANTLR4
- Results displayed via CopilotKit

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Phase 1: Generator Template Fixes](#3-phase-1-generator-template-fixes)
4. [Phase 2: AI Data Access Architecture](#4-phase-2-ai-data-access-architecture)
5. [Phase 3: Mastra.ai Integration](#5-phase-3-mastraai-integration)
6. [Phase 4: ANTLR4 SQL Validation](#6-phase-4-antlr4-sql-validation)
7. [Phase 5: CopilotKit Integration](#7-phase-5-copilotkit-integration)
8. [Security Architecture (RBAC)](#8-security-architecture-rbac)
9. [Implementation Plan](#9-implementation-plan)
10. [Testing Strategy](#10-testing-strategy)
11. [Risk Assessment](#11-risk-assessment)
12. [Approval Checklist](#12-approval-checklist)

---

## 1. Executive Summary

### 1.1 Objective

Enhance the APPWITHAI generator to produce applications that include:

1. **Natural Language Data Access** - Users can query their data using plain English
2. **AI-Powered Analytics** - Intelligent data insights and recommendations
3. **RBAC-Secured AI** - All AI queries respect user roles and permissions
4. **Mastra.ai Integration** - Workflow-based AI agent orchestration
5. **CopilotKit Integration** - In-app AI assistant for data exploration

### 1.2 Architecture Principle: Unified AI Data Access Layer

**IMPORTANT**: The AI Natural Language feature uses a **unified Knex.js Query Builder-based data access layer** for BOTH Option 1 and Option 2 stacks:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    AI Natural Language Data Access                       │
│                    (SAME FOR BOTH OPTION 1 AND OPTION 2)                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐ │
│   │ User NL      │───▶│ Mastra.ai    │───▶│ ANTLR4 SQL Validation    │ │
│   │ Query        │    │ Agent        │    │ (Syntax + Permissions)   │ │
│   └──────────────┘    └──────────────┘    └──────────────────────────┘ │
│                                                        │                 │
│                                                        ▼                 │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐ │
│   │ CopilotKit   │◀───│ Format       │◀───│ Knex.js Query Builder    │ │
│   │ Display      │    │ Results      │    │ (Direct Query Execution) │ │
│   └──────────────┘    └──────────────┘    └──────────────────────────┘ │
│                                                                          │
│   This is an ADD-ON module that works independently of the              │
│   generated application's primary data access layer.                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                    Generated Application Frameworks                      │
│                    (UNCHANGED - REMAIN AS-IS)                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   OPTION 1: NestJS + Next.js + Knex.js (existing framework)             │
│   OPTION 2: OData V4 + OpenUI5 (existing framework)                     │
│                                                                          │
│   The primary CRUD operations continue to use their native frameworks.  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Component Responsibilities:**

| Component | Responsibility |
|-----------|----------------|
| **Mastra.ai Agent** | Parse NL query into structured intent (entity, filters, aggregations) |
| **ANTLR4 SQL Validator** | **VALIDATION ONLY**: Validate SQL syntax, check role-based permissions on entities/fields |
| **Knex.js Query Builder** | Build and execute queries DIRECTLY using Knex.js API (not SQL conversion) |
| **CopilotKit** | Display query results in chat interface |

**Key Principles:**
- **ANTLR4 is for VALIDATION ONLY** - It validates SQL syntax and checks permissions based on roles
- **Knex.js Query Builder is used DIRECTLY** - No SQL-to-Knex conversion; queries built using Knex.js API
- Both stacks already have database connections (SQLite/PostgreSQL)
- AI queries bypass OData for Option 2 to enable direct, secure access
- Results are displayed in CopilotKit chat interface

### 1.3 AI Natural Language Add-on as Optional Feature

**IMPORTANT**: The AI Natural Language feature is an **OPTIONAL ADD-ON** that can be selected during stack generation for both Option 1 and Option 2.

**Stack Selection with AI Add-on:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Stack Selection Configuration                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  STACK_OPTION:                                                          │
│  ○ "Modern Web Stack (NestJS + Next.js)"           [Option 1]           │
│  ○ "Enterprise SAP Stack (OData + OpenUI5)"        [Option 2]           │
│                                                                          │
│  AI_NL_ADDON:                                      [NEW - Optional]      │
│  ○ "none"     - No AI Natural Language features                         │
│  ○ "basic"    - NL queries with CopilotKit display                      │
│  ○ "advanced" - NL queries + Insights + Analytics                       │
│                                                                          │
│  When AI_NL_ADDON is enabled:                                           │
│  - Mastra.ai + CopilotKit templates are included                        │
│  - ANTLR4 SQL validator is generated                                    │
│  - Knex.js Query Builder integration added                              │
│  - RBAC tables extended for AI access control                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Environment Configuration (.env):**

```bash
# Stack Selection
STACK_OPTION="Modern Web Stack (NestJS + Next.js)"  # or Enterprise SAP Stack

# AI Natural Language Add-on (NEW)
AI_NL_ADDON=basic                 # none | basic | advanced
AI_NL_PROVIDER=anthropic          # anthropic | openai
AI_NL_MODEL=claude-sonnet-4       # Model for NL processing
```

### 1.4 Scope

| Component | In Scope | Out of Scope |
|-----------|----------|--------------|
| Generator Templates | Fix all TypeScript errors, add AI modules (optional) | Major architecture changes |
| Option 1 (NestJS + Next.js) | Full NL AI integration via Knex.js (when AI_NL_ADDON enabled) | - |
| Option 2 (OData + OpenUI5) | Full NL AI integration via Knex.js (when AI_NL_ADDON enabled) | OData-based AI queries |
| AI Data Access | Unified Knex.js layer for both stacks (optional) | OData V4 for AI queries |
| RBAC Security | Row-level and field-level security | Custom auth providers |
| Mastra.ai | Agent-based data queries (when enabled) | Training custom models |
| CopilotKit | Chat interface, context awareness (when enabled) | Voice interface |

### 1.5 Key Deliverables

1. Fixed generator templates (no TypeScript errors)
2. **AI NL Add-on Configuration** - Optional feature selection during stack generation
3. AI Data Query Agent (Mastra.ai) - Parses NL to structured query intent
4. RBAC-aware query middleware
5. **ANTLR4 SQL Validator** - **VALIDATION ONLY**: Grammar-based SQL syntax validation + role-based permission checking
6. **Knex.js Query Builder Integration** - Build queries DIRECTLY using Knex.js API (not SQL conversion)
7. **CopilotKit chat component templates** - Display query results to users
8. Natural language → Intent → Knex.js Query Builder pipeline
9. Comprehensive test suite

---

## 2. Current State Analysis

### 2.1 Generator Template Issues

| Issue | Severity | Location | Impact |
|-------|----------|----------|--------|
| `{{#eq}}` used as block helper | CRITICAL | Option 1 frontend templates | TypeScript compilation fails |
| Missing module exports | HIGH | dynamic-form.tsx, dynamic-table.tsx | Import errors |
| Missing dependencies | MEDIUM | sonner, @tanstack/react-query-devtools | Runtime errors |
| OData package versions | HIGH | odata-v4-server@^0.2.16 | Package not found |
| Type definition errors | MEDIUM | Multiple controllers | IDE warnings |

### 2.2 Root Cause Analysis

**Template Helper Issue:**

```handlebars
// INCORRECT - eq is not a block helper
{{#eq type 'string'}}string{{/eq}}{{#eq type 'integer'}}number{{/eq}}

// This generates: truefalsefalsefalse (boolean concatenation)
```

**Correct Pattern:**

```handlebars
// CORRECT - Use if with helper condition
{{#if (eq type 'string')}}string{{else if (eq type 'integer')}}number{{/if}}

// Or use the tsType helper directly
{{tsType type}}
```

### 2.3 Current AI Architecture

The platform already has:

- **4 AI Agents**: Domain, Entity, Relationship, Mermaid (for ERD design)
- **Mastra.ai Instance**: Configured with Claude Sonnet 4
- **CopilotKit Setup**: Currently disabled due to dependency conflicts
- **RBAC Types**: Table-level and field-level access control defined

**Gap Analysis:**

| Feature | APPWITHAI Platform | Generated Applications |
|---------|-------------------|------------------------|
| AI Agents | ✅ Present | ❌ Not generated |
| Natural Language Queries | ✅ For ERD design | ❌ Not for data access |
| CopilotKit | ⚠️ Disabled | ❌ Not included |
| RBAC Security | ✅ Types defined | ⚠️ Partial implementation |
| Mastra Workflows | ✅ ERD workflow | ❌ No data workflows |

---

## 3. Phase 1: Generator Template Fixes

### 3.1 Template Corrections

**Priority 1: Fix Block Helper Usage**

Files to modify:
- `templates/option1-modern-web/frontend/src/app/(entities)/[entity]/page.tsx.hbs`
- `templates/option1-modern-web/frontend/src/app/(entities)/[entity]/[id]/page.tsx.hbs`

**Before:**
```handlebars
{{name}}: {{#eq type 'string'}}string{{/eq}}{{#eq type 'integer'}}number{{/eq}}...
```

**After:**
```handlebars
{{name}}: {{tsType type}};
```

**Priority 2: Add Missing Exports**

Files to create/fix:
- `templates/option1-modern-web/frontend/src/components/forms/dynamic-form.tsx.hbs`
- `templates/option1-modern-web/frontend/src/components/tables/dynamic-table.tsx.hbs`

**Priority 3: Fix Package Dependencies**

Files to modify:
- `templates/option1-modern-web/frontend/package.json.hbs`
- `templates/option2-enterprise-sap/backend/package.json.hbs`

**Add missing packages:**
```json
{
  "dependencies": {
    "sonner": "^1.4.0",
    "@tanstack/react-query-devtools": "^5.0.0"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0"
  }
}
```

### 3.2 Option 2 OData Fixes

**Issue:** `odata-v4-server@^0.2.16` doesn't exist

**Solution:** Use `@odata/server` package instead

```json
{
  "dependencies": {
    "@odata/server": "^0.4.0",
    "@odata/parser": "^0.3.0"
  }
}
```

**Template updates needed:**
- Update import statements from `odata-v4-server` to `@odata/server`
- Update controller base class references

### 3.3 New Helper Registration

Add to `loader.ts`:

```typescript
// Register tsType as the primary type mapping helper
Handlebars.registerHelper('tsType', (type: string) => {
  const typeMap: Record<string, string> = {
    'string': 'string',
    'varchar': 'string',
    'text': 'string',
    'integer': 'number',
    'int': 'number',
    'bigint': 'number',
    'decimal': 'number',
    'float': 'number',
    'boolean': 'boolean',
    'bool': 'boolean',
    'date': 'Date',
    'datetime': 'Date',
    'timestamp': 'Date',
    'json': 'Record<string, unknown>',
    'jsonb': 'Record<string, unknown>',
    'uuid': 'string'
  };
  return typeMap[type?.toLowerCase()] || 'unknown';
});
```

---

## 4. Phase 2: AI Data Access Architecture

### 4.1 Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Generated Application                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  CopilotKit  │───▶│  AI Gateway  │───▶│   Mastra.ai  │      │
│  │  Chat UI     │    │  (RBAC)      │    │   Agent      │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                    │               │
│         ▼                   ▼                    ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  User        │───▶│  Permission  │───▶│  Query       │      │
│  │  Context     │    │  Filter      │    │  Builder     │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                              │                    │               │
│                              ▼                    ▼               │
│                       ┌──────────────┐    ┌──────────────┐      │
│                       │  Row-Level   │───▶│  Database    │      │
│                       │  Security    │    │              │      │
│                       └──────────────┘    └──────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 AI Data Query Agent

**Agent Definition:**

```typescript
// packages/generator/templates/common/ai/agents/data-query-agent.ts.hbs
import { Agent } from '@mastra/core';
import { z } from 'zod';

export const dataQueryAgent = new Agent({
  name: 'Data Query Agent',
  instructions: `
    You are a data query assistant for {{projectName}}.

    Available entities:
    {{#each entities}}
    - {{pascalCase name}}: {{description}}
      Fields: {{#each attributes}}{{name}} ({{type}}){{#unless @last}}, {{/unless}}{{/each}}
    {{/each}}

    Available relationships:
    {{#each relationships}}
    - {{sourceEntity}} {{cardinality}} {{targetEntity}}
    {{/each}}

    SECURITY RULES:
    1. NEVER access tables the user doesn't have permission for
    2. ALWAYS filter by user's accessible records
    3. NEVER expose field values the user can't see
    4. Respect row-level security policies

    When the user asks a question:
    1. Identify relevant entities
    2. Check user permissions for those entities
    3. Build a secure query
    4. Return formatted results
  `,
  model: {
    provider: 'ANTHROPIC',
    name: 'claude-sonnet-4-20250514',
    toolChoice: 'auto'
  },
  tools: {
    queryDatabase: {
      description: 'Execute a secure database query',
      parameters: z.object({
        entity: z.string().describe('The entity to query'),
        filters: z.array(z.object({
          field: z.string(),
          operator: z.enum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'like', 'in']),
          value: z.unknown()
        })).optional(),
        select: z.array(z.string()).optional(),
        orderBy: z.object({
          field: z.string(),
          direction: z.enum(['asc', 'desc'])
        }).optional(),
        limit: z.number().max(100).optional(),
        include: z.array(z.string()).optional()
      }),
      execute: async (params, context) => {
        // Implemented in generated app with RBAC
        return context.secureQuery(params);
      }
    },
    aggregateData: {
      description: 'Perform aggregations on data',
      parameters: z.object({
        entity: z.string(),
        operation: z.enum(['count', 'sum', 'avg', 'min', 'max']),
        field: z.string().optional(),
        groupBy: z.array(z.string()).optional(),
        filters: z.array(z.object({
          field: z.string(),
          operator: z.string(),
          value: z.unknown()
        })).optional()
      }),
      execute: async (params, context) => {
        return context.secureAggregate(params);
      }
    }
  }
});
```

### 4.3 Natural Language to Query Translation

**Query Parser Module:**

```typescript
// packages/generator/templates/common/ai/parsers/nl-query-parser.ts.hbs
export class NLQueryParser {
  private schema: EntitySchema[];
  private relationships: Relationship[];

  async parse(userQuery: string): Promise<ParsedQuery> {
    // Step 1: Extract intent (list, count, aggregate, compare)
    const intent = await this.extractIntent(userQuery);

    // Step 2: Identify entities mentioned
    const entities = await this.extractEntities(userQuery);

    // Step 3: Extract filters and conditions
    const filters = await this.extractFilters(userQuery);

    // Step 4: Determine output format
    const format = await this.determineFormat(userQuery);

    return {
      intent,
      entities,
      filters,
      format,
      confidence: this.calculateConfidence()
    };
  }

  // Examples of natural language queries:
  // "Show me all customers from New York"
  // "How many orders were placed last month?"
  // "What's the average order value by customer?"
  // "List products with low inventory"
}
```

---

## 5. Phase 3: Mastra.ai Integration

### 5.1 Mastra Instance for Generated Apps

**Template:** `templates/common/ai/mastra.ts.hbs`

```typescript
import { Mastra } from '@mastra/core';
import { dataQueryAgent } from './agents/data-query-agent';
import { insightsAgent } from './agents/insights-agent';
import { dataQueryWorkflow } from './workflows/data-query-workflow';

export const mastra = new Mastra({
  agents: {
    dataQueryAgent,
    insightsAgent
  },
  workflows: {
    dataQueryWorkflow
  }
});

export type MastraAgents = typeof mastra.agents;
export type MastraWorkflows = typeof mastra.workflows;
```

### 5.2 Data Query Workflow

**Template:** `templates/common/ai/workflows/data-query-workflow.ts.hbs`

```typescript
import { Workflow, Step } from '@mastra/core';
import { z } from 'zod';

export const dataQueryWorkflow = new Workflow({
  name: 'data-query',
  triggerSchema: z.object({
    query: z.string(),
    userId: z.string(),
    sessionId: z.string()
  })
})
  .step(validatePermissions)
  .step(parseNaturalLanguage)
  .step(buildSecureQuery)
  .step(executeQuery)
  .step(formatResults)
  .commit();

// Step 1: Validate user has access to requested data
const validatePermissions = new Step({
  id: 'validate-permissions',
  execute: async ({ context }) => {
    const { userId } = context.triggerData;
    const userPermissions = await getUserPermissions(userId);
    return { permissions: userPermissions };
  }
});

// Step 2: Parse natural language into structured query
const parseNaturalLanguage = new Step({
  id: 'parse-nl',
  execute: async ({ context }) => {
    const { query } = context.triggerData;
    const parsedQuery = await nlParser.parse(query);
    return { parsedQuery };
  }
});

// Step 3: Build query with RBAC filters
const buildSecureQuery = new Step({
  id: 'build-query',
  execute: async ({ context }) => {
    const { parsedQuery, permissions } = context;
    const secureQuery = await queryBuilder.build(parsedQuery, permissions);
    return { secureQuery };
  }
});

// Step 4: Execute against database
const executeQuery = new Step({
  id: 'execute-query',
  execute: async ({ context }) => {
    const { secureQuery } = context;
    const results = await database.execute(secureQuery);
    return { results };
  }
});

// Step 5: Format results for display
const formatResults = new Step({
  id: 'format-results',
  execute: async ({ context }) => {
    const { results, permissions } = context;
    const formatted = await formatWithFieldAccess(results, permissions);
    return { data: formatted };
  }
});
```

### 5.3 Insights Agent

**Template:** `templates/common/ai/agents/insights-agent.ts.hbs`

```typescript
export const insightsAgent = new Agent({
  name: 'Insights Agent',
  instructions: `
    You analyze data patterns and provide business insights.

    For the {{projectName}} application with these entities:
    {{#each entities}}
    - {{pascalCase name}}
    {{/each}}

    Provide insights such as:
    - Trends over time
    - Anomaly detection
    - Recommendations
    - Forecasts (when applicable)

    Always explain your reasoning and cite the data.
  `,
  model: {
    provider: 'ANTHROPIC',
    name: 'claude-sonnet-4-20250514'
  },
  tools: {
    analyzeTimeSeries: { /* ... */ },
    detectAnomalies: { /* ... */ },
    generateRecommendations: { /* ... */ }
  }
});
```

---

## 6. Phase 4: ANTLR4 SQL Validation

### 6.1 Overview

**IMPORTANT: ANTLR4 is used for VALIDATION ONLY - not for query execution.**

ANTLR4 (ANother Tool for Language Recognition) provides grammar-based parsing and validation for SQL queries. After validation passes, Knex.js Query Builder is used DIRECTLY to build and execute queries.

ANTLR4 validation ensures:

1. **Syntactic Correctness**: All generated SQL is grammatically valid
2. **Security Validation**: Dangerous operations are detected before execution
3. **Schema Compliance**: Queries reference only valid tables and columns
4. **Role-Based Permission Checking**: Validates user has permission to access requested entities/fields
5. **Query Complexity Limits**: Prevents overly complex or resource-intensive queries

### 6.2 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│              ANTLR4 SQL Validation (VALIDATION ONLY)            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  AI Generated SQL ──▶ Lexer ──▶ Parser ──▶ AST ──▶ Validator    │
│                                              │                   │
│                                              ▼                   │
│                                      ┌──────────────┐           │
│                                      │ Validation   │           │
│                                      │ Rules Engine │           │
│                                      └──────────────┘           │
│                                              │                   │
│                    ┌─────────────────────────┼─────────────────┐ │
│                    ▼              ▼          ▼         ▼       │ │
│              ┌──────────┐  ┌──────────┐  ┌────────┐ ┌────────┐ │ │
│              │ Syntax   │  │ Security │  │ Schema │ │ RBAC   │ │ │
│              │ Check    │  │ Check    │  │ Check  │ │ Perms  │ │ │
│              └──────────┘  └──────────┘  └────────┘ └────────┘ │ │
│                    │              │          │         │       │ │
│                    └─────────────────────────┼─────────────────┘ │
│                                              ▼                   │
│                                      ┌──────────────┐           │
│                                      │   Valid?     │           │
│                                      └──────────────┘           │
│                                         │       │               │
│                                    Yes ─┘       └─ No           │
│                                    │                │            │
│                                    ▼                ▼            │
│                         Use Knex.js QB     Return Error          │
│                         to build query                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

After ANTLR4 validation passes:
┌─────────────────────────────────────────────────────────────────┐
│                    Knex.js Query Builder                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Parsed Intent ──▶ Knex.js QueryBuilder ──▶ Execute ──▶ Results │
│                                                          │       │
│  Example:                                                ▼       │
│  knex('customers')                              ┌──────────────┐ │
│    .select('name', 'email')                     │  CopilotKit  │ │
│    .where('city', 'NYC')                        │  Display     │ │
│    .limit(50)                                   └──────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 ANTLR4 TypeScript Grammar Setup

**Package Dependencies:**

```json
{
  "dependencies": {
    "antlr4": "^4.13.1",
    "antlr4ts": "^0.5.0-alpha.4"
  },
  "devDependencies": {
    "antlr4ts-cli": "^0.5.0-alpha.4"
  }
}
```

**SQL Grammar File (Simplified):**

**Template:** `templates/common/ai/validators/grammars/SQL.g4`

```antlr
grammar SQL;

// Parser Rules
statement
    : selectStatement
    | insertStatement
    | updateStatement
    | deleteStatement
    ;

selectStatement
    : SELECT selectElements FROM tableSources
      (WHERE whereExpr)?
      (GROUP BY groupByItem (COMMA groupByItem)*)?
      (HAVING havingExpr)?
      (ORDER BY orderByItem (COMMA orderByItem)*)?
      (LIMIT limitClause)?
    ;

selectElements
    : STAR
    | selectElement (COMMA selectElement)*
    ;

selectElement
    : columnName (AS? alias)?
    | aggregateFunction (AS? alias)?
    ;

aggregateFunction
    : (COUNT | SUM | AVG | MIN | MAX) LPAREN (STAR | columnName) RPAREN
    ;

tableSources
    : tableSource (joinPart)*
    ;

tableSource
    : tableName (AS? alias)?
    ;

joinPart
    : joinType JOIN tableSource ON joinCondition
    ;

joinType
    : INNER
    | LEFT OUTER?
    | RIGHT OUTER?
    | FULL OUTER?
    ;

whereExpr
    : expr
    ;

expr
    : expr AND expr
    | expr OR expr
    | NOT expr
    | LPAREN expr RPAREN
    | predicate
    ;

predicate
    : columnName comparisonOperator value
    | columnName IS NOT? NULL
    | columnName IN LPAREN valueList RPAREN
    | columnName LIKE STRING
    | columnName BETWEEN value AND value
    ;

comparisonOperator
    : EQ | NE | LT | GT | LE | GE
    ;

// Lexer Rules
SELECT: S E L E C T;
FROM: F R O M;
WHERE: W H E R E;
AND: A N D;
OR: O R;
NOT: N O T;
NULL: N U L L;
IS: I S;
IN: I N;
LIKE: L I K E;
BETWEEN: B E T W E E N;
AS: A S;
ON: O N;
JOIN: J O I N;
INNER: I N N E R;
LEFT: L E F T;
RIGHT: R I G H T;
FULL: F U L L;
OUTER: O U T E R;
GROUP: G R O U P;
BY: B Y;
HAVING: H A V I N G;
ORDER: O R D E R;
LIMIT: L I M I T;
COUNT: C O U N T;
SUM: S U M;
AVG: A V G;
MIN: M I N;
MAX: M A X;

// Dangerous keywords (for security validation)
INSERT: I N S E R T;
UPDATE: U P D A T E;
DELETE: D E L E T E;
DROP: D R O P;
TRUNCATE: T R U N C A T E;
ALTER: A L T E R;
CREATE: C R E A T E;
GRANT: G R A N T;
REVOKE: R E V O K E;

STAR: '*';
COMMA: ',';
LPAREN: '(';
RPAREN: ')';
EQ: '=';
NE: '<>' | '!=';
LT: '<';
GT: '>';
LE: '<=';
GE: '>=';

IDENTIFIER: [a-zA-Z_][a-zA-Z0-9_]*;
STRING: '\'' (~'\'')* '\'';
NUMBER: [0-9]+ ('.' [0-9]+)?;

WS: [ \t\r\n]+ -> skip;

// Case insensitivity fragments
fragment A: [aA];
fragment B: [bB];
fragment C: [cC];
fragment D: [dD];
fragment E: [eE];
fragment F: [fF];
fragment G: [gG];
fragment H: [hH];
fragment I: [iI];
fragment J: [jJ];
fragment K: [kK];
fragment L: [lL];
fragment M: [mM];
fragment N: [nN];
fragment O: [oO];
fragment P: [pP];
fragment Q: [qQ];
fragment R: [rR];
fragment S: [sS];
fragment T: [tT];
fragment U: [uU];
fragment V: [vV];
fragment W: [wW];
fragment X: [xX];
fragment Y: [yY];
fragment Z: [zZ];
```

### 6.4 SQL Validator Implementation

**Template:** `templates/common/ai/validators/sql-validator.ts.hbs`

```typescript
import {
  CharStreams,
  CommonTokenStream,
  ANTLRErrorListener,
  RecognitionException,
  Recognizer
} from 'antlr4ts';
import { SQLLexer } from './generated/SQLLexer';
import { SQLParser, SelectStatementContext } from './generated/SQLParser';
import { SQLVisitor } from './generated/SQLVisitor';
import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor';

// Schema definition for validation
export interface SchemaDefinition {
  tables: Map<string, TableDefinition>;
}

export interface TableDefinition {
  name: string;
  columns: string[];
  allowedOperations: ('select' | 'insert' | 'update' | 'delete')[];
}

// Role-based permission definition for ANTLR4 validation
export interface RolePermissions {
  userId: string;
  roles: string[];
  tablePermissions: Map<string, TablePermission>;
  fieldPermissions: Map<string, Map<string, FieldPermission>>;
}

export interface TablePermission {
  canRead: boolean;
  canWrite: boolean;
  rowFilter?: string; // Optional RLS condition
}

export interface FieldPermission {
  isVisible: boolean;
  isEditable: boolean;
}

// Validation result
export interface SQLValidationResult {
  isValid: boolean;
  errors: SQLValidationError[];
  warnings: SQLValidationWarning[];
  ast?: ParsedSQL;
  complexity: QueryComplexity;
}

export interface SQLValidationError {
  type: 'syntax' | 'security' | 'schema' | 'complexity';
  message: string;
  line?: number;
  column?: number;
}

export interface SQLValidationWarning {
  type: 'performance' | 'best_practice';
  message: string;
}

export interface QueryComplexity {
  tableCount: number;
  joinCount: number;
  filterCount: number;
  aggregateCount: number;
  score: number; // 0-100, higher = more complex
}

export interface ParsedSQL {
  type: 'select' | 'insert' | 'update' | 'delete';
  tables: string[];
  columns: string[];
  joins: JoinInfo[];
  filters: FilterInfo[];
  aggregates: AggregateInfo[];
  orderBy?: OrderByInfo[];
  limit?: number;
}

// Custom error listener
class SQLErrorListener implements ANTLRErrorListener<any> {
  errors: SQLValidationError[] = [];

  syntaxError(
    recognizer: Recognizer<any, any>,
    offendingSymbol: any,
    line: number,
    charPositionInLine: number,
    msg: string,
    e: RecognitionException | undefined
  ): void {
    this.errors.push({
      type: 'syntax',
      message: msg,
      line,
      column: charPositionInLine
    });
  }
}

// AST Visitor for extracting query information
class SQLAnalyzerVisitor extends AbstractParseTreeVisitor<ParsedSQL>
  implements SQLVisitor<ParsedSQL> {

  private schema: SchemaDefinition;
  private result: ParsedSQL = {
    type: 'select',
    tables: [],
    columns: [],
    joins: [],
    filters: [],
    aggregates: []
  };

  constructor(schema: SchemaDefinition) {
    super();
    this.schema = schema;
  }

  protected defaultResult(): ParsedSQL {
    return this.result;
  }

  visitSelectStatement(ctx: SelectStatementContext): ParsedSQL {
    this.result.type = 'select';
    // Extract tables, columns, joins from context
    this.visitChildren(ctx);
    return this.result;
  }
}

// Main Validator Class
// IMPORTANT: This validator is for VALIDATION ONLY - query execution uses Knex.js Query Builder directly
export class ANTLR4SQLValidator {
  private schema: SchemaDefinition;
  private permissions: RolePermissions;
  private maxComplexityScore: number;
  private dangerousKeywords: Set<string>;

  constructor(
    schema: SchemaDefinition,
    permissions: RolePermissions,
    options?: {
      maxComplexityScore?: number;
    }
  ) {
    this.schema = schema;
    this.permissions = permissions;
    this.maxComplexityScore = options?.maxComplexityScore ?? 80;
    this.dangerousKeywords = new Set([
      'DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'GRANT', 'REVOKE',
      'INSERT', 'UPDATE', 'DELETE' // Only SELECT allowed for AI queries
    ]);
  }

  validate(sql: string): SQLValidationResult {
    const errors: SQLValidationError[] = [];
    const warnings: SQLValidationWarning[] = [];

    // Step 1: Pre-validation (quick regex checks)
    const preValidation = this.preValidate(sql);
    if (!preValidation.isValid) {
      return {
        isValid: false,
        errors: preValidation.errors,
        warnings: [],
        complexity: { tableCount: 0, joinCount: 0, filterCount: 0, aggregateCount: 0, score: 0 }
      };
    }

    // Step 2: Lexical and Syntactic Analysis
    const inputStream = CharStreams.fromString(sql);
    const lexer = new SQLLexer(inputStream);
    const tokenStream = new CommonTokenStream(lexer);
    const parser = new SQLParser(tokenStream);

    // Add error listener
    const errorListener = new SQLErrorListener();
    parser.removeErrorListeners();
    parser.addErrorListener(errorListener);

    // Parse
    const tree = parser.statement();

    // Check for syntax errors
    if (errorListener.errors.length > 0) {
      return {
        isValid: false,
        errors: errorListener.errors,
        warnings: [],
        complexity: { tableCount: 0, joinCount: 0, filterCount: 0, aggregateCount: 0, score: 0 }
      };
    }

    // Step 3: Semantic Analysis with AST Visitor
    const visitor = new SQLAnalyzerVisitor(this.schema);
    const ast = visitor.visit(tree);

    // Step 4: Schema Validation
    const schemaErrors = this.validateSchema(ast);
    errors.push(...schemaErrors);

    // Step 5: Security Validation
    const securityErrors = this.validateSecurity(ast, sql);
    errors.push(...securityErrors);

    // Step 6: Role-Based Permission Validation (NEW)
    const permissionErrors = this.validatePermissions(ast);
    errors.push(...permissionErrors);

    // Step 7: Complexity Analysis
    const complexity = this.calculateComplexity(ast);
    if (complexity.score > this.maxComplexityScore) {
      errors.push({
        type: 'complexity',
        message: `Query complexity score (${complexity.score}) exceeds maximum allowed (${this.maxComplexityScore})`
      });
    }

    // Step 7: Performance Warnings
    warnings.push(...this.checkPerformance(ast));

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      ast,
      complexity
    };
  }

  private preValidate(sql: string): { isValid: boolean; errors: SQLValidationError[] } {
    const errors: SQLValidationError[] = [];
    const upperSQL = sql.toUpperCase();

    // Check for dangerous keywords
    for (const keyword of this.dangerousKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(sql)) {
        errors.push({
          type: 'security',
          message: `Dangerous SQL keyword detected: ${keyword}. Only SELECT queries are allowed.`
        });
      }
    }

    // Check for SQL injection patterns
    const injectionPatterns = [
      /;\s*--/,           // Comment injection
      /'\s*OR\s+'1'\s*=\s*'1/i,  // Classic OR injection
      /UNION\s+SELECT/i,   // Union injection
      /\/\*.*\*\//,        // Block comment
      /xp_/i,              // SQL Server extended procedures
      /EXEC\s*\(/i,        // Execute
      /EXECUTE\s*\(/i
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(sql)) {
        errors.push({
          type: 'security',
          message: 'Potential SQL injection pattern detected'
        });
        break;
      }
    }

    // Check length
    if (sql.length > 10000) {
      errors.push({
        type: 'security',
        message: 'Query exceeds maximum length (10000 characters)'
      });
    }

    return { isValid: errors.length === 0, errors };
  }

  private validateSchema(ast: ParsedSQL): SQLValidationError[] {
    const errors: SQLValidationError[] = [];

    // Validate tables exist
    for (const tableName of ast.tables) {
      if (!this.schema.tables.has(tableName.toLowerCase())) {
        errors.push({
          type: 'schema',
          message: `Table '${tableName}' does not exist in schema`
        });
      }
    }

    // Validate columns exist in referenced tables
    for (const column of ast.columns) {
      const [tableAlias, columnName] = column.includes('.')
        ? column.split('.')
        : [ast.tables[0], column];

      const table = this.schema.tables.get(tableAlias?.toLowerCase());
      if (table && !table.columns.includes(columnName.toLowerCase())) {
        errors.push({
          type: 'schema',
          message: `Column '${columnName}' does not exist in table '${tableAlias}'`
        });
      }
    }

    return errors;
  }

  private validateSecurity(ast: ParsedSQL, sql: string): SQLValidationError[] {
    const errors: SQLValidationError[] = [];

    // Only SELECT is allowed for AI queries
    if (ast.type !== 'select') {
      errors.push({
        type: 'security',
        message: `Only SELECT queries are allowed. Found: ${ast.type.toUpperCase()}`
      });
    }

    // Check table permissions
    for (const tableName of ast.tables) {
      const table = this.schema.tables.get(tableName.toLowerCase());
      if (table && !table.allowedOperations.includes('select')) {
        errors.push({
          type: 'security',
          message: `SELECT operation not allowed on table '${tableName}'`
        });
      }
    }

    return errors;
  }

  /**
   * NEW: Validate role-based permissions on entities and fields
   * Checks if the user has permission to access the requested tables and columns
   */
  private validatePermissions(ast: ParsedSQL): SQLValidationError[] {
    const errors: SQLValidationError[] = [];

    // Check table-level permissions based on user's roles
    for (const tableName of ast.tables) {
      const tablePermission = this.permissions.tablePermissions.get(tableName.toLowerCase());

      if (!tablePermission) {
        errors.push({
          type: 'security',
          message: `Access denied: User does not have permission to access table '${tableName}'`
        });
        continue;
      }

      if (!tablePermission.canRead) {
        errors.push({
          type: 'security',
          message: `Access denied: User's role does not allow reading from table '${tableName}'`
        });
      }
    }

    // Check field-level permissions based on user's roles
    for (const column of ast.columns) {
      if (column === '*') {
        // SELECT * - check all fields in referenced tables
        for (const tableName of ast.tables) {
          const fieldPerms = this.permissions.fieldPermissions.get(tableName.toLowerCase());
          if (fieldPerms) {
            for (const [fieldName, fieldPerm] of fieldPerms) {
              if (!fieldPerm.isVisible) {
                errors.push({
                  type: 'security',
                  message: `Access denied: SELECT * includes hidden field '${tableName}.${fieldName}'. Specify columns explicitly.`
                });
                break; // One error for SELECT * is enough
              }
            }
          }
        }
        continue;
      }

      // Parse table.column or just column
      const [tableAlias, columnName] = column.includes('.')
        ? column.split('.')
        : [ast.tables[0], column];

      const fieldPerms = this.permissions.fieldPermissions.get(tableAlias?.toLowerCase());
      if (fieldPerms) {
        const fieldPerm = fieldPerms.get(columnName.toLowerCase());
        if (fieldPerm && !fieldPerm.isVisible) {
          errors.push({
            type: 'security',
            message: `Access denied: User's role does not allow viewing field '${tableAlias}.${columnName}'`
          });
        }
      }
    }

    // Check filter fields - users shouldn't filter on fields they can't see
    for (const filter of ast.filters) {
      const fieldName = filter.field;
      const tableName = filter.field.includes('.')
        ? filter.field.split('.')[0]
        : ast.tables[0];
      const actualFieldName = filter.field.includes('.')
        ? filter.field.split('.')[1]
        : filter.field;

      const fieldPerms = this.permissions.fieldPermissions.get(tableName?.toLowerCase());
      if (fieldPerms) {
        const fieldPerm = fieldPerms.get(actualFieldName.toLowerCase());
        if (fieldPerm && !fieldPerm.isVisible) {
          errors.push({
            type: 'security',
            message: `Access denied: Cannot filter by hidden field '${tableName}.${actualFieldName}'`
          });
        }
      }
    }

    return errors;
  }

  private calculateComplexity(ast: ParsedSQL): QueryComplexity {
    const tableCount = ast.tables.length;
    const joinCount = ast.joins.length;
    const filterCount = ast.filters.length;
    const aggregateCount = ast.aggregates.length;

    // Complexity scoring formula
    const score = Math.min(100,
      (tableCount * 10) +
      (joinCount * 15) +
      (filterCount * 5) +
      (aggregateCount * 10) +
      (ast.orderBy?.length ?? 0) * 5
    );

    return { tableCount, joinCount, filterCount, aggregateCount, score };
  }

  private checkPerformance(ast: ParsedSQL): SQLValidationWarning[] {
    const warnings: SQLValidationWarning[] = [];

    // Warn about SELECT *
    if (ast.columns.includes('*')) {
      warnings.push({
        type: 'performance',
        message: 'SELECT * should be avoided. Specify columns explicitly.'
      });
    }

    // Warn about missing LIMIT
    if (!ast.limit) {
      warnings.push({
        type: 'best_practice',
        message: 'Query does not have a LIMIT clause. Consider adding one for large tables.'
      });
    }

    // Warn about many JOINs
    if (ast.joins.length > 3) {
      warnings.push({
        type: 'performance',
        message: `Query has ${ast.joins.length} JOINs. Consider simplifying.`
      });
    }

    return warnings;
  }
}
```

### 6.5 Knex.js Query Builder (Direct Query Execution)

**IMPORTANT**: After ANTLR4 validation passes, Knex.js Query Builder is used DIRECTLY to build and execute queries. There is NO SQL-to-Knex conversion - queries are built using the Knex.js API directly from the parsed intent.

**Why Knex.js Query Builder?**
- Type-safe query construction
- Automatic SQL injection prevention via parameterization
- Consistent API across SQLite and PostgreSQL
- Built-in connection pooling and timeout management
- Chainable, readable query syntax

**Template:** `templates/common/ai/query-builder/knex-query-builder.ts.hbs`

```typescript
import { Knex } from 'knex';
import { RolePermissions } from '../validators/sql-validator';

/**
 * Parsed intent from Mastra.ai NL processing
 * This is NOT SQL - it's a structured representation of what the user wants
 */
export interface QueryIntent {
  entity: string;                    // e.g., 'Customer', 'Order'
  operation: 'list' | 'count' | 'aggregate';
  fields?: string[];                 // Specific fields to select
  filters?: FilterIntent[];          // WHERE conditions
  aggregations?: AggregationIntent[];// COUNT, SUM, AVG, etc.
  groupBy?: string[];
  orderBy?: OrderByIntent[];
  limit?: number;
  joins?: JoinIntent[];
}

export interface FilterIntent {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'like' | 'in' | 'between' | 'isNull' | 'isNotNull';
  value: unknown;
  connector?: 'AND' | 'OR';
}

export interface AggregationIntent {
  function: 'count' | 'sum' | 'avg' | 'min' | 'max';
  field: string;
  alias?: string;
}

export interface OrderByIntent {
  field: string;
  direction: 'asc' | 'desc';
}

export interface JoinIntent {
  entity: string;
  type: 'inner' | 'left' | 'right';
  on: { leftField: string; rightField: string };
}

/**
 * Builds Knex.js queries DIRECTLY from parsed intent
 * Used by AI Natural Language feature for BOTH Option 1 and Option 2 stacks
 *
 * IMPORTANT: This does NOT convert SQL to Knex - it builds Knex queries
 * directly from the structured intent parsed by Mastra.ai
 */
export class KnexQueryBuilder {
  constructor(
    private db: Knex,
    private permissions: RolePermissions
  ) {}

  /**
   * Build a Knex.js query from parsed NL intent
   * @param intent - Structured query intent from Mastra.ai
   * @returns Knex query builder ready for execution
   */
  buildQuery(intent: QueryIntent): Knex.QueryBuilder {
    const tableName = this.getTableName(intent.entity);

    // Start building the query
    let query = this.db(tableName);

    // Add field selection
    query = this.addSelect(query, intent, tableName);

    // Add joins if requested
    if (intent.joins?.length) {
      query = this.addJoins(query, intent.joins, tableName);
    }

    // Add WHERE filters
    if (intent.filters?.length) {
      query = this.addFilters(query, intent.filters, tableName);
    }

    // Add row-level security filter based on user's role
    query = this.addRLSFilter(query, tableName);

    // Add GROUP BY
    if (intent.groupBy?.length) {
      query = query.groupBy(intent.groupBy.map(f => `${tableName}.${f}`));
    }

    // Add ORDER BY
    if (intent.orderBy?.length) {
      for (const order of intent.orderBy) {
        query = query.orderBy(`${tableName}.${order.field}`, order.direction);
      }
    }

    // Add LIMIT (max 100 for AI queries)
    const limit = Math.min(intent.limit || 50, 100);
    query = query.limit(limit);

    return query;
  }

  /**
   * Map entity name to database table name
   */
  private getTableName(entity: string): string {
    // Business entities use 'bus_' prefix
    return `bus_${entity.toLowerCase()}`;
  }

  /**
   * Add SELECT clause using Knex.js select() method
   */
  private addSelect(
    query: Knex.QueryBuilder,
    intent: QueryIntent,
    tableName: string
  ): Knex.QueryBuilder {
    const selections: (string | Knex.Raw)[] = [];

    // Get allowed fields based on user's role permissions
    const allowedFields = this.getAllowedFields(tableName);

    if (intent.operation === 'count' && !intent.fields?.length) {
      // Simple count query
      return query.count('* as count');
    }

    if (intent.aggregations?.length) {
      // Add aggregation functions
      for (const agg of intent.aggregations) {
        if (!allowedFields.includes(agg.field) && agg.field !== '*') {
          continue; // Skip fields user can't access
        }
        selections.push(this.buildAggregation(agg));
      }
    }

    if (intent.fields?.length) {
      // Select specific fields (filtered by permissions)
      for (const field of intent.fields) {
        if (allowedFields.includes(field)) {
          selections.push(`${tableName}.${field}`);
        }
      }
    } else if (!intent.aggregations?.length) {
      // Select all allowed fields
      for (const field of allowedFields) {
        selections.push(`${tableName}.${field}`);
      }
    }

    return selections.length > 0 ? query.select(selections) : query;
  }

  /**
   * Build aggregation using Knex.js methods
   */
  private buildAggregation(agg: AggregationIntent): Knex.Raw {
    const field = agg.field === '*' ? '*' : agg.field;
    const alias = agg.alias || `${agg.function}_${field}`;

    // Use Knex.js aggregation methods
    switch (agg.function) {
      case 'count':
        return this.db.raw(`COUNT(${field}) as ??`, [alias]);
      case 'sum':
        return this.db.raw(`SUM(??) as ??`, [field, alias]);
      case 'avg':
        return this.db.raw(`AVG(??) as ??`, [field, alias]);
      case 'min':
        return this.db.raw(`MIN(??) as ??`, [field, alias]);
      case 'max':
        return this.db.raw(`MAX(??) as ??`, [field, alias]);
      default:
        throw new Error(`Unsupported aggregation: ${agg.function}`);
    }
  }

  /**
   * Add JOIN clauses using Knex.js join methods
   */
  private addJoins(
    query: Knex.QueryBuilder,
    joins: JoinIntent[],
    sourceTable: string
  ): Knex.QueryBuilder {
    for (const join of joins) {
      const targetTable = this.getTableName(join.entity);

      // Check if user has permission to access joined table
      const targetPermission = this.permissions.tablePermissions.get(targetTable);
      if (!targetPermission?.canRead) {
        continue; // Skip joins to tables user can't access
      }

      const leftCol = `${sourceTable}.${join.on.leftField}`;
      const rightCol = `${targetTable}.${join.on.rightField}`;

      switch (join.type) {
        case 'inner':
          query = query.innerJoin(targetTable, leftCol, rightCol);
          break;
        case 'left':
          query = query.leftJoin(targetTable, leftCol, rightCol);
          break;
        case 'right':
          query = query.rightJoin(targetTable, leftCol, rightCol);
          break;
      }
    }
    return query;
  }

  /**
   * Add WHERE filters using Knex.js where methods
   */
  private addFilters(
    query: Knex.QueryBuilder,
    filters: FilterIntent[],
    tableName: string
  ): Knex.QueryBuilder {
    const allowedFields = this.getAllowedFields(tableName);

    for (const filter of filters) {
      // Skip filters on fields user can't access
      if (!allowedFields.includes(filter.field)) {
        continue;
      }

      const column = `${tableName}.${filter.field}`;
      const useOr = filter.connector === 'OR';

      // Use Knex.js where methods directly
      switch (filter.operator) {
        case 'eq':
          query = useOr
            ? query.orWhere(column, filter.value)
            : query.where(column, filter.value);
          break;
        case 'ne':
          query = useOr
            ? query.orWhereNot(column, filter.value)
            : query.whereNot(column, filter.value);
          break;
        case 'gt':
          query = useOr
            ? query.orWhere(column, '>', filter.value)
            : query.where(column, '>', filter.value);
          break;
        case 'lt':
          query = useOr
            ? query.orWhere(column, '<', filter.value)
            : query.where(column, '<', filter.value);
          break;
        case 'gte':
          query = useOr
            ? query.orWhere(column, '>=', filter.value)
            : query.where(column, '>=', filter.value);
          break;
        case 'lte':
          query = useOr
            ? query.orWhere(column, '<=', filter.value)
            : query.where(column, '<=', filter.value);
          break;
        case 'like':
          query = useOr
            ? query.orWhere(column, 'like', `%${filter.value}%`)
            : query.where(column, 'like', `%${filter.value}%`);
          break;
        case 'in':
          query = useOr
            ? query.orWhereIn(column, filter.value as any[])
            : query.whereIn(column, filter.value as any[]);
          break;
        case 'between':
          const [min, max] = filter.value as [any, any];
          query = useOr
            ? query.orWhereBetween(column, [min, max])
            : query.whereBetween(column, [min, max]);
          break;
        case 'isNull':
          query = useOr
            ? query.orWhereNull(column)
            : query.whereNull(column);
          break;
        case 'isNotNull':
          query = useOr
            ? query.orWhereNotNull(column)
            : query.whereNotNull(column);
          break;
      }
    }
    return query;
  }

  /**
   * Add row-level security filter based on user's role
   */
  private addRLSFilter(query: Knex.QueryBuilder, tableName: string): Knex.QueryBuilder {
    const tablePermission = this.permissions.tablePermissions.get(tableName);

    if (tablePermission?.rowFilter) {
      // Apply RLS condition (e.g., owner_id = userId)
      query = query.whereRaw(tablePermission.rowFilter);
    }

    return query;
  }

  /**
   * Get list of fields user is allowed to access based on their role
   */
  private getAllowedFields(tableName: string): string[] {
    const fieldPerms = this.permissions.fieldPermissions.get(tableName);
    if (!fieldPerms) return [];

    return Array.from(fieldPerms.entries())
      .filter(([_, perm]) => perm.isVisible)
      .map(([field, _]) => field);
  }
}
```

**Usage Example:**

```typescript
// After ANTLR4 validation passes, use Knex.js Query Builder directly:

// 1. User asks: "Show me all customers from New York"
const intent: QueryIntent = {
  entity: 'Customer',
  operation: 'list',
  fields: ['id', 'name', 'email', 'city'],
  filters: [
    { field: 'city', operator: 'eq', value: 'New York' }
  ],
  limit: 50
};

// 2. Build query using Knex.js (NOT SQL conversion)
const queryBuilder = new KnexQueryBuilder(db, userPermissions);
const query = queryBuilder.buildQuery(intent);

// 3. Execute and get results
const results = await query;

// 4. Display in CopilotKit
return { data: results, count: results.length };
```

### 6.6 Integration with Mastra.ai Workflow

**Updated Workflow with ANTLR4 Validation and Knex.js Query Builder:**

This workflow is used by BOTH Option 1 (NestJS + Next.js) and Option 2 (OData + OpenUI5) for AI natural language queries. It bypasses the native data access layers (NestJS services / OData controllers) and uses Knex.js Query Builder directly.

**Key Flow:**
```
User NL Query → Mastra.ai (Parse Intent) → ANTLR4 (Validate) → Knex.js QB (Build & Execute) → CopilotKit (Display)
```

**Template:** `templates/common/ai/workflows/data-query-workflow.ts.hbs`

```typescript
import { Workflow, Step } from '@mastra/core';
import { z } from 'zod';
import { ANTLR4SQLValidator } from '../validators/sql-validator';
import { KnexQueryBuilder, QueryIntent } from '../query-builder/knex-query-builder';
import { RBACService } from '../../services/rbac.service';

/**
 * Data Query Workflow for AI Natural Language Access
 *
 * FLOW:
 * 1. Get user permissions (RBAC)
 * 2. Parse NL to structured intent (Mastra.ai Agent)
 * 3. Validate with ANTLR4 (syntax, schema, permissions)
 * 4. Build query using Knex.js Query Builder DIRECTLY
 * 5. Execute query
 * 6. Format results for CopilotKit display
 *
 * IMPORTANT: This workflow uses Knex.js Query Builder for BOTH Option 1 and Option 2.
 * ANTLR4 is for VALIDATION ONLY - Knex.js builds queries directly from parsed intent.
 */
export const dataQueryWorkflow = new Workflow({
  name: 'data-query',
  triggerSchema: z.object({
    query: z.string(),
    userId: z.string(),
    sessionId: z.string()
  })
})
  .step(validatePermissions)
  .step(parseNaturalLanguage)       // Parse NL to QueryIntent
  .step(validateWithANTLR4)         // ANTLR4 validates syntax & permissions
  .step(buildWithKnexQueryBuilder)  // Knex.js builds query DIRECTLY
  .step(executeQuery)               // Execute via Knex.js
  .step(formatForCopilotKit)        // Format for display
  .commit();

// Step 1: Get user permissions from RBAC
const validatePermissions = new Step({
  id: 'validate-permissions',
  execute: async ({ context }) => {
    const { userId } = context.triggerData;
    const rbacService = new RBACService(context.db);
    const permissions = await rbacService.getUserPermissions(userId);
    return { permissions };
  }
});

// Step 2: Parse natural language into structured QueryIntent
const parseNaturalLanguage = new Step({
  id: 'parse-nl',
  execute: async ({ context }) => {
    const { query } = context.triggerData;

    // Mastra.ai agent parses NL to QueryIntent structure
    // This returns entity, operation, filters, etc. - NOT SQL
    const intent: QueryIntent = await context.nlParser.parseToIntent(query);

    return { intent };
  }
});

// Step 3: Validate with ANTLR4 (syntax, schema, permissions)
// IMPORTANT: ANTLR4 is for VALIDATION ONLY
const validateWithANTLR4 = new Step({
  id: 'validate-antlr4',
  execute: async ({ context }) => {
    const { intent, permissions } = context;

    // Build schema definition from database
    const schemaDefinition = await buildSchemaDefinition(context.db);

    // Create validator with schema AND permissions
    const validator = new ANTLR4SQLValidator(
      schemaDefinition,
      permissions, // Pass user's role permissions for validation
      { maxComplexityScore: 80 }
    );

    // Generate SQL representation for validation purposes
    const sqlForValidation = intentToSQLForValidation(intent);

    // Validate SQL syntax, schema compliance, and role-based permissions
    const validationResult = validator.validate(sqlForValidation);

    if (!validationResult.isValid) {
      // Log validation failure for security audit
      await context.auditLog.log({
        type: 'query_validation_failure',
        userId: context.triggerData.userId,
        query: context.triggerData.query,
        errors: validationResult.errors
      });

      throw new Error(
        `Query validation failed: ${validationResult.errors.map(e => e.message).join('; ')}`
      );
    }

    // Log warnings if any
    if (validationResult.warnings.length > 0) {
      console.warn('Query validation warnings:', validationResult.warnings);
    }

    return {
      validatedIntent: intent,
      complexity: validationResult.complexity
    };
  }
});

// Step 4: Build query using Knex.js Query Builder DIRECTLY
// IMPORTANT: This does NOT convert SQL - it builds Knex queries from intent
const buildWithKnexQueryBuilder = new Step({
  id: 'build-knex-query',
  execute: async ({ context }) => {
    const { validatedIntent, permissions } = context;

    // Use Knex.js Query Builder DIRECTLY - NOT SQL conversion
    const knexBuilder = new KnexQueryBuilder(context.db, permissions);
    const query = knexBuilder.buildQuery(validatedIntent);

    return { knexQuery: query };
  }
});

// Step 5: Execute query via Knex.js
const executeQuery = new Step({
  id: 'execute-query',
  execute: async ({ context }) => {
    const { knexQuery } = context;

    // Execute the Knex.js query with timeout
    // Knex.js handles parameterization automatically (SQL injection safe)
    const results = await knexQuery.timeout(30000); // 30 second timeout

    return { results };
  }
});

// Step 6: Format results for CopilotKit display
const formatForCopilotKit = new Step({
  id: 'format-for-copilotkit',
  execute: async ({ context }) => {
    const { results, permissions, validatedIntent } = context;

    // Format results for CopilotKit chat display
    const formatted = {
      data: results,
      count: results.length,
      entity: validatedIntent.entity,
      query: context.triggerData.query,
      // Include metadata for CopilotKit UI
      displayHint: getDisplayHint(validatedIntent)
    };

    return formatted;
  }
});

// Helper: Generate SQL for validation purposes only
function intentToSQLForValidation(intent: QueryIntent): string {
  // This generates SQL purely for ANTLR4 validation
  // The actual query execution uses Knex.js Query Builder
  const table = `bus_${intent.entity.toLowerCase()}`;
  const fields = intent.fields?.join(', ') || '*';
  let sql = `SELECT ${fields} FROM ${table}`;

  if (intent.filters?.length) {
    const conditions = intent.filters.map(f =>
      `${f.field} ${operatorToSQL(f.operator)} ?`
    ).join(' AND ');
    sql += ` WHERE ${conditions}`;
  }

  if (intent.limit) {
    sql += ` LIMIT ${intent.limit}`;
  }

  return sql;
}

// Helper: Determine how CopilotKit should display results
function getDisplayHint(intent: QueryIntent): 'table' | 'chart' | 'number' {
  if (intent.operation === 'count') return 'number';
  if (intent.aggregations?.length) return 'chart';
  return 'table';
}

// Helper: Build schema definition from database metadata
async function buildSchemaDefinition(
  db: Knex,
  permissions: UserPermissions
): Promise<SchemaDefinition> {
  const tables = new Map<string, TableDefinition>();

  // Get all accessible tables for this user
  for (const [tableName, access] of permissions.tableAccess) {
    if (access.canRead) {
      // Get column names from database
      const columns = await db(tableName).columnInfo();

      // Filter by field-level access
      const visibleColumns = Object.keys(columns).filter(col => {
        const fieldAccess = permissions.fieldAccess.get(tableName)?.get(col);
        return fieldAccess?.isVisible !== false;
      });

      tables.set(tableName, {
        name: tableName,
        columns: visibleColumns,
        allowedOperations: [
          access.canRead ? 'select' : null,
          access.canCreate ? 'insert' : null,
          access.canUpdate ? 'update' : null,
          access.canDelete ? 'delete' : null
        ].filter(Boolean) as any[]
      });
    }
  }

  return { tables };
}
```

### 6.6 ANTLR4 Build Script

**Template:** `templates/common/ai/validators/build-grammar.sh`

```bash
#!/bin/bash

# Build ANTLR4 TypeScript parser from grammar
# Requires: npm install -g antlr4ts-cli

GRAMMAR_DIR="$(dirname "$0")/grammars"
OUTPUT_DIR="$(dirname "$0")/generated"

mkdir -p "$OUTPUT_DIR"

# Generate TypeScript lexer and parser
antlr4ts \
  -visitor \
  -listener \
  -o "$OUTPUT_DIR" \
  "$GRAMMAR_DIR/SQL.g4"

echo "ANTLR4 SQL parser generated successfully!"
```

### 6.7 ANTLR4 Validation Test Cases

**Template:** `templates/common/ai/validators/__tests__/sql-validator.test.ts.hbs`

```typescript
import { ANTLR4SQLValidator, SchemaDefinition } from '../sql-validator';

describe('ANTLR4SQLValidator', () => {
  const schema: SchemaDefinition = {
    tables: new Map([
      ['bus_customer', {
        name: 'bus_customer',
        columns: ['id', 'name', 'email', 'city', 'created_at'],
        allowedOperations: ['select']
      }],
      ['bus_order', {
        name: 'bus_order',
        columns: ['id', 'customer_id', 'total', 'status', 'created_at'],
        allowedOperations: ['select']
      }]
    ])
  };

  let validator: ANTLR4SQLValidator;

  beforeEach(() => {
    validator = new ANTLR4SQLValidator(schema);
  });

  describe('Syntax Validation', () => {
    it('should accept valid SELECT query', () => {
      const sql = 'SELECT id, name FROM bus_customer WHERE city = \'NYC\'';
      const result = validator.validate(sql);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid syntax', () => {
      const sql = 'SELCT id FROM bus_customer'; // Typo
      const result = validator.validate(sql);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].type).toBe('syntax');
    });

    it('should accept JOINs', () => {
      const sql = `
        SELECT c.name, o.total
        FROM bus_customer c
        INNER JOIN bus_order o ON c.id = o.customer_id
      `;
      const result = validator.validate(sql);
      expect(result.isValid).toBe(true);
    });

    it('should accept aggregations', () => {
      const sql = `
        SELECT city, COUNT(*) as count
        FROM bus_customer
        GROUP BY city
        HAVING COUNT(*) > 5
      `;
      const result = validator.validate(sql);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Security Validation', () => {
    it('should reject DELETE statements', () => {
      const sql = 'DELETE FROM bus_customer WHERE id = 1';
      const result = validator.validate(sql);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'security')).toBe(true);
    });

    it('should reject UPDATE statements', () => {
      const sql = 'UPDATE bus_customer SET name = \'hacked\'';
      const result = validator.validate(sql);
      expect(result.isValid).toBe(false);
    });

    it('should reject DROP statements', () => {
      const sql = 'DROP TABLE bus_customer';
      const result = validator.validate(sql);
      expect(result.isValid).toBe(false);
    });

    it('should reject SQL injection attempts', () => {
      const sql = 'SELECT * FROM bus_customer WHERE id = 1; DROP TABLE bus_customer; --';
      const result = validator.validate(sql);
      expect(result.isValid).toBe(false);
    });

    it('should reject UNION injection', () => {
      const sql = 'SELECT id FROM bus_customer UNION SELECT password FROM sys_user';
      const result = validator.validate(sql);
      expect(result.isValid).toBe(false);
    });
  });

  describe('Schema Validation', () => {
    it('should reject non-existent tables', () => {
      const sql = 'SELECT * FROM non_existent_table';
      const result = validator.validate(sql);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].type).toBe('schema');
    });

    it('should reject non-existent columns', () => {
      const sql = 'SELECT non_existent_column FROM bus_customer';
      const result = validator.validate(sql);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].type).toBe('schema');
    });
  });

  describe('Complexity Validation', () => {
    it('should calculate complexity score', () => {
      const sql = `
        SELECT c.name, COUNT(o.id), SUM(o.total)
        FROM bus_customer c
        INNER JOIN bus_order o ON c.id = o.customer_id
        WHERE c.city = 'NYC'
        GROUP BY c.name
        ORDER BY SUM(o.total) DESC
        LIMIT 10
      `;
      const result = validator.validate(sql);
      expect(result.complexity.tableCount).toBe(2);
      expect(result.complexity.joinCount).toBe(1);
      expect(result.complexity.aggregateCount).toBe(2);
    });

    it('should reject overly complex queries', () => {
      const complexSQL = `
        SELECT a.*, b.*, c.*, d.*, e.*
        FROM table_a a
        JOIN table_b b ON a.id = b.a_id
        JOIN table_c c ON b.id = c.b_id
        JOIN table_d d ON c.id = d.c_id
        JOIN table_e e ON d.id = e.d_id
        WHERE a.x > 1 AND b.y < 2 AND c.z = 3
      `;
      const validator = new ANTLR4SQLValidator(schema, { maxComplexityScore: 50 });
      const result = validator.validate(complexSQL);
      expect(result.errors.some(e => e.type === 'complexity')).toBe(true);
    });
  });

  describe('Performance Warnings', () => {
    it('should warn about SELECT *', () => {
      const sql = 'SELECT * FROM bus_customer';
      const result = validator.validate(sql);
      expect(result.warnings.some(w => w.message.includes('SELECT *'))).toBe(true);
    });

    it('should warn about missing LIMIT', () => {
      const sql = 'SELECT id FROM bus_customer';
      const result = validator.validate(sql);
      expect(result.warnings.some(w => w.message.includes('LIMIT'))).toBe(true);
    });
  });
});
```

---

## 7. Phase 5: CopilotKit Integration

### 7.1 CopilotKit Provider Setup

**Template:** `templates/option1-modern-web/frontend/src/providers/copilot-provider.tsx.hbs`

```tsx
'use client';

import { CopilotKit } from '@copilotkit/react-core';
import { CopilotSidebar } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <CopilotSidebar
        defaultOpen={false}
        labels={{
          title: "{{projectName}} Assistant",
          initial: "Hi! I can help you explore your data. Try asking me questions like:\n\n• Show me all customers\n• How many orders were placed this month?\n• What are the top selling products?"
        }}
      >
        {children}
      </CopilotSidebar>
    </CopilotKit>
  );
}
```

### 6.2 CopilotKit Backend Runtime

**Template:** `templates/option1-modern-web/frontend/src/app/api/copilotkit/route.ts.hbs`

```typescript
import { CopilotRuntime, AnthropicAdapter } from '@copilotkit/runtime';
import Anthropic from '@anthropic-ai/sdk';
import { getServerSession } from 'next-auth';
import { mastra } from '@/lib/ai/mastra';

const runtime = new CopilotRuntime({
  actions: [
    {
      name: 'queryData',
      description: 'Query application data using natural language',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'The natural language query'
        }
      ],
      handler: async ({ query }, { properties }) => {
        const session = await getServerSession();
        if (!session?.user) {
          return { error: 'Unauthorized' };
        }

        // Execute through Mastra workflow with RBAC
        const result = await mastra.workflows.dataQueryWorkflow.execute({
          triggerData: {
            query,
            userId: session.user.id,
            sessionId: properties.sessionId
          }
        });

        return result.data;
      }
    },
    {
      name: 'getInsights',
      description: 'Get AI-powered insights about your data',
      parameters: [
        {
          name: 'topic',
          type: 'string',
          description: 'What to analyze'
        }
      ],
      handler: async ({ topic }, { properties }) => {
        const session = await getServerSession();
        if (!session?.user) {
          return { error: 'Unauthorized' };
        }

        const insights = await mastra.agents.insightsAgent.generate({
          messages: [{ role: 'user', content: topic }],
          context: { userId: session.user.id }
        });

        return insights;
      }
    }
  ]
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const serviceAdapter = new AnthropicAdapter({
  anthropic,
  model: 'claude-sonnet-4-20250514'
});

export async function POST(req: Request) {
  return runtime.handleRequest({
    serviceAdapter,
    req,
    properties: {
      sessionId: req.headers.get('x-session-id')
    }
  });
}
```

### 6.3 Context-Aware Chat Component

**Template:** `templates/option1-modern-web/frontend/src/components/ai/data-chat.tsx.hbs`

```tsx
'use client';

import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';
import { CopilotTextarea } from '@copilotkit/react-textarea';

interface DataChatProps {
  currentEntity?: string;
  selectedRecords?: string[];
}

export function DataChat({ currentEntity, selectedRecords }: DataChatProps) {
  // Make current context readable to AI
  useCopilotReadable({
    description: 'Current page context',
    value: {
      currentEntity,
      selectedRecords,
      timestamp: new Date().toISOString()
    }
  });

  // Register quick actions
  useCopilotAction({
    name: 'exportSelected',
    description: 'Export selected records to CSV',
    parameters: [],
    handler: async () => {
      // Export logic
    }
  });

  useCopilotAction({
    name: 'summarizeSelected',
    description: 'Summarize selected records',
    parameters: [],
    handler: async () => {
      // Summarization logic
    }
  });

  return (
    <div className="data-chat">
      <CopilotTextarea
        placeholder="Ask about your data..."
        autosuggestionsConfig={{
          textareaPurpose: `Query ${currentEntity || 'data'} naturally`,
          chatApiConfigs: {}
        }}
      />
    </div>
  );
}
```

### 6.4 OpenUI5 Integration (Option 2)

**Template:** `templates/option2-enterprise-sap/frontend/webapp/controller/AIAssistant.controller.js.hbs`

```javascript
sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel"
], function(Controller, JSONModel) {
  "use strict";

  return Controller.extend("{{namespace}}.controller.AIAssistant", {
    onInit: function() {
      const oModel = new JSONModel({
        messages: [],
        inputValue: "",
        isLoading: false
      });
      this.getView().setModel(oModel, "chat");
    },

    onSendMessage: async function() {
      const oModel = this.getView().getModel("chat");
      const sQuery = oModel.getProperty("/inputValue");

      if (!sQuery.trim()) return;

      oModel.setProperty("/isLoading", true);

      // Add user message
      const aMessages = oModel.getProperty("/messages");
      aMessages.push({ role: "user", content: sQuery });
      oModel.setProperty("/messages", aMessages);
      oModel.setProperty("/inputValue", "");

      try {
        // Call AI endpoint with RBAC context
        const oResponse = await fetch("/api/ai/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: sQuery })
        });

        const oData = await oResponse.json();

        // Add AI response
        aMessages.push({ role: "assistant", content: oData.response });
        oModel.setProperty("/messages", aMessages);
      } catch (oError) {
        sap.m.MessageToast.show("Error processing request");
      } finally {
        oModel.setProperty("/isLoading", false);
      }
    }
  });
});
```

---

## 7. Security Architecture (RBAC)

### 7.1 Multi-Layer Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                     Security Layers                          │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Authentication                                     │
│  ├── Session validation                                      │
│  ├── Token verification                                      │
│  └── User identity confirmation                              │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Table-Level Access                                 │
│  ├── Can user access this table at all?                      │
│  ├── What operations are allowed? (CRUD)                     │
│  └── AD_Access table lookup                                  │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Row-Level Security                                 │
│  ├── Owner-based filtering                                   │
│  ├── Organization/tenant filtering                           │
│  └── Custom RLS policies                                     │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: Field-Level Access                                 │
│  ├── Which fields can user see?                              │
│  ├── Which fields can user edit?                             │
│  └── AD_Field_Access table lookup                            │
├─────────────────────────────────────────────────────────────┤
│  Layer 5: AI Query Validation                                │
│  ├── Query intent analysis                                   │
│  ├── Prevent SQL injection via NL                            │
│  └── Rate limiting per user                                  │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 RBAC Database Schema (Generated)

**Template:** `templates/common/migrations/rbac-tables.ts.hbs`

```typescript
export async function up(knex: Knex): Promise<void> {
  // Users table
  await knex.schema.createTable('sys_user', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('username').unique().notNullable();
    table.string('email').unique().notNullable();
    table.string('password_hash').notNullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamp('last_login');
    table.timestamps(true, true);
  });

  // Roles table
  await knex.schema.createTable('sys_role', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').unique().notNullable();
    table.text('description');
    table.boolean('is_system_role').defaultTo(false);
    table.timestamps(true, true);
  });

  // User-Role assignments
  await knex.schema.createTable('sys_user_roles', (table) => {
    table.uuid('user_id').references('id').inTable('sys_user').onDelete('CASCADE');
    table.uuid('role_id').references('id').inTable('sys_role').onDelete('CASCADE');
    table.primary(['user_id', 'role_id']);
    table.timestamps(true, true);
  });

  // Table-level access control
  await knex.schema.createTable('sys_access', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('role_id').references('id').inTable('sys_role').onDelete('CASCADE');
    table.string('table_name').notNullable();
    table.boolean('can_read').defaultTo(false);
    table.boolean('can_create').defaultTo(false);
    table.boolean('can_update').defaultTo(false);
    table.boolean('can_delete').defaultTo(false);
    table.unique(['role_id', 'table_name']);
    table.timestamps(true, true);
  });

  // Field-level access control
  await knex.schema.createTable('sys_field_access', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('role_id').references('id').inTable('sys_role').onDelete('CASCADE');
    table.string('table_name').notNullable();
    table.string('field_name').notNullable();
    table.boolean('is_visible').defaultTo(true);
    table.boolean('is_editable').defaultTo(true);
    table.unique(['role_id', 'table_name', 'field_name']);
    table.timestamps(true, true);
  });

  // Row-level security policies
  await knex.schema.createTable('sys_rls_policy', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('role_id').references('id').inTable('sys_role').onDelete('CASCADE');
    table.string('table_name').notNullable();
    table.string('policy_type').notNullable(); // owner, organization, custom
    table.string('owner_field'); // field that contains owner reference
    table.text('custom_condition'); // custom SQL condition
    table.timestamps(true, true);
  });
}
```

### 7.3 RBAC Service Implementation

**Template:** `templates/common/services/rbac.service.ts.hbs`

```typescript
import { Knex } from 'knex';

export interface UserPermissions {
  userId: string;
  roles: string[];
  tableAccess: Map<string, TableAccess>;
  fieldAccess: Map<string, Map<string, FieldAccess>>;
  rlsPolicies: Map<string, RLSPolicy>;
}

export interface TableAccess {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface FieldAccess {
  isVisible: boolean;
  isEditable: boolean;
}

export interface RLSPolicy {
  policyType: 'owner' | 'organization' | 'custom';
  ownerField?: string;
  customCondition?: string;
}

export class RBACService {
  constructor(private db: Knex) {}

  async getUserPermissions(userId: string): Promise<UserPermissions> {
    // Get user's roles
    const roles = await this.db('sys_user_roles')
      .join('sys_role', 'sys_user_roles.role_id', 'sys_role.id')
      .where('sys_user_roles.user_id', userId)
      .select('sys_role.id', 'sys_role.name');

    const roleIds = roles.map(r => r.id);

    // Get table access for all roles
    const tableAccess = await this.db('sys_access')
      .whereIn('role_id', roleIds)
      .select('*');

    // Get field access for all roles
    const fieldAccess = await this.db('sys_field_access')
      .whereIn('role_id', roleIds)
      .select('*');

    // Get RLS policies
    const rlsPolicies = await this.db('sys_rls_policy')
      .whereIn('role_id', roleIds)
      .select('*');

    return this.aggregatePermissions(userId, roles, tableAccess, fieldAccess, rlsPolicies);
  }

  async canAccessTable(
    permissions: UserPermissions,
    tableName: string,
    operation: 'read' | 'create' | 'update' | 'delete'
  ): Promise<boolean> {
    const access = permissions.tableAccess.get(tableName);
    if (!access) return false;

    switch (operation) {
      case 'read': return access.canRead;
      case 'create': return access.canCreate;
      case 'update': return access.canUpdate;
      case 'delete': return access.canDelete;
      default: return false;
    }
  }

  async getVisibleFields(
    permissions: UserPermissions,
    tableName: string
  ): Promise<string[]> {
    const fieldMap = permissions.fieldAccess.get(tableName);
    if (!fieldMap) return [];

    return Array.from(fieldMap.entries())
      .filter(([_, access]) => access.isVisible)
      .map(([field, _]) => field);
  }

  buildRLSCondition(
    permissions: UserPermissions,
    tableName: string,
    alias?: string
  ): string {
    const policy = permissions.rlsPolicies.get(tableName);
    if (!policy) return '1=1'; // No RLS, allow all

    const prefix = alias ? `${alias}.` : '';

    switch (policy.policyType) {
      case 'owner':
        return `${prefix}${policy.ownerField} = '${permissions.userId}'`;
      case 'organization':
        return `${prefix}organization_id IN (SELECT organization_id FROM sys_user_organizations WHERE user_id = '${permissions.userId}')`;
      case 'custom':
        return policy.customCondition?.replace(/\{\{userId\}\}/g, permissions.userId) || '1=1';
      default:
        return '1=1';
    }
  }
}
```

### 7.4 Secure Query Builder

**Template:** `templates/common/ai/query-builder.ts.hbs`

```typescript
import { Knex } from 'knex';
import { RBACService, UserPermissions } from '../services/rbac.service';

export interface ParsedQuery {
  entity: string;
  operation: 'select' | 'count' | 'aggregate';
  fields?: string[];
  filters?: Filter[];
  aggregation?: Aggregation;
  orderBy?: OrderBy;
  limit?: number;
  includes?: string[];
}

export class SecureQueryBuilder {
  constructor(
    private db: Knex,
    private rbac: RBACService
  ) {}

  async build(
    parsedQuery: ParsedQuery,
    permissions: UserPermissions
  ): Promise<Knex.QueryBuilder> {
    const { entity, operation, fields, filters, limit, includes } = parsedQuery;
    const tableName = `bus_${entity.toLowerCase()}`;

    // Check table access
    if (!await this.rbac.canAccessTable(permissions, tableName, 'read')) {
      throw new Error(`Access denied to table: ${tableName}`);
    }

    // Get visible fields
    const visibleFields = await this.rbac.getVisibleFields(permissions, tableName);
    const selectedFields = fields
      ? fields.filter(f => visibleFields.includes(f))
      : visibleFields;

    // Start building query
    let query = this.db(tableName)
      .select(selectedFields.map(f => `${tableName}.${f}`));

    // Apply RLS
    const rlsCondition = this.rbac.buildRLSCondition(permissions, tableName, tableName);
    query = query.whereRaw(rlsCondition);

    // Apply user filters (validated)
    if (filters) {
      for (const filter of filters) {
        if (!visibleFields.includes(filter.field)) {
          throw new Error(`Cannot filter by hidden field: ${filter.field}`);
        }
        query = this.applyFilter(query, tableName, filter);
      }
    }

    // Apply limit (max 100 for AI queries)
    query = query.limit(Math.min(limit || 50, 100));

    // Handle includes (joins) with security
    if (includes) {
      for (const include of includes) {
        query = await this.addSecureJoin(query, tableName, include, permissions);
      }
    }

    return query;
  }

  private applyFilter(
    query: Knex.QueryBuilder,
    table: string,
    filter: Filter
  ): Knex.QueryBuilder {
    const column = `${table}.${filter.field}`;

    switch (filter.operator) {
      case 'eq': return query.where(column, filter.value);
      case 'ne': return query.whereNot(column, filter.value);
      case 'gt': return query.where(column, '>', filter.value);
      case 'lt': return query.where(column, '<', filter.value);
      case 'gte': return query.where(column, '>=', filter.value);
      case 'lte': return query.where(column, '<=', filter.value);
      case 'like': return query.where(column, 'like', `%${filter.value}%`);
      case 'in': return query.whereIn(column, filter.value as any[]);
      default: return query;
    }
  }

  private async addSecureJoin(
    query: Knex.QueryBuilder,
    sourceTable: string,
    targetEntity: string,
    permissions: UserPermissions
  ): Promise<Knex.QueryBuilder> {
    const targetTable = `bus_${targetEntity.toLowerCase()}`;

    // Check access to target table
    if (!await this.rbac.canAccessTable(permissions, targetTable, 'read')) {
      // Silently skip join for inaccessible tables
      return query;
    }

    // Get visible fields from target
    const targetFields = await this.rbac.getVisibleFields(permissions, targetTable);

    // Apply RLS to joined table
    const targetRLS = this.rbac.buildRLSCondition(permissions, targetTable, targetTable);

    return query
      .leftJoin(targetTable, `${sourceTable}.${targetEntity}_id`, `${targetTable}.id`)
      .select(targetFields.map(f => `${targetTable}.${f} as ${targetEntity}_${f}`))
      .whereRaw(`(${targetTable}.id IS NULL OR ${targetRLS})`);
  }
}
```

### 7.5 AI Query Validation

**Template:** `templates/common/ai/validators/query-validator.ts.hbs`

```typescript
export class AIQueryValidator {
  private dangerousPatterns = [
    /;\s*DROP/i,
    /;\s*DELETE/i,
    /;\s*UPDATE/i,
    /;\s*INSERT/i,
    /;\s*ALTER/i,
    /UNION\s+SELECT/i,
    /--/,
    /\/\*/
  ];

  validateQuery(naturalLanguageQuery: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for SQL injection attempts
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(naturalLanguageQuery)) {
        errors.push('Query contains potentially dangerous patterns');
        break;
      }
    }

    // Check query length
    if (naturalLanguageQuery.length > 1000) {
      warnings.push('Query is unusually long');
    }

    // Check for excessive requests
    const countMatches = naturalLanguageQuery.match(/\ball\b|\beverything\b|\bentire\b/gi);
    if (countMatches && countMatches.length > 2) {
      warnings.push('Query requests large amounts of data');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  sanitizeInput(input: string): string {
    // Remove potential SQL injection characters
    return input
      .replace(/[;'"\\]/g, '')
      .trim();
  }
}
```

---

## 8. Implementation Plan

### 8.1 Phase 1: Template Fixes (Week 1)

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Fix `{{#eq}}` block helper usage | P0 | 2h | None |
| Add missing module exports | P0 | 3h | None |
| Fix package.json dependencies | P0 | 2h | None |
| Update OData package references | P1 | 4h | None |
| Add tsType helper | P1 | 1h | None |
| Test all template fixes | P0 | 4h | All above |

### 8.2 Phase 2: AI Infrastructure (Week 2-3)

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Create Data Query Agent template | P0 | 8h | Phase 1 |
| Create Insights Agent template | P1 | 6h | Phase 1 |
| Create NL Query Parser | P0 | 12h | Phase 1 |
| Create Mastra instance template | P0 | 4h | Agents |
| Create data query workflow | P0 | 8h | Mastra |
| Write AI integration tests | P0 | 8h | All above |

### 8.3 Phase 3: RBAC Implementation (Week 3-4)

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Create RBAC migration templates | P0 | 6h | Phase 1 |
| Create RBAC service template | P0 | 10h | Migrations |
| Create secure query builder | P0 | 12h | RBAC service |
| Create AI query validator | P0 | 4h | None |
| Integrate RBAC with AI agents | P0 | 8h | All above |
| Write RBAC tests | P0 | 8h | All above |

### 8.4 Phase 4: CopilotKit Integration (Week 4-5)

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Create CopilotKit provider template | P0 | 4h | Phase 1 |
| Create API route template | P0 | 6h | AI agents |
| Create chat component templates | P0 | 8h | Provider |
| Create OpenUI5 AI assistant | P1 | 10h | Phase 1 |
| Add context awareness | P1 | 6h | Components |
| Write integration tests | P0 | 8h | All above |

### 8.5 Phase 5: Testing & Documentation (Week 5-6)

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| End-to-end testing | P0 | 16h | All phases |
| Update sample applications | P0 | 8h | All phases |
| Write documentation | P0 | 8h | All phases |
| Performance testing | P1 | 8h | All phases |
| Security audit | P0 | 8h | All phases |

---

## 9. Testing Strategy

### 9.1 Template Testing

```typescript
// test/generator/templates.test.ts
describe('Template Generation', () => {
  it('should generate valid TypeScript for Option 1', async () => {
    const result = await generateOption1(testERD);
    const compiled = await tsc.compile(result);
    expect(compiled.errors).toHaveLength(0);
  });

  it('should generate valid JavaScript for Option 2', async () => {
    const result = await generateOption2(testERD);
    const linted = await eslint.lint(result);
    expect(linted.errors).toHaveLength(0);
  });
});
```

### 9.2 AI Agent Testing

```typescript
// test/ai/data-query-agent.test.ts
describe('Data Query Agent', () => {
  it('should parse natural language queries', async () => {
    const result = await agent.parse('Show me all customers from New York');
    expect(result.entity).toBe('Customer');
    expect(result.filters).toContainEqual({
      field: 'city',
      operator: 'eq',
      value: 'New York'
    });
  });

  it('should respect RBAC permissions', async () => {
    const limitedUser = { roles: ['viewer'] };
    const result = await agent.query('Show all salaries', limitedUser);
    expect(result.error).toBe('Access denied');
  });
});
```

### 9.3 RBAC Testing

```typescript
// test/rbac/security.test.ts
describe('RBAC Security', () => {
  it('should filter by table access', async () => {
    const user = await createUser({ roles: ['sales'] });
    const query = await builder.build({ entity: 'HR_Salary' }, user.permissions);
    expect(query).toThrow('Access denied');
  });

  it('should apply row-level security', async () => {
    const user = await createUser({ roles: ['sales_rep'] });
    const query = await builder.build({ entity: 'Lead' }, user.permissions);
    const sql = query.toSQL();
    expect(sql).toContain(`owner_id = '${user.id}'`);
  });

  it('should hide restricted fields', async () => {
    const user = await createUser({ roles: ['viewer'] });
    const fields = await rbac.getVisibleFields(user.permissions, 'bus_customer');
    expect(fields).not.toContain('credit_card_number');
  });
});
```

### 9.4 Integration Testing

```typescript
// test/integration/ai-data-access.test.ts
describe('AI Data Access E2E', () => {
  it('should handle full query flow', async () => {
    // 1. User asks natural language question
    const question = 'What are our top 5 customers by revenue?';

    // 2. CopilotKit receives the query
    const response = await copilotkit.query(question, testUser);

    // 3. Mastra workflow processes it
    expect(response.workflow).toBe('data-query');

    // 4. Results are RBAC-filtered
    expect(response.data.length).toBeLessThanOrEqual(5);
    for (const record of response.data) {
      expect(record.owner_id).toBe(testUser.id);
    }
  });
});
```

---

## 10. Risk Assessment

### 10.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| AI generates incorrect queries | Medium | High | Query validation, sandbox testing |
| RBAC bypass via NL manipulation | Low | Critical | Input sanitization, strict parsing |
| Performance degradation with AI | Medium | Medium | Caching, rate limiting |
| CopilotKit compatibility issues | Medium | Medium | Version pinning, fallback UI |
| Template complexity increase | High | Low | Modular templates, documentation |

### 10.2 Security Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| SQL injection via NL | Low | Critical | Never use raw NL in SQL, parameterized queries |
| Data exfiltration | Low | Critical | Rate limiting, audit logging |
| Privilege escalation | Low | Critical | Server-side RBAC checks only |
| API key exposure | Low | High | Environment variables, key rotation |

### 10.3 Mitigation Strategies

1. **Query Sandboxing**: All AI-generated queries run in read-only transactions with timeouts
2. **Audit Logging**: Every AI query is logged with user, query, and results
3. **Rate Limiting**: Max 100 AI queries per user per hour
4. **Result Limits**: Max 100 rows per query, no bulk exports via AI
5. **Human Override**: Admin can disable AI features per user/role

---

## 11. Approval Checklist

### 11.1 Technical Review

- [ ] Template fix approach approved
- [ ] AI agent architecture approved
- [ ] RBAC security model approved
- [ ] CopilotKit integration approach approved
- [ ] Testing strategy approved

### 11.2 Security Review

- [ ] RBAC implementation reviewed
- [ ] AI query validation reviewed
- [ ] Data access patterns reviewed
- [ ] Audit logging requirements met

### 11.3 Resource Approval

- [ ] Development time estimate accepted
- [ ] AI API costs projected and approved
- [ ] Infrastructure requirements approved

### 11.4 Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Technical Lead | | | |
| Security Lead | | | |
| Product Owner | | | |

---

## Appendix A: Example Natural Language Queries

### Supported Query Types

```
# Listing queries
"Show me all customers"
"List orders from last week"
"Display products with low stock"

# Counting queries
"How many orders were placed today?"
"Count customers by region"
"What's the total inventory?"

# Aggregation queries
"What's the average order value?"
"Sum of sales by month"
"Top 10 products by revenue"

# Comparison queries
"Compare sales this month vs last month"
"Which region has the most customers?"
"What products have declining sales?"

# Filtering queries
"Show customers from California with orders > $1000"
"List overdue invoices"
"Find products not sold in 30 days"

# Relationship queries
"Show me John's orders with product details"
"List customers and their most recent order"
"Which products are often bought together?"
```

### RBAC-Restricted Responses

```
# User with 'sales' role asks:
"Show me all employee salaries"

# Response:
"I don't have access to salary information. I can help you with
customer, order, and product data. Would you like to see your
sales performance instead?"

# User with 'viewer' role asks:
"Delete all test customers"

# Response:
"I can only help with reading data. For data modifications,
please contact an administrator."
```

---

## Appendix B: File Structure for AI Templates

```
packages/generator/templates/
├── common/
│   ├── ai/
│   │   ├── agents/
│   │   │   ├── data-query-agent.ts.hbs
│   │   │   └── insights-agent.ts.hbs
│   │   ├── workflows/
│   │   │   └── data-query-workflow.ts.hbs
│   │   ├── parsers/
│   │   │   └── nl-query-parser.ts.hbs
│   │   ├── validators/
│   │   │   └── query-validator.ts.hbs
│   │   ├── query-builder.ts.hbs
│   │   └── mastra.ts.hbs
│   ├── services/
│   │   └── rbac.service.ts.hbs
│   └── migrations/
│       └── rbac-tables.ts.hbs
├── option1-modern-web/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── providers/
│   │   │   │   └── copilot-provider.tsx.hbs
│   │   │   ├── components/
│   │   │   │   └── ai/
│   │   │   │       └── data-chat.tsx.hbs
│   │   │   └── app/
│   │   │       └── api/
│   │   │           └── copilotkit/
│   │   │               └── route.ts.hbs
│   │   └── package.json.hbs (updated)
│   └── backend/
│       └── src/
│           └── modules/
│               └── ai/
│                   ├── ai.module.ts.hbs
│                   ├── ai.controller.ts.hbs
│                   └── ai.service.ts.hbs
└── option2-enterprise-sap/
    ├── frontend/
    │   └── webapp/
    │       ├── controller/
    │       │   └── AIAssistant.controller.js.hbs
    │       └── view/
    │           └── AIAssistant.view.xml.hbs
    └── backend/
        └── src/
            └── controllers/
                └── ai/
                    └── ai.controller.ts.hbs
```

---

**END OF DOCUMENT**

*Please review and provide approval or feedback before implementation begins.*
