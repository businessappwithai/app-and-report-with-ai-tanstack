import { globalHookExecutor } from "../hooks/hook-executor";
import type { IWorkflowService, TriggerWorkflowPayload } from "../workflow/workflow.types.js";

export abstract class BaseService<T> {
  protected abstract entityName: string;
  protected workflowService?: IWorkflowService;
  protected currentUserId?: string;

  async create(data: Partial<T>): Promise<T> {
    // Before hooks
    const processed = await globalHookExecutor.execute(this.entityName, "beforeCreate", data);

    // Perform DB operation
    const result = await this.performCreate(processed);

    // Trigger workflow (non-blocking)
    await this.triggerWorkflow("CREATE", (result as Record<string, unknown>).id as string);

    // After hooks
    await globalHookExecutor.execute(this.entityName, "afterCreate", result);

    return result;
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    // Before hooks
    const processed = await globalHookExecutor.execute(this.entityName, "beforeUpdate", data);

    // Perform DB operation
    const result = await this.performUpdate(id, processed);

    // Trigger workflow (non-blocking)
    await this.triggerWorkflow("UPDATE", id);

    // After hooks
    await globalHookExecutor.execute(this.entityName, "afterUpdate", result);

    return result;
  }

  async delete(id: string): Promise<void> {
    // Before hooks
    await globalHookExecutor.execute(this.entityName, "beforeDelete", { id });

    // Trigger workflow before delete (non-blocking)
    await this.triggerWorkflow("DELETE", id);

    // Perform DB operation
    await this.performDelete(id);

    // After hooks
    await globalHookExecutor.execute(this.entityName, "afterDelete", { id });
  }

  /**
   * Set current user context
   */
  setUser(userId: string): void {
    this.currentUserId = userId;
  }

  /**
   * Set workflow service
   */
  setWorkflowService(workflowService: IWorkflowService): void {
    this.workflowService = workflowService;
  }

  /**
   * Trigger workflow for entity operation
   */
  protected async triggerWorkflow(
    operation: "CREATE" | "UPDATE" | "DELETE",
    entityId: string
  ): Promise<void> {
    if (!this.workflowService) {
      // Workflow service not configured, skip
      return;
    }

    const payload: TriggerWorkflowPayload = {
      entityName: this.entityName,
      entityId,
      operation,
      userId: this.currentUserId,
      timestamp: new Date().toISOString(),
    };

    try {
      await this.workflowService.trigger(payload);
    } catch (error) {
      // Log error but don't block the operation
      console.error("Failed to trigger workflow:", error);
    }
  }

  protected abstract performCreate(data: Partial<T>): Promise<T>;
  protected abstract performUpdate(id: string, data: Partial<T>): Promise<T>;
  protected abstract performDelete(id: string): Promise<void>;
}
