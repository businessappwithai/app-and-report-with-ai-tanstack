# Architectural Design Document
## Intelligent Monitoring & Dynamic Reporting Enhancement
### ADK · Trigger.dev · Mastra.ai · Natural Language Interface

---

**Document Classification:** Technical Architecture  
**Status:** Proposed  
**Version:** 1.0  
**Last Updated:** June 2, 2026  
**Prepared For:** Enterprise Reporting Platform — Engineering Leadership

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Baseline](#2-current-architecture-baseline)
3. [Enhancement Vision & Goals](#3-enhancement-vision--goals)
4. [High-Level Architecture](#4-high-level-architecture)
5. [Component Architecture](#5-component-architecture)
   - 5.1 [ADK Agent Pipeline](#51-adk-agent-pipeline)
   - 5.2 [Mastra.ai RBAC-Aware Workflow Engine](#52-mastraai-rbac-aware-workflow-engine)
   - 5.3 [Trigger.dev Intelligent Scheduling Layer](#53-triggerdev-intelligent-scheduling-layer)
   - 5.4 [Natural Language Interface](#54-natural-language-interface)
   - 5.5 [Alert & Threshold Engine](#55-alert--threshold-engine)
6. [Data Flow Architecture](#6-data-flow-architecture)
7. [RBAC Integration Design](#7-rbac-integration-design)
8. [Database Schema Extensions](#8-database-schema-extensions)
9. [API Surface Design](#9-api-surface-design)
10. [Security Architecture](#10-security-architecture)
11. [Infrastructure & Deployment](#11-infrastructure--deployment)
12. [Implementation Roadmap](#12-implementation-roadmap)
13. [Technology Dependencies](#13-technology-dependencies)
14. [Risk Assessment](#14-risk-assessment)
15. [Appendix: Reference Flows](#15-appendix-reference-flows)

---

## 1. Executive Summary

This document defines the architectural design for enhancing the **Enterprise Reporting Platform** (built on TanStack Start + Bun) with an intelligent, agent-driven monitoring and reporting pipeline. The enhancement integrates three foundational technologies:

| Technology | Role |
|---|---|
| **ADK (Agent Development Kit)** | Understands natural language intent, generates structured `ReportDefinition` objects, and creates `MonitoringRule` configurations from free-form user requests |
| **Mastra.ai** | Orchestrates dynamic, RBAC-aware workflow construction — assembling data-source access checks, schema introspection, SQL generation, and threshold validation into composable agent pipelines at runtime |
| **Trigger.dev** | Executes reliable, durable scheduled jobs — running generated reports on cadence (e.g., every Monday), evaluating threshold conditions, and dispatching multi-channel alerts |

Together these three layers enable the following end-to-end capability:

> *A user types: "Alert me every Monday if total revenue for the week drops below $50,000."*
>
> The system autonomously: understands the intent → validates the user's data source access → generates the report definition and SQL → schedules a weekly Trigger.dev job → executes the report on Monday → evaluates the threshold → sends a targeted alert — all without the user writing a single line of SQL or configuring a cron expression.

This document covers the component architecture, data flows, RBAC integration, database schema extensions, API surface, security considerations, and a phased implementation roadmap.

---

## 2. Current Architecture Baseline

### 2.1 System Overview

The existing platform is a production-grade enterprise reporting system with the following architectural pillars:

```
┌─────────────────────────────────────────────────────────────┐
│                    TanStack Start (Bun)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  TanStack    │  │  TanStack    │  │  TanStack DB     │  │
│  │  Router      │  │  Query v5    │  │  v0.6 (Reactive) │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                     API / Server Layer                      │
│  60+ REST Endpoints  ·  Server Functions (createServerFn)  │
├─────────────────────────────────────────────────────────────┤
│  Auth (JWT)  ·  RBAC  ·  Resource Permissions  ·  Audit    │
├──────────────────────────┬──────────────────────────────────┤
│   Config DB (MariaDB)    │   External Data Sources          │
│   Kysely ORM             │   (PG, MySQL, MSSQL, Oracle,     │
│                          │    SQLite, DuckDB, Snowflake)    │
├──────────────────────────┴──────────────────────────────────┤
│  Trigger.dev (Jobs)  ·  Mastra.ai (NL→SQL)  ·  Nodemailer  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Existing Capabilities Leveraged

The enhancement builds directly on these existing subsystems:

| Subsystem | Location | Role in Enhancement |
|---|---|---|
| `ReportDefinition` model | `src/types/database.ts` | Extended to carry monitoring metadata |
| `JobDefinition` / `JobExecution` | `src/types/database.ts` | Extended with monitoring rule linkage |
| Trigger.dev tasks | `src/lib/jobs/trigger-tasks.ts` | Extended with `monitoring:evaluate` task |
| Mastra.ai server | `mastra/server.ts` | Extended with workflow orchestration |
| NL Query pipeline | `src/lib/mastra/` | Reused for intent parsing |
| RBAC engine | `src/lib/auth/rbac.ts` | Central to dynamic workflow gating |
| Audit logging | `src/lib/security/audit.ts` | Extended for monitoring events |
| Email service | `src/lib/email/email-service.ts` | Alert delivery channel |

### 2.3 Gaps in Current Architecture

| Gap | Impact |
|---|---|
| No declarative monitoring rules | Users cannot define "alert if value exceeds threshold" outside custom SQL |
| Static job definitions | Jobs are hand-crafted; no NL-to-job pipeline exists |
| Mastra.ai is NL→SQL only | Agent is not orchestrating multi-step report-build workflows |
| Trigger.dev not RBAC-aware | Scheduled jobs execute as a service account, bypassing per-user data access policies |
| No threshold evaluation engine | No platform-level capability to compare results against business thresholds |

---

## 3. Enhancement Vision & Goals

### 3.1 North Star Capability

Transform the platform from a **passive reporting tool** into an **active intelligence system** that monitors business metrics, detects anomalies, and proactively notifies stakeholders — all configured through natural language.

### 3.2 Design Goals

| ID | Goal | Priority |
|---|---|---|
| G1 | Natural language interface to create monitoring rules without SQL knowledge | P0 |
| G2 | ADK agent pipeline that decomposes NL intent into structured report + monitoring artifacts | P0 |
| G3 | Mastra.ai dynamically constructs execution workflows based on caller's RBAC context | P0 |
| G4 | Trigger.dev executes durable, scheduled report evaluations with retry guarantees | P0 |
| G5 | Multi-channel alerting (email, in-app, webhook) based on threshold breaches | P1 |
| G6 | Full audit trail for every monitoring execution and alert dispatch | P1 |
| G7 | Self-service monitoring dashboard with rule management | P1 |
| G8 | All generated artifacts (reports, jobs) inherit the creator's RBAC restrictions | P0 |

### 3.3 Non-Goals

- Real-time streaming analytics (sub-second monitoring)
- Complex ML-based anomaly detection (threshold-based only in v1)
- Replacing the existing manual report builder
- Monitoring rules that require access to data sources outside the user's permission scope

---

## 4. High-Level Architecture

```
╔══════════════════════════════════════════════════════════════════╗
║                     PRESENTATION LAYER                          ║
║                                                                  ║
║  ┌─────────────────────────────────────────────────────────┐    ║
║  │           Natural Language Monitoring Interface          │    ║
║  │   "Alert me every Monday if weekly revenue < $50k"      │    ║
║  └────────────────────────┬────────────────────────────────┘    ║
╚═══════════════════════════╪══════════════════════════════════════╝
                            │  NL Intent + User RBAC Context
╔═══════════════════════════╪══════════════════════════════════════╗
║              ADK AGENT PIPELINE (Intent Processing)             ║
║                           │                                      ║
║  ┌────────────────────────▼────────────────────────────────┐    ║
║  │  Intent Classifier → Report Generator → Rule Builder    │    ║
║  │                                                          │    ║
║  │  Input:  "Alert me every Monday if revenue < $50k"       │    ║
║  │  Output: { ReportDefinition, MonitoringRule, Schedule }  │    ║
║  └────────────────────────┬────────────────────────────────┘    ║
╚═══════════════════════════╪══════════════════════════════════════╝
                            │  Structured Artifacts
╔═══════════════════════════╪══════════════════════════════════════╗
║        MASTRA.AI RBAC-AWARE WORKFLOW ORCHESTRATION              ║
║                           │                                      ║
║  ┌────────────────────────▼────────────────────────────────┐    ║
║  │  1. Resolve caller RBAC → permitted data sources         │    ║
║  │  2. Introspect schema for accessible tables/columns      │    ║
║  │  3. Generate RBAC-scoped SQL via NL→SQL pipeline         │    ║
║  │  4. Validate SQL against column allowlist                │    ║
║  │  5. Persist ReportDefinition + MonitoringRule            │    ║
║  │  6. Enqueue Trigger.dev scheduled job                    │    ║
║  └────────────────────────┬────────────────────────────────┘    ║
╚═══════════════════════════╪══════════════════════════════════════╝
                            │  Persisted Job + Rule
╔═══════════════════════════╪══════════════════════════════════════╗
║             TRIGGER.DEV EXECUTION LAYER                         ║
║                           │                                      ║
║  ┌────────────────────────▼────────────────────────────────┐    ║
║  │  CRON: Every Monday 08:00                                │    ║
║  │  ├── Execute Report SQL                                  │    ║
║  │  ├── Evaluate Threshold Condition                        │    ║
║  │  ├── Decide: Alert / Pass / Escalate                     │    ║
║  │  └── Dispatch Alert (email / in-app / webhook)           │    ║
║  └────────────────────────┬────────────────────────────────┘    ║
╚═══════════════════════════╪══════════════════════════════════════╝
                            │  Execution History + Alerts
╔═══════════════════════════╪══════════════════════════════════════╗
║                  PERSISTENCE & AUDIT LAYER                      ║
║                                                                  ║
║   MariaDB Config DB  ·  Audit Log  ·  Alert History             ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## 5. Component Architecture

### 5.1 ADK Agent Pipeline

The ADK pipeline is the **intent-processing brain** of the system. It receives a natural language monitoring request and produces three structured artifacts: a `ReportDefinition`, a `MonitoringRule`, and a `ScheduleConfig`.

#### 5.1.1 Pipeline Stages

```
┌─────────────────────────────────────────────────────────────────┐
│                     ADK Agent Pipeline                          │
│                                                                  │
│  Stage 1: Intent Classification                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Input: Raw NL string + user session context             │   │
│  │  Agent: IntentClassifierAgent                            │   │
│  │  Output:                                                 │   │
│  │    intent_type: "monitoring_rule"                        │   │
│  │    metric: "total_revenue"                               │   │
│  │    threshold: { operator: "lt", value: 50000 }           │   │
│  │    schedule: { cron: "0 8 * * 1", description: "Monday" }│   │
│  │    data_hint: "revenue, orders, sales"                   │   │
│  └───────────────────────────┬──────────────────────────────┘   │
│                              │                                   │
│  Stage 2: Report Definition Generator                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Input: Classified intent + RBAC-filtered schema         │   │
│  │  Agent: ReportDefinitionAgent                            │   │
│  │  Tools: [ schema_introspect, sql_generate, sql_validate ] │   │
│  │  Output: ReportDefinition {                              │   │
│  │    dataSourceId, baseSQL, columns,                       │   │
│  │    filters, aggregations, pagination                     │   │
│  │  }                                                       │   │
│  └───────────────────────────┬──────────────────────────────┘   │
│                              │                                   │
│  Stage 3: Monitoring Rule Builder                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Input: ReportDefinition + threshold intent              │   │
│  │  Agent: MonitoringRuleAgent                              │   │
│  │  Output: MonitoringRule {                                │   │
│  │    reportDefinitionId, metricColumn, operator,           │   │
│  │    thresholdValue, alertChannels, escalationPolicy       │   │
│  │  }                                                       │   │
│  └───────────────────────────┬──────────────────────────────┘   │
│                              │                                   │
│  Stage 4: Schedule Config Builder                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Input: Classified schedule intent                       │   │
│  │  Agent: ScheduleConfigAgent                              │   │
│  │  Output: ScheduleConfig {                                │   │
│  │    cronExpression: "0 8 * * 1",                          │   │
│  │    timezone: user.timezone,                              │   │
│  │    maxRetries: 3,                                        │   │
│  │    notifyOnSuccess: false,                               │   │
│  │    notifyOnFailure: true                                 │   │
│  │  }                                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

#### 5.1.2 ADK Tool Definitions

Each agent stage calls registered tools. These tools are thin wrappers over existing platform services:

```typescript
// src/lib/adk/tools/schema-introspect-tool.ts
export const schemaIntrospectTool = {
  name: "schema_introspect",
  description: "Introspect accessible tables and columns for a data source, filtered by caller RBAC",
  parameters: {
    dataSourceId: string,
    userId: string,        // RBAC context injected automatically
  },
  execute: async ({ dataSourceId, userId }) => {
    // 1. Validate user has 'execute' permission on dataSourceId
    // 2. Call existing schema-introspection.ts
    // 3. Filter columns by data source column allowlist
    return { tables: [...], columns: [...] }
  }
}

// src/lib/adk/tools/sql-generate-tool.ts
export const sqlGenerateTool = {
  name: "sql_generate",
  description: "Generate SQL from NL question using the Mastra.ai NL-to-SQL pipeline",
  parameters: {
    nlQuestion: string,
    schema: SchemaContext,
    dataSourceId: string,
  },
  execute: async ({ nlQuestion, schema, dataSourceId }) => {
    // Delegates to existing /api/nl-to-sql endpoint on Mastra server
    return { sql: string, explanation: string, confidence: number }
  }
}

// src/lib/adk/tools/rule-persist-tool.ts
export const rulePersistTool = {
  name: "rule_persist",
  description: "Persists a validated ReportDefinition and MonitoringRule to the config database",
  parameters: {
    reportDefinition: ReportDefinition,
    monitoringRule: MonitoringRule,
    schedule: ScheduleConfig,
    createdBy: string,
  },
  execute: async (args) => {
    // Transactionally inserts to report_definitions + monitoring_rules + job_definitions
    return { reportId: string, ruleId: string, jobId: string }
  }
}
```

#### 5.1.3 Intent Classification Schema

```typescript
// src/types/adk.ts

export interface ADKIntent {
  intent_type: "monitoring_rule" | "report_generate" | "alert_create" | "ambiguous"
  confidence: number                  // 0.0–1.0

  // Extracted entities
  metric?: string                     // e.g. "total_revenue", "patient_count"
  data_hint?: string                  // e.g. "sales, orders, revenue"
  time_window?: TimeWindow            // e.g. { unit: "week", value: 1 }
  schedule?: ScheduleIntent           // e.g. { natural: "every Monday", cron: "0 8 * * 1" }
  threshold?: ThresholdIntent         // e.g. { operator: "lt", value: 50000, currency: "USD" }
  alert_channels?: AlertChannel[]     // ["email", "in_app", "webhook"]
  recipients?: string[]               // User IDs or role names

  // Extracted from session
  dataSourceId?: string               // Pre-resolved or requires disambiguation
  userId: string
  sessionContext: SessionContext
}

export interface ThresholdIntent {
  operator: "gt" | "gte" | "lt" | "lte" | "eq" | "neq" | "between"
  value: number
  upperBound?: number                 // For "between" operator
  currency?: string
  percentageChange?: boolean          // Alert on % change vs absolute value
}

export interface ScheduleIntent {
  natural: string                     // Raw natural language
  cron: string                        // Resolved cron expression
  timezone: string
  startDate?: Date
  endDate?: Date
}
```

---

### 5.2 Mastra.ai RBAC-Aware Workflow Engine

Mastra.ai is elevated from its current role (NL→SQL proxy) to a **full workflow orchestration engine**. It assembles composable, dynamically scoped pipelines that enforce RBAC at every step.

#### 5.2.1 RBAC-Aware Workflow Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                 Mastra.ai Workflow Orchestrator                   │
│                                                                   │
│  Workflow: build_monitoring_pipeline                              │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Step 1: rbac_context_resolve                             │    │
│  │  ─────────────────────────────                           │    │
│  │  • Load user roles and permissions from config DB         │    │
│  │  • Resolve accessible data source IDs                    │    │
│  │  • Build column allowlist per data source                 │    │
│  │  • Determine row-level filter predicates (if any)        │    │
│  │  Output: RBACContext { dataSources[], allowedColumns{} }  │    │
│  └────────────────────────────┬─────────────────────────────┘    │
│                               │                                   │
│  ┌────────────────────────────▼─────────────────────────────┐    │
│  │  Step 2: schema_discovery (RBAC-scoped)                   │    │
│  │  ──────────────────────────────────────                   │    │
│  │  • For each accessible data source:                       │    │
│  │    - Introspect tables/columns from information_schema    │    │
│  │    - Intersect with column allowlist from Step 1          │    │
│  │    - Enrich with schema instructions from admin panel     │    │
│  │  Output: FilteredSchema (only what user can see)          │    │
│  └────────────────────────────┬─────────────────────────────┘    │
│                               │                                   │
│  ┌────────────────────────────▼─────────────────────────────┐    │
│  │  Step 3: sql_generation                                   │    │
│  │  ──────────────────────                                   │    │
│  │  • Pass filtered schema + NL metric description to LLM   │    │
│  │  • LLM (Qwen3 / OpenAI) generates candidate SQL          │    │
│  │  • Apply column allowlist enforcement (no wildcard)       │    │
│  │  • Append mandatory row-level security predicates         │    │
│  │  Output: { sql: string, columns: string[] }               │    │
│  └────────────────────────────┬─────────────────────────────┘    │
│                               │                                   │
│  ┌────────────────────────────▼─────────────────────────────┐    │
│  │  Step 4: sql_validation                                   │    │
│  │  ──────────────────────                                   │    │
│  │  • ANTLR4 syntax validation                              │    │
│  │  • Read-only enforcement (no DML/DDL)                    │    │
│  │  • Column reference validation against allowlist          │    │
│  │  • Injection pattern detection                           │    │
│  │  Output: ValidationResult { valid, errors[], warnings[] } │    │
│  └────────────────────────────┬─────────────────────────────┘    │
│                               │                                   │
│  ┌────────────────────────────▼─────────────────────────────┐    │
│  │  Step 5: artifact_assembly                                │    │
│  │  ─────────────────────────                               │    │
│  │  • Assemble validated SQL into ReportDefinition           │    │
│  │  • Map threshold config to MonitoringRule                │    │
│  │  • Construct Trigger.dev job payload                     │    │
│  │  • Tag artifacts with creator userId + RBAC snapshot     │    │
│  │  Output: { reportDef, monitoringRule, jobPayload }        │    │
│  └────────────────────────────┬─────────────────────────────┘    │
│                               │                                   │
│  ┌────────────────────────────▼─────────────────────────────┐    │
│  │  Step 6: persistence_and_scheduling                       │    │
│  │  ──────────────────────────────────                       │    │
│  │  • Transactional write to config DB:                     │    │
│  │    report_definitions, monitoring_rules, job_definitions  │    │
│  │  • Enqueue cron job in Trigger.dev via SDK               │    │
│  │  • Emit audit log: MONITORING_RULE_CREATED               │    │
│  │  Output: { reportId, ruleId, jobId, nextRunAt }           │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

#### 5.2.2 RBAC Context Resolution

The critical invariant of this architecture is that **the RBAC context of the rule creator permanently governs all future executions** of that monitoring job. This prevents privilege escalation via scheduled job execution.

```typescript
// src/lib/mastra/rbac-workflow-context.ts

export interface RBACWorkflowContext {
  userId: string
  userRoles: string[]

  // Resolved at rule-creation time, snapshotted for job execution
  accessibleDataSources: {
    id: string
    name: string
    allowedTables: string[]
    allowedColumns: Record<string, string[]>   // table → columns[]
    rowFilters: Record<string, string>          // table → SQL predicate
  }[]

  // Snapshot timestamp — jobs re-validate if roles change
  resolvedAt: Date
  snapshotVersion: number
}

export async function resolveRBACContext(userId: string): Promise<RBACWorkflowContext> {
  const { roles, permissions } = await getSecurityContext(userId)

  const accessibleDataSources = await getAccessibleResourceIds(
    userId, "data_source", "execute"
  )

  return {
    userId,
    userRoles: roles.map(r => r.name),
    accessibleDataSources: await Promise.all(
      accessibleDataSources.map(async dsId => ({
        id: dsId,
        name: await getDataSourceName(dsId),
        allowedTables: await resolveAllowedTables(dsId, permissions),
        allowedColumns: await resolveAllowedColumns(dsId, permissions),
        rowFilters: await resolveRowFilters(dsId, userId),
      }))
    ),
    resolvedAt: new Date(),
    snapshotVersion: 1,
  }
}
```

#### 5.2.3 New Mastra.ai Endpoints

The Mastra server (`mastra/server.ts`) is extended with workflow-level endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/build-monitoring-pipeline` | POST | Full ADK → Mastra workflow orchestration |
| `/api/rbac-schema` | POST | Return RBAC-filtered schema for a user |
| `/api/validate-monitoring-rule` | POST | Dry-run a monitoring rule before persisting |
| `/api/workflow-status/:id` | GET | Poll long-running workflow status |

---

### 5.3 Trigger.dev Intelligent Scheduling Layer

Trigger.dev is extended beyond its current `report:generate`, `data:export` tasks to support the full **monitoring execution lifecycle**.

#### 5.3.1 New Task: `monitoring:evaluate`

```
┌──────────────────────────────────────────────────────────────────┐
│              Trigger.dev Task: monitoring:evaluate               │
│              Cron: Configurable (e.g., "0 8 * * 1")             │
│                                                                   │
│  Payload:                                                         │
│  {                                                                │
│    monitoringRuleId: string                                       │
│    reportDefinitionId: string                                     │
│    rbacSnapshotVersion: number   ← From creation-time snapshot   │
│    executionContext: {                                            │
│      userId: string,                                              │
│      dataSourceId: string,                                        │
│      timezone: string                                             │
│    }                                                              │
│  }                                                                │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  Phase 1: RBAC Re-Validation                             │     │
│  │  • Load current user roles/permissions                   │     │
│  │  • Compare against snapshot version                      │     │
│  │  • If RBAC revoked: abort + send access-revoked alert    │     │
│  │  • If RBAC changed: re-snapshot and log audit event      │     │
│  └──────────────────────────────┬──────────────────────────┘     │
│                                 │                                 │
│  ┌──────────────────────────────▼──────────────────────────┐     │
│  │  Phase 2: Report Execution                               │     │
│  │  • Load ReportDefinition from config DB                  │     │
│  │  • Establish connection to external data source          │     │
│  │  • Execute validated SQL with current date parameters    │     │
│  │  • Apply server-side pagination (safety limit: 10,000)   │     │
│  │  • Record execution timing + row count                   │     │
│  └──────────────────────────────┬──────────────────────────┘     │
│                                 │                                 │
│  ┌──────────────────────────────▼──────────────────────────┐     │
│  │  Phase 3: Threshold Evaluation                           │     │
│  │  • Extract metric value from result set                  │     │
│  │  • Apply operator: gt / gte / lt / lte / eq / between   │     │
│  │  • Compute delta from previous execution (% change)      │     │
│  │  • Classify: PASS / BREACH / ESCALATE / NO_DATA          │     │
│  └──────────────────────────────┬──────────────────────────┘     │
│                                 │                                 │
│  ┌──────────────────────────────▼──────────────────────────┐     │
│  │  Phase 4: Alert Dispatch                                 │     │
│  │  BREACH → Send alert via configured channels:            │     │
│  │    • Email   → Nodemailer SMTP with templated body       │     │
│  │    • In-App  → Platform notification (notifications tbl) │     │
│  │    • Webhook → HTTP POST to configured URL               │     │
│  │  ESCALATE → Same + secondary recipients after N hours    │     │
│  │  PASS     → Optional success notification (configurable) │     │
│  │  NO_DATA   → Alert (data source issue or empty result)   │     │
│  └──────────────────────────────┬──────────────────────────┘     │
│                                 │                                 │
│  ┌──────────────────────────────▼──────────────────────────┐     │
│  │  Phase 5: Execution Recording                            │     │
│  │  • Insert into monitoring_executions table               │     │
│  │  • Update monitoring_rules.last_executed_at              │     │
│  │  • Emit audit log: MONITORING_RULE_EXECUTED              │     │
│  │  • Update job_executions with status + metadata          │     │
│  └──────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
```

#### 5.3.2 Task Implementation Skeleton

```typescript
// src/lib/jobs/trigger-tasks.ts (extended)

export const monitoringEvaluateTask = task({
  id: "monitoring:evaluate",
  maxDuration: 300,                          // 5 minute max per evaluation
  retry: { maxAttempts: 3, factor: 2 },

  run: async (payload: MonitoringEvaluatePayload, { ctx }) => {
    const { monitoringRuleId, reportDefinitionId, executionContext } = payload

    // Phase 1: RBAC re-validation
    const rbacValid = await validateRBACForExecution(
      executionContext.userId,
      executionContext.dataSourceId,
      payload.rbacSnapshotVersion
    )
    if (!rbacValid.canExecute) {
      await dispatchAccessRevokedAlert(monitoringRuleId, executionContext.userId)
      return { status: "RBAC_REVOKED", reason: rbacValid.reason }
    }

    // Phase 2: Execute report
    const executionResult = await executeReportDefinition(
      reportDefinitionId,
      executionContext
    )

    // Phase 3: Evaluate threshold
    const rule = await loadMonitoringRule(monitoringRuleId)
    const evaluation = evaluateThreshold(executionResult, rule)

    // Phase 4: Dispatch alerts
    if (evaluation.status === "BREACH" || evaluation.status === "ESCALATE") {
      await dispatchAlerts(rule, evaluation, executionResult)
    }

    // Phase 5: Record execution
    await recordMonitoringExecution({
      ruleId: monitoringRuleId,
      status: evaluation.status,
      metricValue: evaluation.actualValue,
      thresholdValue: rule.thresholdValue,
      executionMs: executionResult.executionMs,
      rowCount: executionResult.rowCount,
      alertDispatched: evaluation.status !== "PASS",
    })

    return { status: evaluation.status, value: evaluation.actualValue }
  }
})
```

#### 5.3.3 Scheduling Integration

Monitoring rules are registered as Trigger.dev schedules at creation time:

```typescript
// src/lib/jobs/monitoring-scheduler.ts

export async function scheduleMonitoringRule(
  rule: MonitoringRule,
  schedule: ScheduleConfig
): Promise<string> {
  const triggerHandle = await schedules.create({
    task: "monitoring:evaluate",
    cron: schedule.cronExpression,
    timezone: schedule.timezone,
    payload: {
      monitoringRuleId: rule.id,
      reportDefinitionId: rule.reportDefinitionId,
      rbacSnapshotVersion: rule.rbacSnapshotVersion,
      executionContext: {
        userId: rule.createdBy,
        dataSourceId: rule.dataSourceId,
        timezone: schedule.timezone,
      },
    },
    externalId: `monitoring-${rule.id}`,      // Idempotent: can re-register
  })

  return triggerHandle.id
}
```

---

### 5.4 Natural Language Interface

The NL interface for monitoring rule creation is a dedicated UI surface built on the existing NL Query component infrastructure.

#### 5.4.1 User Experience Flow

```
┌──────────────────────────────────────────────────────────────────┐
│              Monitoring Rule Creator — NL Interface              │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  "Describe what you want to monitor in plain English..."   │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │ Alert me every Monday if total weekly revenue drops   │ │  │
│  │  │ below $50,000 across all sales regions                │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │  [ Analyze Intent ]  [ Examples ]  [ Voice Input ]         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ─────────────────── REVIEW GENERATED PLAN ───────────────────   │
│                                                                   │
│  Data Source:  [  Sales Analytics DB (PostgreSQL)     ▼  ]       │
│                                                                   │
│  Generated SQL:                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ SELECT SUM(order_total) AS weekly_revenue                  │  │
│  │ FROM orders                                                │  │
│  │ WHERE order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)        │  │
│  └────────────────────────────────────────────────────────────┘  │
│  [ Edit SQL ]                                                      │
│                                                                   │
│  Monitoring Condition:                                             │
│  weekly_revenue  [ less than ▼ ]  [ $50,000 ]                     │
│                                                                   │
│  Schedule:                                                         │
│  [  Every Monday at 08:00 UTC  ]  [ Change Schedule ]            │
│                                                                   │
│  Alert Channels:   [✓] Email   [✓] In-App   [ ] Webhook          │
│  Recipients:       [ Me ]  [ + Add Users/Roles ]                  │
│                                                                   │
│  [ Cancel ]                          [ Create Monitoring Rule ]   │
└──────────────────────────────────────────────────────────────────┘
```

#### 5.4.2 Component Architecture

```
src/
├── routes/_authed/monitoring/
│   ├── index.tsx                  # Monitoring rules dashboard
│   ├── create.tsx                 # NL-based rule creator
│   └── $id/
│       ├── view.tsx               # Rule detail + execution history
│       └── edit.tsx               # Edit rule parameters
│
├── components/monitoring/
│   ├── NLMonitoringCreator.tsx    # Main NL input + review UI
│   ├── IntentReviewPanel.tsx      # Parsed intent confirmation
│   ├── GeneratedSQLPreview.tsx    # Editable SQL preview (extends sql-editor)
│   ├── ThresholdConfigurator.tsx  # Threshold operator + value input
│   ├── ScheduleConfigurator.tsx   # Cron schedule picker
│   ├── AlertChannelSelector.tsx   # Email/in-app/webhook toggle
│   ├── MonitoringRuleList.tsx     # Rules dashboard table
│   ├── MonitoringRuleCard.tsx     # Rule summary card
│   ├── ExecutionHistoryTable.tsx  # Per-rule execution timeline
│   └── AlertHistoryFeed.tsx       # Alert dispatch history
│
└── lib/adk/
    ├── intent-classifier.ts       # Stage 1: NL → ADKIntent
    ├── report-definition-agent.ts # Stage 2: ADKIntent → ReportDefinition
    ├── monitoring-rule-agent.ts   # Stage 3: ADKIntent → MonitoringRule
    ├── schedule-config-agent.ts   # Stage 4: ADKIntent → ScheduleConfig
    ├── tools/
    │   ├── schema-introspect-tool.ts
    │   ├── sql-generate-tool.ts
    │   ├── sql-validate-tool.ts
    │   └── rule-persist-tool.ts
    └── types.ts                   # ADKIntent, ThresholdIntent, etc.
```

---

### 5.5 Alert & Threshold Engine

The threshold engine is a pure function operating on report execution results. It is stateless and deterministic, enabling easy unit testing and replay.

#### 5.5.1 Threshold Evaluation Logic

```typescript
// src/lib/monitoring/threshold-engine.ts

export type ThresholdStatus = "PASS" | "BREACH" | "ESCALATE" | "NO_DATA" | "ERROR"

export interface ThresholdEvaluation {
  status: ThresholdStatus
  actualValue: number | null
  thresholdValue: number
  operator: ThresholdOperator
  deltaFromPrevious?: number     // % change from last execution
  breachSeverity?: "WARNING" | "CRITICAL"
  message: string
}

export function evaluateThreshold(
  result: ReportExecutionResult,
  rule: MonitoringRule,
  previousExecution?: MonitoringExecution
): ThresholdEvaluation {
  if (!result.rows || result.rows.length === 0) {
    return { status: "NO_DATA", actualValue: null, ... }
  }

  const actualValue = extractMetricValue(result.rows, rule.metricColumn)

  const breached = applyOperator(actualValue, rule.operator, rule.thresholdValue)

  if (!breached) {
    return { status: "PASS", actualValue, ... }
  }

  // Determine severity based on percentage deviation
  const deviationPct = Math.abs((actualValue - rule.thresholdValue) / rule.thresholdValue) * 100
  const severity = deviationPct > rule.escalationThresholdPct ? "CRITICAL" : "WARNING"
  const status = severity === "CRITICAL" ? "ESCALATE" : "BREACH"

  return { status, actualValue, thresholdValue: rule.thresholdValue, breachSeverity: severity, ... }
}
```

#### 5.5.2 Multi-Channel Alert Dispatch

```typescript
// src/lib/monitoring/alert-dispatcher.ts

export interface AlertDispatchResult {
  channel: AlertChannel
  success: boolean
  messageId?: string
  error?: string
}

export async function dispatchAlerts(
  rule: MonitoringRule,
  evaluation: ThresholdEvaluation,
  executionResult: ReportExecutionResult
): Promise<AlertDispatchResult[]> {
  const template = await renderAlertTemplate(rule, evaluation, executionResult)
  const recipients = await resolveRecipients(rule)

  return Promise.allSettled([
    rule.alertChannels.includes("email")
      ? sendEmailAlert(recipients.email, template)
      : Promise.resolve(null),

    rule.alertChannels.includes("in_app")
      ? createInAppNotifications(recipients.userIds, template)
      : Promise.resolve(null),

    rule.alertChannels.includes("webhook") && rule.webhookUrl
      ? sendWebhookAlert(rule.webhookUrl, template)
      : Promise.resolve(null),
  ]).then(results => results.map(r => r.status === "fulfilled" ? r.value : { success: false }))
}
```

#### 5.5.3 Alert Email Template

```
Subject: [ALERT] {{ rule.name }} — {{ evaluation.breachSeverity }}

Monitoring Alert: {{ rule.name }}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Status:     {{ evaluation.status }}
Severity:   {{ evaluation.breachSeverity }}
Triggered:  {{ execution.executedAt | formatDate }}

Metric:       {{ rule.metricColumn }}
Actual Value: {{ evaluation.actualValue | formatNumber }}
Threshold:    {{ evaluation.operator }} {{ rule.thresholdValue | formatNumber }}
{% if evaluation.deltaFromPrevious %}
Change vs Last Run: {{ evaluation.deltaFromPrevious }}%
{% endif %}

Data Source:  {{ dataSource.name }}
Report:       {{ reportDefinition.name }}

[ View Report ]   [ View Rule ]   [ Snooze Alert ]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Enterprise Reporting Platform
Manage alert preferences: {{ preferencesUrl }}
```

---

## 6. Data Flow Architecture

### 6.1 Rule Creation Flow

```
USER                    UI                  API             MASTRA.AI          TRIGGER.DEV        DB
 │                       │                   │                  │                    │              │
 │  "Alert every Mon     │                   │                  │                    │              │
 │   if revenue < 50k"   │                   │                  │                    │              │
 ├──────────────────────►│                   │                  │                    │              │
 │                       │  POST /api/adk/   │                  │                    │              │
 │                       │  analyze-intent   │                  │                    │              │
 │                       ├──────────────────►│                  │                    │              │
 │                       │                   │  POST            │                    │              │
 │                       │                   │  /api/build-     │                    │              │
 │                       │                   │  monitoring-     │                    │              │
 │                       │                   │  pipeline        │                    │              │
 │                       │                   ├─────────────────►│                    │              │
 │                       │                   │                  │  rbac_context_     │              │
 │                       │                   │                  │  resolve()         │              │
 │                       │                   │                  ├───────────────────────────────►   │
 │                       │                   │                  │                    │  SELECT roles,│
 │                       │                   │                  │◄───────────────────────────────   │
 │                       │                   │                  │  schema_discovery  │              │
 │                       │                   │                  │  (RBAC-filtered)   │              │
 │                       │                   │                  ├───────────────────────────────►   │
 │                       │                   │                  │◄───────────────────────────────   │
 │                       │                   │                  │  sql_generation    │              │
 │                       │                   │                  │  (LLM + schema)    │              │
 │                       │                   │                  │  sql_validation    │              │
 │                       │                   │                  │  artifact_assembly │              │
 │                       │                   │                  │  persistence       │              │
 │                       │                   │                  ├───────────────────────────────►   │
 │                       │                   │                  │                    │  INSERT       │
 │                       │                   │                  │◄───────────────────────────────   │
 │                       │                   │                  │  schedules.create()│              │
 │                       │                   │                  ├──────────────────►│              │
 │                       │                   │                  │◄──────────────────│              │
 │                       │                   │◄─────────────────│                   │              │
 │                       │◄──────────────────│                  │                   │              │
 │  "Rule created!        │                   │                  │                   │              │
 │   Next run: Monday     │                   │                  │                   │              │
 │   08:00 UTC"           │                   │                  │                   │              │
 │◄──────────────────────│                   │                  │                   │              │
```

### 6.2 Scheduled Execution Flow (Every Monday)

```
TRIGGER.DEV             DB              DATA SOURCE           ALERT DISPATCHER      USER
     │                   │                   │                       │               │
     │  CRON fires       │                   │                       │               │
     │  08:00 Mon        │                   │                       │               │
     │  Load payload     │                   │                       │               │
     ├──────────────────►│                   │                       │               │
     │  Fetch            │                   │                       │               │
     │  MonitoringRule   │                   │                       │               │
     │  ReportDefinition │                   │                       │               │
     │◄──────────────────│                   │                       │               │
     │                   │                   │                       │               │
     │  Validate RBAC    │                   │                       │               │
     ├──────────────────►│                   │                       │               │
     │◄──────────────────│                   │                       │               │
     │                   │                   │                       │               │
     │  Execute SQL      │                   │                       │               │
     ├───────────────────────────────────────►                       │               │
     │  { rows, timing } │                   │                       │               │
     │◄───────────────────────────────────────                       │               │
     │                   │                   │                       │               │
     │  Evaluate         │                   │                       │               │
     │  threshold        │                   │                       │               │
     │  ──────────────── │                   │                       │               │
     │  BREACH detected  │                   │                       │               │
     │                   │                   │                       │               │
     │  Dispatch alerts  │                   │                       │               │
     ├───────────────────────────────────────────────────────────────►               │
     │                   │                   │                       │  Email + Notif │
     │                   │                   │                       ├──────────────►│
     │                   │                   │                       │               │
     │  Record execution │                   │                       │               │
     ├──────────────────►│                   │                       │               │
     │  INSERT           │                   │                       │               │
     │  monitoring_exec  │                   │                       │               │
     │◄──────────────────│                   │                       │               │
```

---

## 7. RBAC Integration Design

### 7.1 RBAC Enforcement Hierarchy

RBAC is enforced at **four distinct layers** across the pipeline:

```
Layer 1: NL Interface         — User can only select data sources they have 'execute' permission on
         ↓
Layer 2: Mastra.ai Workflow   — Schema discovery filters to RBAC-accessible tables/columns only
         ↓
Layer 3: SQL Generation       — Generated SQL is constrained to allowlisted columns; row filters appended
         ↓
Layer 4: Trigger.dev Execution — RBAC re-validated at execution time; snapshot compared to current state
```

### 7.2 Permission Requirements for Monitoring Rules

| Action | Required Permission |
|---|---|
| Create monitoring rule | `data_source:execute` on the target data source |
| View own monitoring rules | Authenticated (no additional permission) |
| View all monitoring rules | `admin:monitoring:read` (admin role) |
| Edit monitoring rule | Rule creator OR `admin:monitoring:write` |
| Delete monitoring rule | Rule creator OR `admin:monitoring:delete` |
| Manually trigger execution | Rule creator OR `admin:monitoring:execute` |
| View alert history | Rule creator OR `admin:monitoring:read` |

### 7.3 RBAC Snapshot & Drift Detection

When a monitoring rule executes, its RBAC snapshot (captured at creation) is compared against the user's current permissions:

```typescript
// src/lib/monitoring/rbac-drift-detector.ts

export type RBACDriftType =
  | "PERMISSION_REVOKED"      // User lost access to data source
  | "PERMISSION_REDUCED"      // Column allowlist narrowed
  | "PERMISSION_EXPANDED"     // User gained additional access (safe, no action)
  | "DATA_SOURCE_DELETED"     // Underlying data source removed
  | "NO_DRIFT"                // No change

export async function detectRBACDrift(
  snapshot: RBACWorkflowContext,
  userId: string
): Promise<{ driftType: RBACDriftType; canProceed: boolean; details: string }> {
  const current = await resolveRBACContext(userId)

  for (const snapshotDS of snapshot.accessibleDataSources) {
    const currentDS = current.accessibleDataSources.find(ds => ds.id === snapshotDS.id)

    if (!currentDS) {
      return { driftType: "PERMISSION_REVOKED", canProceed: false,
        details: `Access to data source '${snapshotDS.name}' has been revoked` }
    }

    const revokedColumns = Object.entries(snapshotDS.allowedColumns).flatMap(
      ([table, cols]) => cols.filter(c => !currentDS.allowedColumns[table]?.includes(c))
        .map(c => `${table}.${c}`)
    )

    if (revokedColumns.length > 0) {
      return { driftType: "PERMISSION_REDUCED", canProceed: false,
        details: `Column access revoked: ${revokedColumns.join(", ")}` }
    }
  }

  return { driftType: "NO_DRIFT", canProceed: true, details: "" }
}
```

---

## 8. Database Schema Extensions

### 8.1 New Tables

#### `monitoring_rules`

```sql
CREATE TABLE monitoring_rules (
  id                        VARCHAR(36)   PRIMARY KEY,
  name                      VARCHAR(255)  NOT NULL,
  description               TEXT,

  -- Linkage
  report_definition_id      VARCHAR(36)   NOT NULL REFERENCES report_definitions(id) ON DELETE CASCADE,
  job_definition_id         VARCHAR(36)   REFERENCES job_definitions(id),
  data_source_id            VARCHAR(36)   NOT NULL REFERENCES data_sources(id),
  created_by                VARCHAR(36)   NOT NULL REFERENCES users(id),

  -- Threshold configuration
  metric_column             VARCHAR(255)  NOT NULL,   -- Column name in report result
  threshold_operator        ENUM('gt','gte','lt','lte','eq','neq','between') NOT NULL,
  threshold_value           DECIMAL(20,4) NOT NULL,
  threshold_upper_bound     DECIMAL(20,4),             -- For 'between' operator
  escalation_threshold_pct  DECIMAL(5,2)  DEFAULT 20.0, -- % deviation for ESCALATE

  -- Schedule
  cron_expression           VARCHAR(100)  NOT NULL,    -- e.g., "0 8 * * 1"
  timezone                  VARCHAR(64)   NOT NULL DEFAULT 'UTC',
  trigger_schedule_id       VARCHAR(255),              -- Trigger.dev schedule handle

  -- Alert configuration
  alert_channels            JSON          NOT NULL,    -- ["email","in_app","webhook"]
  alert_recipients          JSON          NOT NULL,    -- [{type:"user",id:...},{type:"role",id:...}]
  webhook_url               VARCHAR(500),
  notify_on_pass            BOOLEAN       DEFAULT FALSE,
  notify_on_no_data         BOOLEAN       DEFAULT TRUE,

  -- RBAC snapshot
  rbac_snapshot             JSON          NOT NULL,    -- RBACWorkflowContext serialized
  rbac_snapshot_version     INT           NOT NULL DEFAULT 1,

  -- Status
  is_active                 BOOLEAN       DEFAULT TRUE,
  is_paused                 BOOLEAN       DEFAULT FALSE,
  pause_reason              TEXT,

  -- NL provenance
  original_nl_request       TEXT,                      -- Original user input
  adk_intent                JSON,                      -- Parsed ADKIntent

  -- Execution tracking
  last_executed_at          DATETIME,
  last_execution_status     ENUM('PASS','BREACH','ESCALATE','NO_DATA','ERROR'),
  last_metric_value         DECIMAL(20,4),
  consecutive_breaches      INT           DEFAULT 0,
  total_executions          INT           DEFAULT 0,
  total_alerts_sent         INT           DEFAULT 0,

  created_at                DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_created_by      (created_by),
  INDEX idx_data_source_id  (data_source_id),
  INDEX idx_is_active       (is_active),
  INDEX idx_last_executed   (last_executed_at)
);
```

#### `monitoring_executions`

```sql
CREATE TABLE monitoring_executions (
  id                    VARCHAR(36)   PRIMARY KEY,
  monitoring_rule_id    VARCHAR(36)   NOT NULL REFERENCES monitoring_rules(id) ON DELETE CASCADE,
  job_execution_id      VARCHAR(36)   REFERENCES job_executions(id),

  -- Execution context
  executed_at           DATETIME      NOT NULL,
  execution_ms          INT,
  rows_returned         INT,
  sql_executed          TEXT,         -- Actual SQL run (may include date params)

  -- Results
  metric_value          DECIMAL(20,4),
  previous_metric_value DECIMAL(20,4),
  delta_pct             DECIMAL(8,4),
  evaluation_status     ENUM('PASS','BREACH','ESCALATE','NO_DATA','ERROR') NOT NULL,
  evaluation_detail     TEXT,

  -- Alert dispatch
  alert_dispatched      BOOLEAN       DEFAULT FALSE,
  alert_channels_used   JSON,
  alert_recipients_sent JSON,
  alert_sent_at         DATETIME,

  -- Error tracking
  error_message         TEXT,
  error_phase           ENUM('rbac_check','sql_execution','threshold_eval','alert_dispatch'),

  created_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_rule_id     (monitoring_rule_id),
  INDEX idx_executed_at (executed_at),
  INDEX idx_status      (evaluation_status)
);
```

#### `adk_intents`

```sql
CREATE TABLE adk_intents (
  id                    VARCHAR(36)   PRIMARY KEY,
  user_id               VARCHAR(36)   NOT NULL REFERENCES users(id),
  session_id            VARCHAR(255),

  -- Input
  raw_nl_request        TEXT          NOT NULL,
  request_source        ENUM('text','voice') DEFAULT 'text',

  -- Classified output
  intent_type           VARCHAR(50)   NOT NULL,
  confidence            DECIMAL(4,3),
  adk_intent_json       JSON          NOT NULL,   -- Full ADKIntent object

  -- Pipeline outcome
  pipeline_status       ENUM('pending','success','failed','partial') DEFAULT 'pending',
  report_definition_id  VARCHAR(36)   REFERENCES report_definitions(id),
  monitoring_rule_id    VARCHAR(36)   REFERENCES monitoring_rules(id),
  error_message         TEXT,

  -- Timing
  classification_ms     INT,
  total_pipeline_ms     INT,

  created_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_user_id     (user_id),
  INDEX idx_created_at  (created_at)
);
```

### 8.2 Extended Columns on Existing Tables

#### `report_definitions` — add columns

```sql
ALTER TABLE report_definitions
  ADD COLUMN origin         ENUM('manual','adk','import') DEFAULT 'manual',
  ADD COLUMN adk_intent_id  VARCHAR(36) REFERENCES adk_intents(id),
  ADD COLUMN is_monitoring  BOOLEAN DEFAULT FALSE;
```

#### `job_definitions` — add columns

```sql
ALTER TABLE job_definitions
  ADD COLUMN job_category          ENUM('export','scheduled_refresh','monitoring','email_batch') DEFAULT 'export',
  ADD COLUMN monitoring_rule_id    VARCHAR(36) REFERENCES monitoring_rules(id),
  ADD COLUMN trigger_schedule_id   VARCHAR(255);
```

#### `audit_log` — new action types

```typescript
// src/types/actions.ts — extend existing audit actions
export const MONITORING_AUDIT_ACTIONS = {
  MONITORING_RULE_CREATED:        "monitoring_rule_created",
  MONITORING_RULE_UPDATED:        "monitoring_rule_updated",
  MONITORING_RULE_DELETED:        "monitoring_rule_deleted",
  MONITORING_RULE_PAUSED:         "monitoring_rule_paused",
  MONITORING_RULE_RESUMED:        "monitoring_rule_resumed",
  MONITORING_EXECUTED:            "monitoring_executed",
  MONITORING_BREACH_DETECTED:     "monitoring_breach_detected",
  MONITORING_ALERT_DISPATCHED:    "monitoring_alert_dispatched",
  MONITORING_RBAC_DRIFT_DETECTED: "monitoring_rbac_drift_detected",
  ADK_INTENT_CLASSIFIED:          "adk_intent_classified",
  ADK_PIPELINE_COMPLETED:         "adk_pipeline_completed",
} as const
```

---

## 9. API Surface Design

### 9.1 New REST Endpoints

#### ADK Intent API

```
POST   /api/adk/analyze-intent
  Body: { nlRequest: string, dataSourceId?: string }
  Response: { intentId, adkIntent: ADKIntent, confidence, requiresDisambiguation }

POST   /api/adk/build-pipeline
  Body: { intentId, dataSourceId, confirmed: boolean }
  Response: { reportDefinitionId, monitoringRuleId, jobDefinitionId, nextRunAt }

GET    /api/adk/intents
  Query: ?page=0&pageSize=20&userId=...
  Response: PaginatedList<ADKIntent>
```

#### Monitoring Rules API

```
GET    /api/monitoring/rules
  Query: ?page=0&pageSize=20&status=active|paused|all
  Response: PaginatedList<MonitoringRule>

POST   /api/monitoring/rules
  Body: { reportDefinitionId, thresholdConfig, scheduleConfig, alertConfig, nlSource? }
  Response: MonitoringRule

GET    /api/monitoring/rules/:id
  Response: MonitoringRule & { executions: MonitoringExecution[], alertHistory: AlertRecord[] }

PUT    /api/monitoring/rules/:id
  Body: Partial<MonitoringRule>
  Response: MonitoringRule

DELETE /api/monitoring/rules/:id
  Response: { success: true }

POST   /api/monitoring/rules/:id/pause
  Body: { reason?: string }
  Response: MonitoringRule

POST   /api/monitoring/rules/:id/resume
  Response: MonitoringRule

POST   /api/monitoring/rules/:id/execute-now
  Response: { executionId, status }

GET    /api/monitoring/rules/:id/executions
  Query: ?page=0&pageSize=20
  Response: PaginatedList<MonitoringExecution>
```

#### Mastra.ai Workflow Endpoints (new on mastra server)

```
POST   /api/build-monitoring-pipeline
  Body: { adkIntent: ADKIntent, userSession: SessionContext }
  Response: { reportDefinition, monitoringRule, scheduleConfig }

POST   /api/rbac-schema
  Body: { userId, dataSourceId }
  Response: { filteredSchema: FilteredSchema }

POST   /api/validate-monitoring-rule
  Body: { reportDefinitionId, monitoringRule, rbacContext }
  Response: { valid, errors[], warnings[] }

GET    /api/workflow-status/:workflowId
  Response: { status, progress, result?, error? }
```

### 9.2 Extended Server Functions

```typescript
// src/server-fns/monitoring.ts

export const analyzeMonitoringIntent = createServerFn({ method: "POST" })
  .handler(async ({ data: { nlRequest, dataSourceId } }) => {
    const session = await requireAuth()
    // Validates RBAC, calls ADK pipeline
    return adkAnalyzeIntent(nlRequest, dataSourceId, session.user.id)
  })

export const createMonitoringRule = createServerFn({ method: "POST" })
  .handler(async ({ data: { intentId, dataSourceId } }) => {
    const session = await requireAuth()
    // Calls Mastra workflow, persists artifacts, schedules Trigger.dev job
    return mastraBuildMonitoringPipeline(intentId, dataSourceId, session)
  })

export const listMonitoringRules = createServerFn({ method: "GET" })
  .handler(async ({ data: { page, pageSize } }) => {
    const session = await requireAuth()
    // Returns rules created by user (admins see all)
    return queryMonitoringRules(session.user.id, page, pageSize)
  })
```

---

## 10. Security Architecture

### 10.1 Threat Model

| Threat | Mitigation |
|---|---|
| **Privilege Escalation via Scheduled Jobs** | RBAC snapshot frozen at rule creation; re-validated at each execution |
| **SQL Injection via NL Interface** | All generated SQL passes ANTLR4 validation + Kysely parameterization |
| **Data Exfiltration via Monitoring Rules** | Column allowlist enforced in Mastra schema discovery step |
| **Unauthorized Rule Creation** | `data_source:execute` permission required; no rule can exceed creator's access |
| **Webhook Endpoint Abuse** | Webhook URL allowlist (SSRF prevention); outbound-only; no auth headers forwarded |
| **Alert Recipient Spoofing** | Recipients resolved against platform user registry; external emails require admin approval |
| **RBAC Drift Exploitation** | Job paused and alert sent if permission revocation detected at execution time |
| **Prompt Injection in NL Interface** | NL input sanitized before passing to LLM; output validated against JSON schema |
| **Excessive Execution Resource Usage** | Query execution timeout (30s); row limit (10,000); concurrent execution limit per user (3) |

### 10.2 SSRF Prevention for Webhooks

```typescript
// src/lib/monitoring/webhook-validator.ts

const BLOCKED_RANGES = [
  /^10\.\d+\.\d+\.\d+/,           // RFC1918 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./,   // RFC1918 172.16.0.0/12
  /^192\.168\./,                   // RFC1918 192.168.0.0/16
  /^127\./,                        // Loopback
  /^169\.254\./,                   // Link-local
  /^::1$/,                         // IPv6 loopback
  /^fd[0-9a-f]{2}:/i,              // IPv6 ULA
]

export async function validateWebhookUrl(url: string): Promise<boolean> {
  const parsed = new URL(url)
  if (!["https:"].includes(parsed.protocol)) return false

  const { address } = await dns.lookup(parsed.hostname)
  return !BLOCKED_RANGES.some(re => re.test(address))
}
```

### 10.3 Audit Trail for Monitoring Operations

Every monitoring lifecycle event is recorded to the existing `audit_log` table:

| Event | Logged Fields |
|---|---|
| Rule creation | userId, intentId, dataSourceId, reportId, ruleId, sqlHash |
| Rule execution | ruleId, executionId, metricValue, status, durationMs |
| Threshold breach | ruleId, actualValue, thresholdValue, severity |
| Alert dispatch | ruleId, channels, recipientCount, deliveryStatus |
| RBAC drift | ruleId, driftType, previousSnapshot, currentPermissions |
| Rule deletion | ruleId, deletedBy, reason |

---

## 11. Infrastructure & Deployment

### 11.1 Updated Service Topology

```
                        ┌──────────────────────┐
                        │      Nginx (TLS)     │
                        └──────────┬───────────┘
                                   │
            ┌──────────────────────┼─────────────────────┐
            │                      │                      │
   ┌────────▼───────┐   ┌──────────▼──────────┐  ┌───────▼────────┐
   │   TanStack     │   │    Mastra.ai Server  │  │  Trigger.dev   │
   │   App (Bun)    │   │    (Bun, port 4111)  │  │  (Cloud/Local) │
   │   port 4050    │   │                      │  │                │
   └────────┬───────┘   │  Endpoints:          │  │  Tasks:        │
            │           │  /api/build-          │  │  monitoring:   │
            │           │    monitoring-        │  │    evaluate    │
            │           │    pipeline           │  │  report:       │
            │           │  /api/rbac-schema     │  │    generate    │
            │           │  /api/nl-to-sql       │  │  email:batch   │
            │           │  /v1/chat/completions  │  │                │
            │           └──────────┬────────────┘  └───────┬────────┘
            │                      │                        │
            └──────────────────────┼────────────────────────┘
                                   │
                        ┌──────────▼───────────┐
                        │   MariaDB Config DB   │
                        │   + monitoring_rules  │
                        │   + monitoring_execs  │
                        │   + adk_intents       │
                        └──────────────────────┘
```

### 11.2 New Environment Variables

```bash
# ADK Configuration
ADK_MODEL=claude-sonnet-4-6          # Model for intent classification
ADK_TEMPERATURE=0.1                   # Low temperature for deterministic output
ADK_MAX_TOKENS=4096
ADK_FALLBACK_MODEL=qwen3.6            # Local fallback if cloud API unavailable

# Monitoring Engine
MONITORING_MAX_ROWS=10000             # Safety limit on report execution row count
MONITORING_QUERY_TIMEOUT_MS=30000    # Per-execution SQL timeout
MONITORING_MAX_CONCURRENT=3          # Max concurrent executions per user
MONITORING_WEBHOOK_TIMEOUT_MS=5000   # Webhook delivery timeout

# RBAC Snapshot
RBAC_SNAPSHOT_DRIFT_CHECK=true       # Enable drift detection at execution time
RBAC_SNAPSHOT_HARD_FAIL=true         # Abort execution on permission revocation

# Alert Delivery
ALERT_EMAIL_FROM=alerts@yourcompany.com
ALERT_WEBHOOK_ALLOWLIST=             # Comma-separated allowed domains (empty = all HTTPS)
ALERT_MAX_PER_RULE_PER_DAY=10        # Rate limit alerts per rule
```

### 11.3 Docker Compose Extension

```yaml
# docker-compose.yml (additions)
services:
  mastra:
    build:
      context: .
      dockerfile: Dockerfile.mastra
    ports:
      - "4111:4111"
    environment:
      - MASTRA_PORT=4111
      - LLAMA_REASONING_URL=${LLAMA_REASONING_URL}
      - LLAMA_REASONING_MODEL=${LLAMA_REASONING_MODEL}
      - ADK_MODEL=${ADK_MODEL}
    depends_on:
      - db
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4111/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## 12. Implementation Roadmap

### Phase 1 — Foundation (Weeks 1–3)

**Objective:** Database schema, RBAC context resolver, Mastra workflow skeleton

| Task | Owner | Est. |
|---|---|---|
| Add `monitoring_rules`, `monitoring_executions`, `adk_intents` migrations | Backend | 2d |
| Implement `resolveRBACContext()` and `detectRBACDrift()` | Backend | 3d |
| Extend Mastra server with `/api/rbac-schema` endpoint | Backend | 2d |
| Implement `monitoring:evaluate` Trigger.dev task (stub) | Backend | 2d |
| Define ADKIntent TypeScript types and JSON schemas | Backend | 1d |
| Implement threshold evaluation engine + unit tests | Backend | 2d |
| Extend audit log with monitoring action types | Backend | 1d |

**Milestone:** RBAC-scoped schema can be retrieved; monitoring rule DB model is live.

---

### Phase 2 — ADK Pipeline (Weeks 4–6)

**Objective:** Full NL → structured artifacts pipeline

| Task | Owner | Est. |
|---|---|---|
| Implement `IntentClassifierAgent` (Stage 1) | AI/Backend | 3d |
| Implement `ReportDefinitionAgent` with tool calls (Stage 2) | AI/Backend | 4d |
| Implement `MonitoringRuleAgent` (Stage 3) | AI/Backend | 2d |
| Implement `ScheduleConfigAgent` with cron resolution (Stage 4) | Backend | 2d |
| Implement ADK tool: `schema-introspect-tool` | Backend | 1d |
| Implement ADK tool: `sql-generate-tool` (delegate to Mastra) | Backend | 1d |
| Implement ADK tool: `rule-persist-tool` | Backend | 2d |
| POST `/api/adk/analyze-intent` endpoint | Backend | 1d |

**Milestone:** End-to-end NL → ADKIntent → ReportDefinition → MonitoringRule pipeline runs in staging.

---

### Phase 3 — Mastra.ai Orchestration (Weeks 7–9)

**Objective:** Dynamic, RBAC-aware Mastra workflow replacing current static proxy

| Task | Owner | Est. |
|---|---|---|
| Implement 6-step Mastra workflow (`build_monitoring_pipeline`) | Backend | 5d |
| Integrate RBAC context into SQL generation (Step 3) | Backend | 3d |
| Row-level security predicate injection | Backend | 2d |
| `/api/build-monitoring-pipeline` endpoint | Backend | 1d |
| `/api/validate-monitoring-rule` dry-run endpoint | Backend | 1d |
| Trigger.dev `schedules.create()` integration | Backend | 2d |
| Integration testing: NL → Mastra → Trigger.dev schedule | QA | 3d |

**Milestone:** A monitoring rule created via NL correctly produces a scheduled Trigger.dev job with RBAC-scoped SQL.

---

### Phase 4 — Execution Engine (Weeks 10–11)

**Objective:** Complete `monitoring:evaluate` task with alert dispatch

| Task | Owner | Est. |
|---|---|---|
| Phase 1–5 implementation in `monitoringEvaluateTask` | Backend | 5d |
| Multi-channel alert dispatcher (email + in-app + webhook) | Backend | 3d |
| Alert email template design and rendering | Frontend | 2d |
| Rate limiting (alerts per rule per day) | Backend | 1d |
| Webhook SSRF prevention | Backend | 1d |
| Alert delivery audit logging | Backend | 1d |

**Milestone:** Full execution cycle verified: cron fires → SQL executes → threshold evaluated → email alert delivered.

---

### Phase 5 — Natural Language Interface (Weeks 12–14)

**Objective:** Production-ready UI for monitoring rule creation and management

| Task | Owner | Est. |
|---|---|---|
| `NLMonitoringCreator.tsx` component | Frontend | 4d |
| `IntentReviewPanel.tsx` — parsed intent confirmation | Frontend | 2d |
| `GeneratedSQLPreview.tsx` — editable SQL | Frontend | 2d |
| `ThresholdConfigurator.tsx` | Frontend | 1d |
| `ScheduleConfigurator.tsx` with visual cron picker | Frontend | 2d |
| `AlertChannelSelector.tsx` | Frontend | 1d |
| Monitoring rules dashboard (`/monitoring/index`) | Frontend | 3d |
| Execution history table + alert history feed | Frontend | 2d |
| Voice input support (existing Qwen3 ASR integration) | Frontend | 1d |

**Milestone:** Complete end-to-end user journey testable in browser.

---

### Phase 6 — Hardening & Launch (Weeks 15–16)

**Objective:** Production readiness

| Task | Owner | Est. |
|---|---|---|
| E2E tests: full monitoring rule lifecycle | QA | 3d |
| RBAC drift detection integration tests | QA | 2d |
| Load testing: concurrent monitoring executions | QA | 2d |
| Security review: SSRF, injection, privilege escalation | Security | 2d |
| Monitoring admin panel (pause/resume/delete all rules) | Frontend | 2d |
| Documentation: user guide + admin guide | Docs | 2d |
| Production deployment runbook | DevOps | 1d |

**Milestone:** All P0/P1 goals met; system deployed to production.

---

## 13. Technology Dependencies

### 13.1 Existing Dependencies (No New Installation)

| Package | Current Version | Role in Enhancement |
|---|---|---|
| `@trigger.dev/sdk` | v3 | Extended with `monitoring:evaluate` task + `schedules` API |
| `@ai-sdk/openai` | Current | ADK intent classification (cloud model) |
| `nodemailer` | Current | Alert email delivery |
| `kysely` | Current | Monitoring rule DB queries |
| `jose` | Current | JWT context propagation to Mastra |
| `antlr4` | Current | SQL validation in Mastra workflow Step 4 |

### 13.2 New Dependencies

| Package | Purpose | Installation |
|---|---|---|
| `cronstrue` | Human-readable cron descriptions in UI | `bun add cronstrue` |
| `cron-parser` | Cron expression validation + next-run calculation | `bun add cron-parser` |
| `zod` | JSON schema validation for ADKIntent objects | `bun add zod` (if not present) |

### 13.3 Infrastructure Dependencies

| Service | New Requirement | Notes |
|---|---|---|
| Trigger.dev | `schedules.create()` API access | Requires cloud plan or self-hosted v3 |
| Mastra.ai server | Extended with 3 new endpoints | Already self-hosted in `mastra/server.ts` |
| LLM (Qwen3 / OpenAI) | ADK intent classification calls | Existing LLAMA_REASONING_URL or OPENAI_API_KEY |
| SMTP | Alert email delivery | Existing Nodemailer config |

---

## 14. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM-generated SQL accesses unauthorized data | Low | Critical | RBAC column allowlist enforced post-generation; ANTLR validation |
| Trigger.dev job runs with stale RBAC (permission revoked) | Medium | High | RBAC re-validation at execution start; job aborted if revoked |
| NL intent misclassification produces incorrect threshold | Medium | Medium | Explicit user review/confirmation step before rule is persisted |
| Alert storm from threshold oscillation | Medium | Medium | Consecutive breach counter; min gap between alerts (configurable) |
| Mastra.ai workflow latency > user tolerance (~10s) | Medium | Low | Async creation flow; polling/WebSocket progress; optimistic UI |
| Webhook delivery to internal services (SSRF) | Low | High | DNS resolution check against RFC1918 + loopback ranges |
| Monitoring rule SQL changes behavior after data schema drift | Low | Medium | Schema version hash stored in rule; alert sent if schema changes |
| Trigger.dev cloud outage blocks scheduled monitoring | Low | Medium | Local Trigger.dev self-hosted as fallback; last-execution alerting |

---

## 15. Appendix: Reference Flows

### A. Full Example: "Alert every Monday if revenue < $50k"

```
Input NL: "Alert me every Monday if total weekly revenue drops below $50,000"
User: analyst@acme.com  |  Roles: [analyst]  |  DataSources: [sales_analytics_db]

Step 1 — ADK IntentClassifier
  intent_type:   monitoring_rule (confidence: 0.97)
  metric:        total_revenue
  data_hint:     revenue, weekly
  threshold:     { operator: lt, value: 50000 }
  schedule:      { natural: "every Monday", cron: "0 8 * * 1" }
  alert_channels: [email, in_app]

Step 2 — Mastra RBAC Context Resolution
  accessible_data_sources: [sales_analytics_db]
  allowed_tables: [orders, order_items, customers, products]
  allowed_columns:
    orders: [id, order_date, order_total, customer_id, region_id]
    ❌ NOT: orders.cost_price (restricted by resource_permission)

Step 3 — Schema Discovery (RBAC-filtered)
  Fetches: orders, order_items columns excluding cost_price

Step 4 — SQL Generation
  Generated:
    SELECT SUM(order_total) AS weekly_revenue
    FROM orders
    WHERE order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
  
  RBAC enforcement:
    ✅ No SELECT * — explicit column list
    ✅ cost_price not referenced
    ✅ Read-only query (no DML)

Step 5 — User Review in UI
  User sees: SQL preview, condition card, schedule badge
  User clicks: "Create Monitoring Rule"

Step 6 — Persistence
  INSERT report_definitions: { name: "Weekly Revenue Monitor", sql: "...", origin: "adk" }
  INSERT monitoring_rules:   { metric_column: "weekly_revenue", operator: "lt", value: 50000 }
  INSERT job_definitions:    { schedule_cron: "0 8 * * 1", job_category: "monitoring" }
  Trigger.dev: schedules.create({ cron: "0 8 * * 1", task: "monitoring:evaluate" })

Monday 08:00 UTC — Trigger.dev fires
  Phase 1: RBAC check → NO_DRIFT ✅
  Phase 2: Execute SQL → { weekly_revenue: 42380.00 }
  Phase 3: Evaluate: 42380 < 50000 → BREACH (severity: WARNING, deviation: 15.2%)
  Phase 4: Dispatch alerts:
    Email  → analyst@acme.com ✅ (messageId: msg_abc123)
    In-App → notif_456 ✅
  Phase 5: Record:
    monitoring_executions: { status: BREACH, metric_value: 42380.00, alert_dispatched: true }
    audit_log: MONITORING_BREACH_DETECTED
```

### B. RBAC Drift Scenario

```
Rule created:  2026-01-15  analyst@acme.com has execute on sales_analytics_db
RBAC change:   2026-02-01  Admin revokes sales_analytics_db access from analyst role

Monday 2026-02-03 08:00 UTC — Trigger.dev fires
  Phase 1: RBAC check
    Snapshot version: 1 (from 2026-01-15)
    Current check: analyst@acme.com has 0 accessible data sources
    → DRIFT TYPE: PERMISSION_REVOKED
    → canProceed: false

  Action:
    1. Job execution aborted (SQL not executed)
    2. Rule auto-paused (is_paused = true, pause_reason = "RBAC_REVOKED")
    3. Alert dispatched to rule creator: "Your monitoring rule has been paused because
       your access to 'Sales Analytics DB' was revoked. Please contact your administrator."
    4. Admin notification dispatched (if ADMIN_NOTIFY_RBAC_DRIFT = true)
    5. Audit log: MONITORING_RBAC_DRIFT_DETECTED
```

---

*This document was prepared for the Enterprise Reporting Platform engineering team. All component references correspond to the existing codebase at `/home/user/enterprise_reporting_tanstack`. Implementation estimates assume one senior full-stack engineer and one frontend engineer. Adjust timelines based on team composition and parallel workstreams.*

---

**Document End**
