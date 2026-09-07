import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { type Kysely, sql } from "kysely";
import { InjectDatabase } from "../../database/database.service.decorator";

export type WorkflowDefinitionDto = {
  name: string;
  entityName: string;
  operation: "CREATE" | "UPDATE" | "DELETE" | "ALL";
  /** BPMN diagrams carry XML; automations carry mermaid. Exactly one is required. */
  bpmnXml?: string;
  /** Mermaid with `%%` directives, as the automation builder writes it. */
  mermaid?: string;
  /** "bpmn" or "automation". Defaults to bpmn, which is what every older row is. */
  kind?: "bpmn" | "automation";
  description?: string;
  isActive?: boolean;
  /**
   * How the definition is reached.
   *   automatic  run on every write matching entityName + operation
   *   rule       run only when a rule's trigger-workflow action names it
   * Defaults to automatic, which is what an unmarked definition has always done.
   */
  triggerType?: "automatic" | "rule";
};

/**
 * Content fields a model-owned definition will not accept through the API.
 *
 * `isActive` is deliberately absent: switching a workflow off is an operational
 * decision an admin should be able to take without editing the model. The next
 * generation turns it back on, which is the honest outcome — the model says it
 * should be running.
 */
const MODEL_OWNED_FIELDS = [
  "name",
  "entityName",
  "operation",
  "bpmnXml",
  "description",
  "triggerType",
] as const;

@Injectable()
export class WorkflowDefinitionsService {
  constructor(@InjectDatabase() private readonly db: Kysely<any>) {}

  /**
   * A page of definitions, newest first.
   *
   * Paged rather than unbounded: an app that has been running a while
   * accumulates definitions faster than anyone deletes them, and a list
   * endpoint that returns all of them eventually times out the page that
   * depends on it. 200 is the default because it fills the longest rail the
   * builder draws without a second request.
   */
  async findAll(filters?: {
    entityName?: string;
    operation?: string;
    isActive?: boolean;
    kind?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(Math.max(filters?.limit ?? 200, 1), 200);
    const offset = Math.max(filters?.offset ?? 0, 0);

    const where = <T extends { where: any }>(q: T): T => {
      let query: any = q;
      if (filters?.entityName) query = query.where("entity_name", "=", filters.entityName);
      if (filters?.operation) query = query.where("operation", "=", filters.operation);
      if (filters?.isActive !== undefined) query = query.where("is_active", "=", filters.isActive);
      if (filters?.kind) query = query.where("kind", "=", filters.kind);
      return query as T;
    };

    const items = await where(this.db.selectFrom("sys_workflow_definitions").selectAll())
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    const counted = await where(
      this.db
        .selectFrom("sys_workflow_definitions")
        .select((eb: any) => eb.fn.countAll().as("total"))
    ).executeTakeFirst();

    const total = Number((counted as { total?: number | string })?.total ?? items.length);
    return { items, total, limit, offset, hasMore: offset + items.length < total };
  }

  async findOne(id: string) {
    const def = await this.db
      .selectFrom("sys_workflow_definitions")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    if (!def) throw new NotFoundException(`Workflow definition ${id} not found`);
    return def;
  }

  async findActiveForEntity(entityName: string, operation: string) {
    // Match definitions stored under either the singular base name (e.g. 'account')
    // or the full bus_ table name (e.g. 'bus_account').
    const candidates = Array.from(new Set([entityName, `bus_${entityName}`])).map((n) =>
      n.toLowerCase()
    );
    return this.db
      .selectFrom("sys_workflow_definitions")
      .selectAll()
      .where((eb) => eb.or(candidates.map((c) => eb(sql<string>`lower(entity_name)`, "=", c))))
      .where((eb) =>
        eb.or([eb("operation", "=", operation.toUpperCase()), eb("operation", "=", "ALL")])
      )
      .where("is_active", "=", true)
      .orderBy("created_at", "asc")
      .execute();
  }

  async create(dto: WorkflowDefinitionDto, userId?: string) {
    // A definition is either a BPMN diagram or a mermaid automation. Demanding
    // BPMN of both is what stopped the automation builder saving anything.
    const kind = dto.kind ?? (dto.mermaid?.trim() ? "automation" : "bpmn");

    if (kind === "automation") {
      if (!dto.mermaid?.trim()) throw new BadRequestException("mermaid is required");
      if (!/^\s*(flowchart|graph)\b/m.test(dto.mermaid)) {
        throw new BadRequestException("An automation must be a mermaid flowchart");
      }
    } else {
      if (!dto.bpmnXml?.trim()) throw new BadRequestException("bpmnXml is required");
      if (!dto.bpmnXml.includes("<bpmn:")) throw new BadRequestException("Invalid BPMN XML");
    }

    const [result] = await this.db
      .insertInto("sys_workflow_definitions")
      .values({
        name: dto.name,
        entity_name: dto.entityName,
        operation: dto.operation ?? "ALL",
        bpmn_xml: dto.bpmnXml ?? null,
        mermaid_code: dto.mermaid ?? null,
        kind,
        description: dto.description ?? null,
        trigger_type: dto.triggerType ?? "automatic",
        // Anything created through the API was built in the app, so the model
        // seed leaves it alone.
        source: "designer",
        is_active: dto.isActive ?? true,
        created_by: userId ?? null,
      } as any)
      .returningAll()
      .execute();
    return result;
  }

  async update(id: string, dto: Partial<WorkflowDefinitionDto>) {
    const existing = await this.findOne(id);

    // A definition declared by a %%workflow section belongs to the model. The
    // next generation rewrites it, so accepting an edit here would look like it
    // worked and then quietly vanish.
    if ((existing as any).source === "model") {
      const attempted = MODEL_OWNED_FIELDS.filter((field) => dto[field] !== undefined);
      if (attempted.length > 0) {
        throw new BadRequestException(
          `"${(existing as any).name}" is declared in the model — edit the %%workflow section and regenerate. ` +
            `Rejected: ${attempted.join(", ")}.`,
        );
      }
    }

    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.entityName !== undefined) updates.entity_name = dto.entityName;
    if (dto.operation !== undefined) updates.operation = dto.operation;
    if (dto.bpmnXml !== undefined) updates.bpmn_xml = dto.bpmnXml;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.isActive !== undefined) updates.is_active = dto.isActive;
    if (dto.triggerType !== undefined) updates.trigger_type = dto.triggerType;

    const [result] = await this.db
      .updateTable("sys_workflow_definitions")
      .set(updates as any)
      .where("id", "=", id)
      .returningAll()
      .execute();
    return result;
  }

  async remove(id: string) {
    const existing = await this.findOne(id);
    if ((existing as any).source === "model") {
      throw new BadRequestException(
        `"${(existing as any).name}" is declared in the model — remove the %%workflow section and regenerate. ` +
          "Deactivate it instead if you need it off now.",
      );
    }
    await this.db.deleteFrom("sys_workflow_definitions").where("id", "=", id).execute();
    return { deleted: true };
  }
}
