# Business Rules System - Implementation Tickets

## Week 1: Foundation & Database Setup

### [DATABASE-001] Create sys_error_codes table migration

**Priority:** P0
**File:** `database/migrations/008_add_error_codes_table.ts`
**Effort:** ~2 hours

**Description:**
Create database table for centralized error code management. Error codes will be stored in database instead of hardcoded, making them configurable without redeployment.

**Schema:**
- `id` (UUID, primary key)
- `code` (VARCHAR(50), unique, e.g., "VALIDATION_ERROR")
- `message` (TEXT, error message template)
- `severity` (VARCHAR(20): "info", "warning", "error", "critical")
- `category` (VARCHAR(50): "validation", "execution", "system")
- `created_at` (TIMESTAMP)

**Seed Data:** 20 common error codes (VALIDATION_ERROR, RULE_NOT_FOUND, ENTITY_NOT_FOUND, PERMISSION_DENIED, etc.)

**Acceptance Criteria:**
- [ ] Migration runs up cleanly with `bun run migrate`
- [ ] Migration rolls back cleanly with down() function
- [ ] Seeded error codes are queryable: `SELECT * FROM sys_error_codes`
- [ ] Foreign key references use error codes, not hardcoded strings

**Dependencies:** None

---

### [DATABASE-002] Add composite index to sys_rule_definitions

**Priority:** P1
**File:** `database/migrations/009_optimize_rule_lookup_index.ts`
**Effort:** ~30 minutes

**Description:**
Optimize rule lookup query by creating composite index on `(entity_name, operation, is_active)`. Current setup has two separate indexes that require bitmap scan overhead.

**Changes:**
- Drop existing indexes: `idx_rule_definitions_entity`, `idx_rule_definitions_active`
- Create composite index: `idx_rule_definitions_lookup (entity_name, operation, is_active)`

**Expected Impact:**
- Query time: 48ms → 2ms (24x faster)
- Query plan: Index Scan instead of Bitmap Index Scan

**Acceptance Criteria:**
- [ ] Migration runs successfully
- [ ] EXPLAIN ANALYZE shows index scan on query
- [ ] No performance regression on other queries

**Dependencies:** None

---

### [CORE-001] Install @gorules/zen-engine dependency

**Priority:** P0
**File:** `packages/core/package.json`
**Effort:** ~1 hour

**Description:**
Install official GoRules zen-engine library (v0.54.0) for runtime rule evaluation. Create proof-of-concept to verify it works in Next.js serverless environment.

**Commands:**
```bash
bun add @gorules/zen-engine@0.54.0
```

**POC File:** `packages/core/src/rules/zen-engine.poc.ts`
- Parse simple JDM decision model
- Execute with test input data
- Measure execution time
- Verify no WASM compatibility issues

**Acceptance Criteria:**
- [ ] Dependency added to package.json
- [ ] POC successfully parses JDM and returns result
- [ ] POC execution time < 100ms for simple rule
- [ ] No WASM/build errors in Next.js environment

**Dependencies:** None

**Risks:**
- ⚠️ Zen-engine may not work in Next.js serverless (POC will validate)

---

### [CORE-002] Create ZenEngine singleton

**Priority:** P1
**File:** `packages/core/src/rules/zen-engine.singleton.ts`
**Effort:** ~20 minutes

**Description:**
Create singleton instance of ZenEngine to be reused across application. Prevents duplicate JIT compilation and memory waste.

**Code:**
```typescript
import { ZenEngine } from '@gorules/zen-engine';

export const zenEngine = new ZenEngine();
```

