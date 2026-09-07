# Business Rules System - Implementation Plan

## Overview
Make the admin business rules system work professionally for the Simple CRM, then add it to the generator templates. Three components: (A) Visual admin UI, (B) Draft-mode entity CRUD with trigger.dev rule evaluation, (C) Generator template updates.

---

## Part A: Professional Admin Rules UI

### Problem
Current rules pages use a raw JSON textarea for editing JDM decision models. Administrators need a visual decision table editor.

### A1. Decision Table Builder Component
**New file:** `frontend/src/components/rules/DecisionTableEditor.tsx`

A table-based UI where admins build rules visually:
- **Input columns**: Entity field dropdowns (loaded from `/bus/:entity/meta`), with condition operators (is empty, equals, contains, greater than, less than, regex)
- **Output columns**: Action type (prevent, validate, notify), Message text, Rule ID (auto-generated)
- **Add/Remove rows** for multiple conditions
- **Hit policy**: "collect" (all matching rows fire) shown as read-only badge
- Internally generates valid GoRules JDM JSON (nodes: inputNode -> decisionTableNode -> outputNode, edges connecting them)

### A2. Rule Form Component  
**New file:** `frontend/src/components/rules/RuleForm.tsx`

Shared form for both new and edit flows:
- Entity dropdown (populated from `/rules/entities` endpoint -- already exists)
- Operation selector (CREATE, READ, UPDATE, DELETE, ALL)
- Rule name text input
- Active/inactive toggle (edit mode only)
- Embedded `DecisionTableEditor`
- Test Rule button: calls `/rules/dry-run` with sample data, shows results inline
- Save button: serializes decision table to JDM JSON, posts to API

### A3. Update Route Files
**Modify:** `frontend/src/routes/admin/rules/new.tsx` -- use RuleForm instead of raw textarea
**Modify:** `frontend/src/routes/admin/rules/$id.edit.tsx` -- use RuleForm, parse existing JDM back into table format
**Modify:** `frontend/src/routes/admin/rules/index.tsx` -- minor: add entity badge colors, improve empty state

### A4. Fix Entity Name Mismatch
The frontend sends display names like "Account" but rules.service uses `entity_name` column values. The `/rules/entities` endpoint returns both `entityType` (bus_account) and `entityName` (ACCOUNT). Standardize: store the display name in `entity_name` column for admin readability (current behavior), but the `evaluateRules` flow maps display name to table name via the entities endpoint.

No schema change needed -- the current approach works. Just ensure the new/edit form dropdowns use the `entityName` values that match what's in the database.

---

## Part B: Draft-Mode Entity CRUD + Trigger.dev Rule Evaluation

