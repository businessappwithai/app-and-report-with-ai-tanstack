import type { EntityDefinition } from "../types/entity.types";
import { BaseService } from "./base.service";

export class EntityService extends BaseService<EntityDefinition> {
  protected entityName = "Entity";

  private entities: Map<string, EntityDefinition> = new Map();

  protected async performCreate(data: Partial<EntityDefinition>): Promise<EntityDefinition> {
    const entity = data as EntityDefinition;
    this.entities.set(entity.name, entity);
    return entity;
  }

  protected async performUpdate(
    id: string,
    data: Partial<EntityDefinition>
  ): Promise<EntityDefinition> {
    const existing = this.entities.get(id);
    const updated = { ...existing, ...data } as EntityDefinition;
    this.entities.set(id, updated);
    return updated;
  }

  protected async performDelete(id: string): Promise<void> {
    this.entities.delete(id);
  }
}