**Acceptance Criteria:**
- [ ] Singleton exported from zen-engine.singleton.ts
- [ ] RulesEngineService imports singleton (doesn't create new instance)
- [ ] Workflow imports singleton from @appwithai/core

**Dependencies:** CORE-001 (zen-engine must be installed first)

---

### [CORE-003] Add WORKFLOW_CONFIG constants

**Priority:** P2
**File:** `packages/core/src/config/workflow.config.ts`
**Effort:** ~30 minutes

**Description:**
Extract magic numbers into named constants for better maintainability and documentation.

**Constants:**
```typescript
export const WORKFLOW_CONFIG = {
  TIMEOUT_MS: 300000,        // 5 minutes max workflow duration
  MAX_RETRIES: 3,            // Maximum retry attempts
  RETRY_FACTOR: 2,           // Exponential backoff factor
  MIN_RETRY_TIMEOUT_MS: 1000,
  MAX_RETRY_TIMEOUT_MS: 10000,
  CACHE_TTL_MS: 300000,      // 5 minutes rule cache TTL
  CACHE_MAX_SIZE: 500,       // Max 500 rules in cache
} as const;
```

**Acceptance Criteria:**
- [ ] Constants file created with TypeScript types
- [ ] entity-lifecycle-workflow.task.ts uses WORKFLOW_CONFIG.TIMEOUT_MS
- [ ] No magic numbers in workflow code

**Dependencies:** None

---

## Week 2: Rules Engine Service Integration

### [CORE-004] Integrate zen-engine into RulesEngineService

**Priority:** P0
**File:** `packages/core/src/rules/rules-engine.service.ts`
**Effort:** ~3 hours

**Description:**
Replace placeholder comment (line 34) with actual zen-engine integration. Make `evaluateDecisionTable()` use `zenEngine.createDecision()`.

**Changes:**
- Import `zenEngine` singleton
- Replace simplified evaluator with zen-engine call
- Parse JDM from database (rule.jdm_content)
- Execute via `zenEngine.createDecision(JSON.parse(jdmContent))`
- Handle zen-engine errors (invalid graph, missing nodes, runtime exceptions)

**Acceptance Criteria:**
- [ ] Service executes JDM via zen-engine
- [ ] Returns violations array with { ruleId, matched, actions }
- [ ] Errors are caught and re-thrown with context
- [ ] Unit tests pass with sample JDM

**Dependencies:**
- CORE-001 (zen-engine installed)
- CORE-002 (singleton available)

---

### [CORE-005] Implement loadActiveRule() shared function

**Priority:** P1
**File:** `packages/core/src/rules/rules-engine.service.ts`
**Effort:** ~1 hour

**Description:**
Extract common rule loading logic from `getRule()` method into shared `loadActiveRule()` function. Eliminates DRY violation between service and workflow.

**Function Signature:**
```typescript
async loadActiveRule(
  entityName: string,
  operation: "CREATE" | "READ" | "UPDATE" | "DELETE"
): Promise<RuleDefinition | null>
```

**Acceptance Criteria:**
- [ ] Function queries sys_rule_definitions table
- [ ] Returns null if no active rule found
- [ ] Returns RuleDefinition with parsed jdmContent
- [ ] Both getRule() and workflow use this function

**Dependencies:** None

---

### [CORE-006] Add JDM Zod schema validation

**Priority:** P1
**File:** `packages/core/src/rules/jdm.schema.ts`
**Effort:** ~2 hours

**Description:**
Create Zod schema to validate JDM structure before saving to database. Prevents invalid rules from being stored.

**Schema Requirements:**
- `name` (string, required)
- `nodes` (array, min 1 item, required)
- `edges` (array, optional)
- All nodes must have: `id`, `type`, `position`
- Required node types: at least one "input", one "output", one "decisionTable"
- No circular references in edges

**Acceptance Criteria:**
- [ ] Zod schema exported as `JDMContentSchema`
- [ ] createRule() and updateRule() validate before save
- [ ] Invalid JDM throws error with descriptive message
- [ ] Unit tests cover validation scenarios

**Dependencies:** None

---

### [WEB-001] Add auth middleware to /api/rules routes

**Priority:** P0
**File:** `packages/web/src/app/api/rules/[ruleId]/route.ts`
**Effort:** ~1 hour

**Description:**
Add authentication and authorization middleware to protect rules API endpoints. Currently unauthenticated - security gap.

**Changes:**
- Import `authMiddleware` from better-auth
- Add middleware to GET, PUT, DELETE endpoints
- Check user has permission: `hasPermission(userId, 'sys_rule_definitions', operation)`

**Acceptance Criteria:**
- [ ] Unauthenticated requests return 401
- [ ] Users without permission return 403
- [ ] Admin users bypass RBAC check
- [ ] Unit tests cover 401/403 responses

**Dependencies:** None (AuthService.hasPermission() already exists)

---

## Week 3: Trigger.dev Workflow Integration

### [WORKFLOW-001] Update entity-lifecycle-workflow.task.ts

**Priority:** P0
**File:** `generated-projects/hospital-swiss-clean-new/backend/src/trigger/entity-lifecycle-workflow.task.ts`
**Effort:** ~4 hours

**Description:**
Update existing workflow to use production-ready patterns: Winston logging, connection pooling, zenEngine singleton, eager loading.

**Changes:**
1. Replace `console.log` with Winston logger
2. Add connection pool config to knex instance
3. Import `zenEngine` from @appwithai/core (don't create new instance)
4. Implement `loadEntityWithContext()` with eager JOINs for relations
5. Add structured logging at each step

**Acceptance Criteria:**
- [ ] Workflow uses Winston (not console.log)
- [ ] Connection pool configured (min: 2, max: 10)
- [ ] Uses shared zenEngine singleton
- [ ] Loads relations in single query with JOINs
- [ ] All steps logged with workflowRunId for tracing

**Dependencies:**
- CORE-002 (zenEngine singleton)
- OBS-001 (Winston logging)

---

### [WORKFLOW-002] Add workflow polling helper

**Priority:** P1
**File:** `packages/core/src/workflow/workflow-polling.helper.ts`
**Effort:** ~1 hour

**Description:**
Create helper function for frontend to poll workflow status until completion.

**Function Signature:**
```typescript
export async function pollWorkflowStatus(
  workflowRunId: string,
  timeout: number = 30000,
  interval: number = 500
): Promise<WorkflowStatus>
```

**Acceptance Criteria:**
- [ ] Polls `/api/workflows/[runId]/status` every `interval` ms
- [ ] Times out after `timeout` ms
- [ ] Returns when status is "success" or "error"
- [ ] Throws timeout error if workflow doesn't complete

**Dependencies:** WEB-002 (workflow status API)

---

### [WEB-002] Create workflow status API endpoint

**Priority:** P1
**File:** `packages/web/src/app/api/workflows/[runId]/status/route.ts`
**Effort:** ~1 hour

**Description:**
Create GET endpoint for frontend to poll workflow execution status.

**Response Format:**
```typescript
{
  status: "draft" | "success" | "error",
  duration: number,
  output: any,
  error: string,
  completedAt: Date
}
```

**Acceptance Criteria:**
- [ ] Endpoint queries sys_workflow_runs table
- [ ] Returns 404 if workflowRunId not found
- [ ] Includes auth middleware
- [ ] Unit tests cover success/error cases

**Dependencies:** None

---

## Week 4: Performance Optimization

### [CORE-007] Implement LRU cache for rules

**Priority:** P1
**File:** `packages/core/src/rules/rule-cache.service.ts`
**Effort:** ~2 hours

**Description:**
Implement LRU cache for frequently-accessed rules to reduce database queries.

**Config:**
- Max 500 rules in cache
- 5 minute TTL
- Cache key: `${entityName}:${operation}`

**Acceptance Criteria:**
- [ ] Cache hit on repeated rule loads
- [ ] Cache miss queries database and stores result
- [ ] Cache entries expire after 5 minutes
- [ ] Metrics track cache hit rate

**Dependencies:** None

---

### [CORE-008] Add pagination to getAllRules()

**Priority:** P2
**File:** `packages/core/src/rules/rules-engine.service.ts`
**Effort:** ~1 hour

**Description:**
Add pagination to `getAllRules()` method to prevent memory exhaustion with large rule sets.

**Signature:**
```typescript
async getAllRules(
  page: number = 1,
  limit: number = 50
): Promise<{ rules: RuleDefinition[], total: number }>
```

**Acceptance Criteria:**
- [ ] Method accepts page and limit parameters
- [ ] Returns paginated results
- [ ] Returns total count for pagination UI
- [ ] Default limit = 50, max limit = 500

**Dependencies:** None

---

### [DATABASE-003] Optimize trigger auto-version function

**Priority:** P2
**File:** `database/migrations/010_optimize_rule_trigger.ts`
**Effort:** ~30 minutes

**Description:**
Optimize auto-version trigger to only create snapshot when JDM actually changes (not on every UPDATE).

**Change:**
```sql
CREATE OR REPLACE FUNCTION sys_rule_create_version()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.decision_model IS DISTINCT FROM NEW.decision_model) THEN
    INSERT INTO sys_rule_version ...
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Acceptance Criteria:**
- [ ] Trigger only fires when decision_model column changes
- [ ] Bulk updates without JDM change don't create versions
- [ ] Migration tested in staging

**Dependencies:** None

---

## Week 5: Testing Suite (Part 1)

### [TEST-001] Zen engine integration tests

**Priority:** P0
**File:** `packages/core/src/rules/__tests__/zen-engine.integration.test.ts`
**Effort:** ~2 hours

**Description:**
Test zen-engine integration with real JDM evaluation.

**Test Cases:**
1. Simple decision table evaluates correctly
2. Missing required field returns violation
3. Multiple rules execute in priority order
4. Invalid JDM throws error
5. Performance: execution < 100ms

**Acceptance Criteria:**
- [ ] All 5 tests pass
- [ ] Tests use real zenEngine instance
- [ ] Tests execute in < 5 seconds total

**Dependencies:** CORE-004 (zen-engine integration)

---

### [TEST-002] Auth middleware tests

**Priority:** P0
**File:** `packages/web/src/app/api/rules/__tests__/auth.middleware.test.ts`
**Effort:** ~1.5 hours

**Description:**
Test authentication and authorization on rules API endpoints.

**Test Cases:**
1. Unauthenticated request returns 401
2. Authenticated user without permission returns 403
3. Admin user bypasses RBAC
4. Valid request returns 200

**Acceptance Criteria:**
- [ ] All 4 tests pass
- [ ] Tests mock AuthService.hasPermission()
- [ ] Tests cover GET, PUT, DELETE endpoints

**Dependencies:** WEB-001 (auth middleware)

---

### [TEST-003] RulesEngineService unit tests

**Priority:** P1
**File:** `packages/core/src/rules/__tests__/rules-engine.service.test.ts`
**Effort:** ~2 hours

**Description:**
Unit tests for RulesEngineService methods.
**Test Cases:**
1. `getRule()` returns rule or null
2. `createRule()` validates JDM and saves
3. `updateRule()` increments version
4. Cache hit reduces database queries
5. Invalid JDM throws error

**Acceptance Criteria:**
- [ ] All tests pass
- [ ] Tests mock database calls
- [ ] Coverage ≥ 80%

**Dependencies:** CORE-004, CORE-005, CORE-006

---

### [TEST-004] JDM validation tests

**Priority:** P1
**File:** `packages/core/src/rules/__tests__/jdm.validation.test.ts`
**Effort:** ~1.5 hours

**Description:**
Test JDM schema validation with edge cases.

**Test Cases:**
1. Invalid JSON throws error
2. Missing required nodes throws error
3. Circular references detected
4. Valid JDM passes validation

**Acceptance Criteria:**
- [ ] All 4 tests pass
- [ ] Error messages are descriptive
- [ ] Validation catches all edge cases

**Dependencies:** CORE-006 (Zod schema)

---

## Week 6: Testing Suite (Part 2)

### [TEST-005] API route tests

**Priority:** P0
**File:** `packages/web/src/app/api/rules/__tests__/routes.test.ts`
**Effort:** ~2 hours

**Description:**
Test API endpoint behavior with auth and error handling.

**Test Cases:**
1. GET /api/rules/[ruleId] returns rule (401 if no auth, 403 if no permission, 404 if not found)
2. PUT /api/rules/[ruleId] updates rule (validates JDM, increments version)
3. DELETE /api/rules/[ruleId] deletes rule
4. POST /api/rules/[ruleId]/evaluate executes rule
5. POST /api/rules/evaluate executes all rules for entity/trigger

**Acceptance Criteria:**
- [ ] All 6 tests pass
- [ ] Tests mock database and auth
- [ ] Coverage ≥ 80%

**Dependencies:** WEB-001, WEB-002

---

### [TEST-006] E2E workflow tests

**Priority:** P1
**File:** `tests/e2e/rules-engine.e2e.test.ts`
**Effort:** ~3 hours

**Description:**
End-to-end tests covering complete user workflows.

**Test Cases:**
1. User creates rule via GoRulesEditor → saves → executes via test button
2. Patient entity created → workflow triggered → rule evaluated → status updated
3. Rule blocks operation with violation → workflow status = error → error message visible
4. Rule modifies entity → mutation applied → result verified
5. Multiple rules execute in priority order
6. Workflow timeout triggers retry
7. Feature flag DISABLE_RULES_ENGINE = true bypasses rules

**Acceptance Criteria:**
- [ ] All 7 tests pass
- [ ] Tests run against real database
- [ ] Tests clean up data after execution
- [ ] Tests complete in < 2 minutes total

**Dependencies:** All prior tickets

---

## Week 7: Observability Stack

### [OBS-001] Winston structured logging

**Priority:** P1
**File:** `packages/core/src/observability/winston.config.ts`
**Effort:** ~1.5 hours

**Description:**
Configure Winston for structured JSON logging in production.

**Config:**
```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'rules-engine' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/rules-error.log', level: 'error' })
  ]
});
```

**Log Format:**
```json
{
  "timestamp": "2025-04-02T10:00:00Z",
  "level": "info",
  "message": "Rule executed",
  "workflowRunId": "uuid",
  "entityName": "Patient",
  "operation": "CREATE",
  "duration": 45
}
```

**Acceptance Criteria:**
- [ ] Logger exported from winston.config.ts
- [ ] All console.log replaced with logger.info/error
- [ ] Logs are structured JSON
- [ ] Error logs go to file, console in dev

**Dependencies:** None

---

### [OBS-002] Prometheus metrics

**Priority:** P1
**File:** `packages/core/src/observability/metrics.ts`
**Effort:** ~2 hours

**Description:**
Add Prometheus metrics for workflow monitoring.

**Metrics:**
```typescript
import { Counter, Histogram } from 'prom-client';

