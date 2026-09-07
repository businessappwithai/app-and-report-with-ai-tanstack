import type { Hook, HookLifecycle } from "../types/hook.types";

export class HookRegistry {
  private hooks: Map<string, Hook[]> = new Map();

  register(entityName: string, hook: Hook): void {
    const key = `${entityName}:${hook.lifecycle}`;
    if (!this.hooks.has(key)) {
      this.hooks.set(key, []);
    }
    // After the has/set above, the key is guaranteed to exist
    const hooks = this.hooks.get(key) as Hook[];
    hooks.push(hook);
    hooks.sort((a, b) => a.priority - b.priority);
  }

  getHooks(entityName: string, lifecycle: HookLifecycle): Hook[] {
    const key = `${entityName}:${lifecycle}`;
    return this.hooks.get(key) || [];
  }

  clear(entityName?: string): void {
    if (entityName) {
      const keysToDelete = Array.from(this.hooks.keys()).filter((key) =>
        key.startsWith(`${entityName}:`)
      );
      for (const key of keysToDelete) this.hooks.delete(key);
    } else {
      this.hooks.clear();
    }
  }
}

export const globalHookRegistry = new HookRegistry();
