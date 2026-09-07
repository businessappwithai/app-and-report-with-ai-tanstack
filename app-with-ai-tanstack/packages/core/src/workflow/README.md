# Workflow Module

Workflow automation module for APPWITHAI. Integrates with Trigger.dev for background job processing and entity lifecycle management.

## Features

- ✅ **Entity Lifecycle Workflows**: Automatic workflow triggering on CREATE/UPDATE/DELETE
- ✅ **Draft → Success/Error State Machine**: Clear workflow status tracking
- ✅ **BaseService Integration**: Works seamlessly with existing services
- ✅ **Non-blocking**: Workflow execution doesn't block API responses
- ✅ **Retry Support**: Failed workflows can be retried
- ✅ **Status Monitoring**: Track workflow execution status
- ✅ **Timeout Handling**: Automatic timeout for stuck workflows

## Installation

```bash
bun add @trigger.dev/sdk
```

## Quick Start

### 1. Initialize Workflow Service

```typescript
import { createWorkflowService } from "@appwithai/core/workflow";
import knex from "knex";

const db = knex({
  client: "pg",
  connection: process.env.DATABASE_URL,
});

const workflowService = createWorkflowService(db, {
  projectId: process.env.TRIGGER_PROJECT_ID!,
  apiKey: process.env.TRIGGER_SECRET_KEY!,
  apiUrl: process.env.TRIGGER_API_URL!,
  enabled: true,
  timeout: 300, // 5 minutes
});
```

### 2. Enable Workflows in Your Service

```typescript
import { BaseService } from "@appwithai/core/services";

export class PatientService extends BaseService<Patient> {
  protected entityName = "Patient";

  constructor(
    private db: Knex,
    workflowService: IWorkflowService
  ) {
    super();
    this.setWorkflowService(workflowService);
  }

  protected async performCreate(data: Partial<Patient>): Promise<Patient> {
    const [patient] = await this.db("bus_patient")
      .insert(data)
      .returning("*");
    return patient;
  }

  // ... other methods
}
```

### 3. Set User Context

```typescript
// In your controller/middleware
const patientService = new PatientService(db, workflowService);
patientService.setUser(userId);
```

## Workflow Lifecycle

### State Machine

```
NONE (default) → DRAFT (workflow running) → SUCCESS (completed)
                                      └→ ERROR (failed)
```

### Flow

1. **Entity Changed**: User creates/updates/deletes entity
2. **Draft Status**: Service sets `workflow_status = 'draft'`
3. **Workflow Triggered**: Background task queued
4. **Processing**: Workflow executes rules
5. **Completion**: Status set to `success` or `error`
6. **Mutations Applied**: Entity updated with rule results

## API Reference

### WorkflowService

| Method | Description |
|--------|-------------|
| `trigger(payload)` | Trigger workflow for entity |
| `getStatus(runId)` | Get workflow status |
| `retry(workflowRunId)` | Retry failed workflow |
| `setEntityStatus(entity, id, status)` | Set entity workflow status |
| `completeWorkflow(params)` | Mark workflow as complete |
| `getPendingWorkflows(limit)` | Get pending workflows |
| `getEntityWorkflows(entity, id, limit)` | Get workflows for entity |
| `timeoutStuckWorkflows(seconds)` | Timeout stuck workflows |

### TriggerWorkflowPayload

```typescript
interface TriggerWorkflowPayload {
  entityName: string;    // e.g., "Patient"
  entityId: string;      // Entity UUID
  operation: "CREATE" | "UPDATE" | "DELETE";
  userId?: string;       // User who triggered the change
  timestamp: string;     // ISO timestamp
  metadata?: Record<string, any>;
}
```

### WorkflowRunResult

```typescript
interface WorkflowRunResult {
  id: string;
  status: "none" | "draft" | "success" | "error";
  completedAt?: Date;
  error?: string;
  durationMs?: number;
  inputPayload?: any;
  outputPayload?: any;
  mutationsApplied?: any;
}
```

## Usage Examples

### Trigger Workflow Manually

```typescript
const runId = await workflowService.trigger({
  entityName: "Patient",
  entityId: "123e4567-e89b-12d3-a456-426614174000",
  operation: "CREATE",
  userId: "user-123",
  timestamp: new Date().toISOString(),
});

console.log("Workflow triggered:", runId);
```

### Check Workflow Status

```typescript
const result = await workflowService.getStatus(runId);

console.log("Status:", result.status);
console.log("Duration:", result.durationMs, "ms");

if (result.status === "success") {
  console.log("Mutations:", result.mutationsApplied);
} else if (result.status === "error") {
  console.log("Error:", result.error);
}
```

### Retry Failed Workflow

```typescript
const newRunId = await workflowService.retry(failedRunId);
console.log("Retried with new run:", newRunId);
```

### Monitor Entity Workflows