export const workflowEvaluations = new Counter({
  name: 'workflow_evaluations_total',
  help: 'Total workflow rule evaluations',
  labelNames: ['entity_name', 'operation', 'status']
});

export const workflowDuration = new Histogram({
  name: 'workflow_duration_seconds',
  help: 'Workflow execution duration',
  labelNames: ['entity_name', 'operation'],
  buckets: [0.1, 0.5, 1, 5, 10, 30]
});
```

**Endpoint:** GET `/metrics` (Prometheus scraping)

**Acceptance Criteria:**
- [ ] Metrics increment on workflow execution
- [ ] Histogram records p50/p95/p99 durations
- [ ] /metrics endpoint returns Prometheus format
- [ ] Metrics visible in Prometheus

**Dependencies:** None

---

### [OBS-003] OpenTelemetry tracing

**Priority:** P2
**File:** `packages/core/src/observability/tracing.ts`
**Effort:** ~1.5 hours

**Description:**
Add distributed tracing to track workflow execution across services.

**Spans:**
- workflow.execution (root span)
- rule.evaluation (child span)
- db.query (child span)

**Acceptance Criteria:**
- [ ] Trace context propagated (traceId, spanId)
- [ ] Spans recorded in OpenTelemetry collector
- [ ] Trace viewable in Jaeger/Zipkin UI

**Dependencies:** None

---

### [OBS-004] AlertManager alerts

**Priority:** P2
**File:** `packages/core/src/observability/alerts.ts`
**Effort:** ~1 hour

**Description:**
Configure AlertManager integration for proactive monitoring.

**Alerts:**
- HighWorkflowErrorRate: error rate > 5% for 5 minutes
- SlowWorkflowDuration: p95 duration > 1 second for 5 minutes

**Acceptance Criteria:**
- [ ] Alerts fire when thresholds exceeded
- [ ] AlertManager receives alert via webhook
- [ ] Alert includes severity and summary

**Dependencies:** OBS-002 (metrics)

---

### [OBS-005] Grafana dashboard

**Priority:** P2
**File:** `monitoring/grafana-dashboards/rules-engine.json`
**Effort:** ~1 hour

**Description:**
Create Grafana dashboard for rules engine monitoring.

**Panels:**
1. Workflow Evaluations Rate (rate of workflow_evaluations_total)
2. Workflow Duration (p95 histogram from workflow_duration_seconds)
3. Error Rate (error rate / total rate)
4. Active Workflows (gauge)

**Acceptance Criteria:**
- [ ] Dashboard JSON created
- [ ] Dashboard imports into Grafana
- [ ] Panels show real-time data
- [ ] Dashboard auto-refreshes every 30s

**Dependencies:** OBS-002

---

## Week 8: Deployment & Documentation

### [DEPLOY-001] Docker Rust build setup

**Priority:** P1
**File:** `Dockerfile.build`
**Effort:** ~2 hours

**Description:**
Configure multi-stage Docker build with Rust toolchain for zen-engine native compilation.

**Dockerfile:**
```dockerfile
# Stage 1: Build native dependencies
FROM node:20-alpine AS builder
RUN apk add --no-cache cargo rust musl-dev gcc g++ make
WORKDIR /app
COPY package*.json ./
COPY packages/core/package*.json ./packages/core/
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/main.js"]
```

**Acceptance Criteria:**
- [ ] Docker image builds successfully on Alpine
- [ ] zen-engine native extension compiles
- [ ] Production image runs without errors
- [ ] Image size < 500MB

**Dependencies:** None

---

### [DEPLOY-002] Migration rollback test

**Priority:** P1
**File:** `database/migrations/__tests__/008_rollback.test.ts`
**Effort:** ~1 hour

**Description:**
Test migration rollback procedure to ensure safe deployment.

**Test:**
1. Run migration up() - verify tables created
2. Run migration down() - verify tables dropped
3. Run migration up() again - verify tables recreated
4. Verify no orphaned objects

**Acceptance Criteria:**
- [ ] Test passes
- [ ] Rollback is safe (no data loss)
- [ ] Test runs in CI/CD pipeline

**Dependencies:** All migrations

---

### [DOCS-001] Operations runbook

**Priority:** P2
**File:** `docs/runbooks/rules-engine-incidents.md`
**Effort:** ~3 hours

**Description:**
Create comprehensive runbook for on-call incident response.

**Sections:**
- Severity levels (P0/P1/P2/P3)
- P0: All workflows failing - symptoms, diagnosis, mitigation, escalation
- P1: Error rate > 10% - symptoms, diagnosis, mitigation
- P2: Error rate > 5% - symptoms, diagnosis, mitigation
- P3: Single workflow failure - symptoms, diagnosis, mitigation
- Common error patterns and solutions

**Acceptance Criteria:**
- [ ] Runbook covers all severity levels
- [ ] Diagnosis steps are clear
- [ ] Mitigation steps are actionable
- [ ] Escalation paths documented

**Dependencies:** OBS-001, OBS-005

---

### [DOCS-002] Architecture diagrams

**Priority:** P2
**File:** `docs/architecture/rules-engine.md`
**Effort:** ~2 hours

**Description:**
Create architecture documentation with ASCII diagrams.

**Diagrams:**
1. System architecture (components and relationships)
2. Data flow (entity → workflow → zen-engine → decision)
3. Error flow (exception → catch → log → alert)
4. Deployment sequence (migrate → deploy → verify → rollback)

**Acceptance Criteria:**
- [ ] All 4 diagrams created
- [ ] Diagrams use ASCII art
- [ ] Diagrams are accurate and up-to-date
- [ ] New engineers can understand system from docs

**Dependencies:** None

---

### [DOCS-003] On-call rotation setup

**Priority:** P2
**File:** `docs/operations/on-call-rotation.md`
**Effort:** ~1 hour

**Description:**
Document on-call rotation process for rules engine support.

**Sections:**
- Weekly rotation schedule
- PagerDuty integration
- Incident log template
- Handoff procedure
- Escalation matrix

**Acceptance Criteria:**
- [ ] Rotation process documented
- [ ] PagerDuty integration configured
- [ ] Incident log template created
- [ ] Escalation paths defined

**Dependencies:** DOCS-001

---

## Generator Templates Update

**Critical Requirement:** All fixes must update generator templates so future generated projects include them.

**Template Files to Update:**

### Template 1: entity-lifecycle-workflow.task.ts.hbs
**File:** `packages/generator/templates/nextjs-nestjs/backend/src/trigger/entity-lifecycle-workflow.task.ts.hbs`

**Changes:**
- Replace console.log with Winston logger
- Add connection pooling config (min: 2, max: 10)
- Import zenEngine singleton from @appwithai/core
- Implement eager loading for relations with JOINs
- Add WORKFLOW_CONFIG constants

**Acceptance:** Generated projects include production-ready workflow

---

### Template 2: rules-engine.service.ts.hbs
**File:** `packages/generator/templates/nextjs-nestjs/backend/src/modules/rules/rules-engine.service.ts.hbs`

**Changes:**
- Integrate zen-engine (replace placeholder comment)
- Add loadActiveRule() shared function
- Add JDM Zod schema validation
- Add LRU cache for rules
- Add pagination to getAllRules()

**Acceptance:** Generated projects include complete rules engine

---

### Template 3: main.ts.hbs (Observability setup)
**File:** `packages/generator/templates/nextjs-nestjs/backend/src/main.ts.hbs`

**Changes:**
- Import Winston logger setup
- Add Prometheus metrics endpoint (/metrics)
- Add OpenTelemetry tracing setup
- Add AlertManager webhook integration

**Acceptance:** Generated projects include observability stack

---

### Template 4: 008_add_error_codes_table.ts.hbs
**File:** `packages/generator/templates/nextjs-nestjs/database/migrations/008_add_error_codes_table.ts.hbs`

**Changes:**
- Create sys_error_codes table
- Seed 20 common error codes
- Add foreign key references

**Acceptance:** Generated projects have database-driven error codes

---

### Template 5: Dockerfile.hbs (Rust build)
**File:** `packages/generator/templates/nextjs-nestjs/Dockerfile.hbs`

**Changes:**
- Install Rust toolchain (cargo, rust, musl-dev)
- Multi-stage build optimization
- Copy zen-engine native extension

**Acceptance:** Generated projects build successfully with zen-engine

---

## Definition of Done

**MVP Complete When:**
- [x] CEO review approved (quality score 7/10 → 9/10)
- [x] Engineering review approved (0 critical gaps)
- [ ] All 39 tickets completed
- [ ] Test coverage ≥ 80% (target: 100%)
- [ ] Performance benchmarks pass (p95 < 500ms)
- [ ] Observability stack deployed (Winston + Prometheus + Grafana)
- [ ] Documentation complete (runbooks + diagrams + on-call)
- [ ] Generator templates updated (all 5 templates)
- [ ] Migration tested in staging (up + down + up)
- [ ] Feature flag tested (ENABLE_RULES_ENGINE = false disables engine)
- [ ] Production deployed and monitored for 24 hours with no P0 incidents

**Ship Criteria:**
- All P0 tests passing
- Error rate < 5% in production
- p95 latency < 500ms
- No unresolved P0 security issues
- Rollback procedure tested and documented

---

## Risk Register

| Risk | Probability | Impact | Mitigation | Status |
|------|------------|--------|-----------|--------|
| Zen-engine doesn't work in Next.js serverless | Low | High | POC in Week 1 validates | ✅ Planned |
| Trigger.dev workflow queue backs up | Medium | High | Connection pooling + monitoring | ✅ Planned |
| N+1 queries slow down workflows | Medium | Medium | Eager loading with JOINs | ✅ Planned |
| Auth bypass exposes rules API | Low | Critical | Auth middleware added | ✅ Planned |
| Migration rollback fails | Low | High | Rollback test added | ✅ Planned |
| Native build fails in Docker | Medium | Medium | Rust build setup documented | ✅ Planned |
| Error codes hardcoded, not configurable | Low | Low | Database-driven approach | ✅ Planned |

---

**Generated:** 2025-04-02
**Total Tickets:** 39 tickets
 **Total Effort:** ~64 hours human / ~9 hours CC+gstack
**Compression:** 7x faster with AI+gstack