**Key discovery:** `WorkflowService` (workflow.service.ts) already implements trigger/status/retry logic but depends on TWO missing database objects:
1. `sys_workflow_runs` table (doesn't exist)
2. `workflow_status` + `workflow_run_id` columns on bus entity tables (don't exist)

### B1. Create Migration for Missing Database Objects
**New file:** `backend/src/migrations/1780990628054_add_workflow_support.ts`

```sql
-- sys_workflow_runs table (required by WorkflowService)
CREATE TABLE sys_workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_name VARCHAR(100) NOT NULL,
  entity_id UUID NOT NULL,
  operation VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_by VARCHAR(100) NOT NULL,
  error_details TEXT,
  mutations_applied JSONB,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_workflow_runs_entity ON sys_workflow_runs(entity_name, entity_id);
CREATE INDEX idx_workflow_runs_status ON sys_workflow_runs(status);

-- Add workflow + doc_status columns to ALL bus entity tables
ALTER TABLE bus_account ADD COLUMN workflow_status VARCHAR(20) DEFAULT 'none';
ALTER TABLE bus_account ADD COLUMN workflow_run_id UUID;
ALTER TABLE bus_account ADD COLUMN doc_status VARCHAR(20) NOT NULL DEFAULT 'approved';
ALTER TABLE bus_account ADD COLUMN doc_status_message TEXT;
-- (repeat for bus_contact, bus_opportunity, bus_activity)
```

Values for `doc_status`: `draft` | `pending_rules` | `approved` | `rejected`
Values for `workflow_status`: `none` | `draft` | `success` | `error`

Existing records default to `approved` (they were created before rules enforcement).

### B2. Modify BusService for Draft-Mode Flow
**Modify:** `backend/src/modules/bus/bus.service.ts`

Inject `WorkflowService`. On `create()`:
1. Insert record with `doc_status = 'draft'`
2. After insert, call `workflowService.trigger()` (fire-and-forget via `.catch()`)
3. Return the record immediately (caller sees draft status)

On `update()`:
1. Set `doc_status = 'draft'`, `doc_status_message = null`
2. After update, call `workflowService.trigger()`
3. Return the record immediately

On `softDelete()`:
1. Before deleting, trigger workflow with operation='delete'
2. Only proceed with soft-delete if no 'prevent' violations

### B3. Implement Entity Lifecycle Workflow Task
**Modify:** `backend/src/trigger/entity-lifecycle-workflow.task.ts`

Replace placeholder with full implementation:
1. Receive payload: `{ workflowRunId, entityName, entityId, operation, userId }`
2. Create independent Kysely connection (trigger.dev runs outside NestJS DI)
3. Load entity record from the appropriate `bus_*` table
4. Load active rules: `SELECT * FROM sys_rule_definitions WHERE entity_name = :entityName AND (operation = :operation OR operation = 'ALL') AND is_active = true`
5. For each rule, use ZenEngine: `engine.evaluate(JSON.parse(jdmContent), entityData)`
6. Collect violations (where action = 'prevent') and warnings (action = 'validate')
7. If no violations: `UPDATE bus_* SET doc_status = 'approved', workflow_status = 'success', doc_status_message = null`
8. If violations: `UPDATE bus_* SET doc_status = 'rejected', workflow_status = 'error', doc_status_message = :jsonErrors`
9. Update `sys_workflow_runs SET status = 'success'|'error', completed_at = now(), duration_ms, error_details`

### B5. Frontend Status Display
**Modify:** Entity list/detail pages to show `doc_status` badge:
- `draft` - yellow badge "Draft"
- `pending_rules` - blue badge "Processing..."
- `approved` - green badge "Approved"  
- `rejected` - red badge "Rejected" with message tooltip

**Modify:** Entity detail form to show violation messages when rejected, and a "Retry" button to re-trigger evaluation.

### B6. Real-time Status Updates (optional enhancement)
The frontend already uses Electric SQL for real-time sync. When the trigger.dev task updates `doc_status`, Electric SQL will push the change to the frontend automatically. No extra work needed.

---

## Part C: Generator Template Updates

Once everything works in the CRM, port the working files back to Handlebars templates:

### C1. New Frontend Templates
- `frontend/src/components/rules/DecisionTableEditor.tsx.hbs`
- `frontend/src/components/rules/RuleForm.tsx.hbs`
- `frontend/src/routes/admin/rules/index.tsx.hbs`
- `frontend/src/routes/admin/rules/new.tsx.hbs`
- `frontend/src/routes/admin/rules/$id.edit.tsx.hbs`

### C2. Update Backend Templates
- Update `entity-lifecycle-workflow.task.ts.hbs` with real implementation
- Update `rules.service.ts.hbs` if any changes were made
- Add `doc_status` migration template
- Add `sys_workflow_runs` migration template

### C3. Update Bus Service Template
- `bus.service.ts.hbs` -- add draft mode + trigger.dev integration

### C4. Update Seed Template
- `business-data.ts.hbs` -- seed initial rules per entity

---

## Implementation Order

1. **A1-A3**: Build the visual Decision Table Editor and update the admin routes (frontend only, can test immediately)
2. **B1-B2**: Add `doc_status` column migration + modify BusService
3. **B3**: Implement the trigger.dev lifecycle task
4. **B5**: Show doc_status in entity UIs
5. **QA**: Test the full flow end-to-end (create account -> draft -> rules evaluate -> approved/rejected)
6. **C1-C4**: Port to generator templates

---

## Files Changed (CRM - `generated-projects/simple-crm/`)

| Action | File |
|--------|------|
| NEW | `frontend/src/components/rules/DecisionTableEditor.tsx` |
| NEW | `frontend/src/components/rules/RuleForm.tsx` |
| MODIFY | `frontend/src/routes/admin/rules/index.tsx` |
| MODIFY | `frontend/src/routes/admin/rules/new.tsx` |
| MODIFY | `frontend/src/routes/admin/rules/$id.edit.tsx` |
| NEW | `backend/src/migrations/1780990628053_add_doc_status.ts` |
| MODIFY | `backend/src/modules/bus/bus.service.ts` |
| MODIFY | `backend/src/trigger/entity-lifecycle-workflow.task.ts` |
| MODIFY | Entity list/detail pages for doc_status display |

## Files Changed (Templates - `packages/generator/templates/`)

| Action | File |
|--------|------|
| NEW | `tanstack-start-nestjs/frontend/src/components/rules/DecisionTableEditor.tsx.hbs` |
| NEW | `tanstack-start-nestjs/frontend/src/components/rules/RuleForm.tsx.hbs` |
| NEW | `tanstack-start-nestjs/frontend/src/routes/admin/rules/index.tsx.hbs` |
| NEW | `tanstack-start-nestjs/frontend/src/routes/admin/rules/new.tsx.hbs` |
| NEW | `tanstack-start-nestjs/frontend/src/routes/admin/rules/$id.edit.tsx.hbs` |
| MODIFY | `tanstack-start-nestjs/backend/src/trigger/entity-lifecycle-workflow.task.ts.hbs` |
| NEW | `common/migrations/add-doc-status.migration.ts.hbs` |