```typescript
const workflows = await workflowService.getEntityWorkflows(
  "Patient",
  patientId,
  10 // limit
);

workflows.forEach(run => {
  console.log(`Run ${run.id}: ${run.status} - ${run.created_at}`);
});
```

### Timeout Stuck Workflows

```typescript
// Background job to timeout workflows stuck > 5 minutes
const timedOut = await workflowService.timeoutStuckWorkflows(300);
console.log(`Timed out ${timedOut} workflows`);
```

## BaseService Integration

The BaseService class automatically triggers workflows when enabled:

```typescript
import { BaseService } from "@appwithai/core/services";

class MyService extends BaseService<MyEntity> {
  // CREATE → triggers CREATE workflow
  async create(data) {
    return super.create(data); // Workflow triggered automatically
  }

  // UPDATE → triggers UPDATE workflow
  async update(id, data) {
    return super.update(id, data); // Workflow triggered automatically
  }

  // DELETE → triggers DELETE workflow
  async delete(id) {
    return super.delete(id); // Workflow triggered automatically
  }
}
```

## Environment Variables

```bash
# Required
TRIGGER_PROJECT_ID=<project-id>
TRIGGER_SECRET_KEY=<secret-key>

# Optional
TRIGGER_API_URL=http://localhost:8888  # Default
ENABLE_WORKFLOW_ENGINE=true              # Enable/disable workflows
WORKFLOW_TIMEOUT=300                     # Timeout in seconds
```

## Database Schema

### sys_workflow_runs Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| trigger_run_id | VARCHAR(255) | Trigger.dev run ID |
| entity_name | VARCHAR(100) | Entity name |
| entity_id | UUID | Entity ID |
| operation | VARCHAR(20) | CREATE, UPDATE, DELETE |
| status | VARCHAR(20) | draft, success, error |
| input_payload | JSONB | Input data |
| output_payload | JSONB | Output data |
| mutations_applied | JSONB | Mutations applied |
| error_details | TEXT | Error message |
| duration_ms | INTEGER | Execution time |
| created_by | UUID | User who triggered |
| created_at | TIMESTAMPTZ | Created timestamp |
| completed_at | TIMESTAMPTZ | Completed timestamp |

## Testing

### Unit Tests

```typescript
import { WorkflowService } from "@appwithai/core/workflow";

describe("WorkflowService", () => {
  it("should trigger workflow", async () => {
    const runId = await workflowService.trigger({
      entityName: "Patient",
      entityId: "123",
      operation: "CREATE",
      timestamp: new Date().toISOString(),
    });

    expect(runId).toBeDefined();
  });

  it("should get workflow status", async () => {
    const result = await workflowService.getStatus(runId);
    expect(result.status).toBe("draft");
  });
});
```

### Integration Tests

```typescript
describe("Workflow Integration", () => {
  it("should trigger workflow on entity create", async () => {
    const patient = await patientService.create({
      first_name: "John",
      last_name: "Doe",
    });

    expect(patient.workflow_status).toBe("draft");

    // Wait for workflow
    await waitForWorkflow(patient.id, "success");

    const updated = await patientService.getById(patient.id);
    expect(updated.workflow_status).toBe("success");
  });
});
```

## Troubleshooting

### Common Issues

**Issue**: Workflows not triggering
- **Solution**: Check `enabled: true` in workflow options
- **Solution**: Verify workflowService is set on service

**Issue**: Workflows stuck in draft
- **Solution**: Check Trigger.dev is running
- **Solution**: Verify TRIGGER_SECRET_KEY is correct
- **Solution**: Run timeout job to clear stuck workflows

**Issue**: Entity workflow_status not updating
- **Solution**: Verify migrations have been run
- **Solution**: Check entity table has workflow_status column

## Best Practices

1. **Always set user context** before CRUD operations
2. **Use feature flags** to disable workflows in development
3. **Monitor workflow runs** regularly for errors
4. **Implement timeout jobs** for stuck workflows
5. **Log workflow errors** for debugging
6. **Test workflow failure scenarios** in development

## Performance Considerations

- **Non-blocking**: Workflows don't block API responses
- **Fire-and-forget**: Returns immediately after triggering
- **Async processing**: Rules evaluated in background
- **Database impact**: Additional writes for workflow tracking

## Security

- **User tracking**: All workflows track who triggered the change
- **Audit trail**: Complete history in sys_workflow_runs
- **Session validation**: User context validated from session
- **Permission checks**: Workflows respect RBAC permissions

## Contributing

When adding workflow features:

1. Update types in `workflow.types.ts`
2. Add method to `WorkflowService`
3. Update this README
4. Add unit tests
5. Test with real Trigger.dev instance

## License

MIT

---

**See Also**:
- [Trigger.dev Documentation](https://trigger.dev)
- [BaseService Documentation](../services/base.service.ts)
- [Auth Module](../auth/README.md)
