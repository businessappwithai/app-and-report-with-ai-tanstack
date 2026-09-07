import type { HookContext, HookLifecycle } from "../types/hook.types";
import { globalHookRegistry } from "./hook-registry";

export class HookExecutor {
  async execute<T>(
    entityName: string,
    lifecycle: HookLifecycle,
    data: T,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const hooks = globalHookRegistry.getHooks(entityName, lifecycle);

    let result = data;
    const context: HookContext<T> = {
      entity: entityName,
      lifecycle,
      data: result,
      metadata,
    };

    for (const hook of hooks) {
      const hookResult = await hook.execute(context);
      if (hookResult !== undefined) {
        result = hookResult;
        context.data = result;
      }
    }

    return result;
  }
}

export const globalHookExecutor = new HookExecutor();
