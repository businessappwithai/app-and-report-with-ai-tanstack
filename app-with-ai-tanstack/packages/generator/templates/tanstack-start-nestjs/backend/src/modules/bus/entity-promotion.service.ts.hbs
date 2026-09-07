/**
 * Entity Promotion Service — Draft → Final
 *
 * Every business entity is saved in `draft`. Promotion is the step that runs the
 * rules and workflows associated with that record and, only if all of them
 * succeed, marks it `final`.
 *
 * The contract:
 *   - nothing associated  → promoted to `final` immediately, no transaction needed
 *   - everything succeeds → side effects committed and the row marked `final`, atomically
 *   - anything fails      → every side effect rolled back, the row stays `draft`, and
 *                           `doc_status_message` explains what failed and why so the
 *                           user can fix it and retry
 *
 * The rollback boundary is deliberate. The entity row itself is committed by the
 * caller before promotion runs, so a failure never loses the user's data — it
 * leaves them a saved draft plus an explanation. Only the *derived* work (cascade
 * writes, workflow mutations, the status flip) is transactional.
 */

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import { InjectDatabase } from '../../database/database.service.decorator';
import { RulesService } from '../rules/rules.service';
import type { MatchedAction } from '../rules/rules.service';
import { WorkflowService } from '../workflow/workflow.service';

/**
 * `draft` and `final` are stored on the row. `deleted` never is — the row is
 * gone by the time it is reported, and it exists here so a caller can tell a
 * successful delete from a successful save.
 */
export type DocStatus = 'draft' | 'final' | 'deleted';

export interface PromotionResult {
  entityName: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  /** Where the record ended up. */
  docStatus: DocStatus;
  promoted: boolean;
  /** Human-readable summary — surfaced to the user verbatim when promotion fails. */
  message: string;
  /** What the pipeline found to run. Empty on both sides means the fast path was taken. */
  ranRules: string[];
  ranWorkflows: string[];
  /** Populated only on failure: the step that broke and the underlying error. */
  failedStep?: string;
  error?: string;
  durationMs: number;
}

@Injectable()
export class EntityPromotionService {
  private readonly logger = new Logger(EntityPromotionService.name);

  constructor(
    @InjectDatabase() private readonly db: Kysely<any>,
    @Inject(forwardRef(() => RulesService)) private readonly rulesService: RulesService,
    @Inject(forwardRef(() => WorkflowService)) private readonly workflowService: WorkflowService,
  ) {}

  /**
   * Run the promotion pipeline for one record.
   *
   * Never throws: a failure is a result the caller shows the user, not an
   * exception that loses the saved draft.
   */
  async promote(
    entityName: string,
    entityId: string,
    operation: 'create' | 'update' | 'delete',
    entityData: Record<string, unknown>,
  ): Promise<PromotionResult> {
    const startedAt = Date.now();
    const tableName = this.resolveTable(entityName);

    const base = {
      entityName: tableName,
      entityId,
      operation,
      ranRules: [] as string[],
      ranWorkflows: [] as string[],
    };

    // ── 1. What is associated with this record? ──────────────────────────────
    let actions: MatchedAction[] = [];
    let workflowNames: string[] = [];
    try {
      [actions, workflowNames] = await Promise.all([
        this.rulesService.collectActionableActions(tableName, entityData, operation),
        this.findWorkflowNames(tableName, operation),
      ]);
    } catch (err: any) {
      return this.fail(base, startedAt, 'discovering associated rules and workflows', err, entityData);
    }

    const ruleNames = [...new Set(actions.map((a) => a.ruleName))];

    // A workflow a matched rule triggers runs too, so name it alongside the
    // automatic ones rather than leaving the report short by exactly the
    // workflow the write was interesting enough to set off.
    workflowNames = [...new Set([...workflowNames, ...this.workflowNamesFromActions(actions)])];

    // A delete ends by removing the row rather than by stamping a status on it,
    // and the removal belongs in the same transaction as the workflows that run
    // first — those are what clear the record's children, so a cascade that
    // fails must leave the parent standing rather than orphan what it could not
    // reach.
    const isDelete = operation === 'delete';
    const finalise = async (db: Kysely<any>) => {
      if (isDelete) {
        await db.deleteFrom(tableName as any).where('id' as any, '=', entityId).execute();
      } else {
        await this.setDocStatus(db, tableName, entityId, 'final', null);
      }
    };
    const finaliseStep = isDelete ? 'deleting the record' : 'marking the record final';
    const finalisedMessage = isDelete ? 'Deleted' : 'Finalised';

    // ── 2. Nothing associated → finalise directly ────────────────────────────
    if (actions.length === 0 && workflowNames.length === 0) {
      try {
        await finalise(this.db);
      } catch (err: any) {
        return this.fail(base, startedAt, finaliseStep, err, entityData);
      }
      this.logger.log(
        `${isDelete ? 'Deleted' : 'Promoted'} ${tableName}:${entityId} (no associated rules or workflows)`,
      );
      return {
        ...base,
        docStatus: isDelete ? 'deleted' : 'final',
        promoted: true,
        message: isDelete
          ? 'No business rules or workflows are associated with this record, so it was deleted directly.'
          : 'No business rules or workflows are associated with this record, so it was finalised automatically.',
        durationMs: Date.now() - startedAt,
      };
    }

    // ── 3. Something associated → all-or-nothing ─────────────────────────────
    let failedStep = 'running the associated business rules';
    try {
      await this.db.transaction().execute(async (trx) => {
        if (actions.length > 0) {
          await this.rulesService.executeMatchedActions(tableName, entityId, entityData, operation, {
            db: trx,
            throwOnError: true,
          });
        }

        if (workflowNames.length > 0) {
          failedStep = 'running the associated workflows';
          await this.workflowService.runLocalWorkflows(tableName, entityId, operation, entityData, {}, {
            db: trx,
            throwOnError: true,
          });
        }

        failedStep = finaliseStep;
        await finalise(trx);
      });
    } catch (err: any) {
      return this.fail({ ...base, ranRules: ruleNames, ranWorkflows: workflowNames }, startedAt, failedStep, err, entityData);
    }

    const summary = [
      ruleNames.length ? `${ruleNames.length} rule action(s)` : null,
      workflowNames.length ? `${workflowNames.length} workflow(s)` : null,
    ]
      .filter(Boolean)
      .join(' and ');

    this.logger.log(
      `${isDelete ? 'Deleted' : 'Promoted to final'} ${tableName}:${entityId} after ${summary}`,
    );
    return {
      ...base,
      ranRules: ruleNames,
      ranWorkflows: workflowNames,
      docStatus: isDelete ? 'deleted' : 'final',
      promoted: true,
      message: `${finalisedMessage} after successfully running ${summary}.`,
      durationMs: Date.now() - startedAt,
    };
  }

  /**
   * The job runner itself failed, so the pipeline never ran. Treated exactly like
   * a pipeline failure from the user's point of view — the record stays draft with
   * an explanation — because the outcome is the same: not finalised, retry needed.
   */
  async recordDispatchFailure(
    entityName: string,
    entityId: string,
    operation: 'create' | 'update' | 'delete',
    error: string,
  ): Promise<PromotionResult> {
    return this.fail(
      {
        entityName: this.resolveTable(entityName),
        entityId,
        operation,
        ranRules: [],
        ranWorkflows: [],
      },
      Date.now(),
      'handing the promotion to the background job runner (Trigger.dev)',
      new Error(error),
      {},
    );
  }

  /**
   * Record the failure on the row itself so the user sees it next time they open
   * the record, not only in the response to the save that failed.
   *
   * This write is deliberately outside the rolled-back transaction.
   */
  private async fail(
    base: Pick<PromotionResult, 'entityName' | 'entityId' | 'operation' | 'ranRules' | 'ranWorkflows'>,
    startedAt: number,
    failedStep: string,
    err: any,
    entityData: Record<string, unknown>,
  ): Promise<PromotionResult> {
    const error = err?.message ?? String(err);
    const message = this.buildFailureMessage(base, failedStep, error);

    this.logger.error(`Promotion failed for ${base.entityName}:${base.entityId} — ${failedStep}: ${error}`);

    try {
      // A delete that rolled back leaves the record exactly as it was, status
      // included: it was never a draft, and demoting it would corrupt a
      // finalised record because someone tried to remove it.
      if (base.operation !== 'delete') {
        await this.setDocStatus(this.db, base.entityName, base.entityId, 'draft', message);
      }
    } catch (statusErr: any) {
      // The record keeps its existing draft status; the response still carries the detail.
      this.logger.error(
        `Could not record the failure on ${base.entityName}:${base.entityId}: ${statusErr?.message ?? statusErr}`,
      );
    }

    return {
      ...base,
      // A delete that failed left the row untouched, so report the status it
      // still has rather than claiming it was demoted to a draft.
      docStatus: base.operation === 'delete' ? 'final' : 'draft',
      promoted: false,
      message,
      failedStep,
      error,
      durationMs: Date.now() - startedAt,
    };
  }

  /**
   * The text the user actually reads. It has to answer three questions without
   * making them go digging in server logs: what stage broke, what the underlying
   * error was, and what happened to their data.
   */
  private buildFailureMessage(
    base: Pick<PromotionResult, 'entityName' | 'entityId' | 'operation' | 'ranRules' | 'ranWorkflows'>,
    failedStep: string,
    error: string,
  ): string {
    // A failed delete did not save a draft — nothing was saved at all. Saying
    // otherwise sends the reader looking for a draft that does not exist.
    const parts = [
      base.operation === 'delete'
        ? 'This record could not be deleted and is unchanged.'
        : 'This record could not be finalised and has been kept as a draft.',
    ];
    parts.push(`Failed while ${failedStep}: ${error}`);

    if (base.ranRules.length > 0) {
      parts.push(`Rules involved: ${base.ranRules.join(', ')}.`);
    }
    if (base.ranWorkflows.length > 0) {
      parts.push(`Workflows involved: ${base.ranWorkflows.join(', ')}.`);
    }

    parts.push(
      'No partial changes were kept — every change the rules and workflows made was rolled back. ' +
        'Fix the cause and retry, or correct the record and save again.',
    );
    return parts.join(' ');
  }

  /** Active workflow definitions for this entity + operation, by name. */
  /**
   * The workflows that will actually run for this write.
   *
   * Only `automatic` definitions, because that is the same filter
   * `runLocalWorkflows` applies. Without it this counted rule-triggered
   * workflows too and the result claimed them as run: creating a non-critical
   * deviation reported "successfully running 2 workflow(s)" when the escalation
   * had correctly declined to fire.
   *
   * A rule-triggered workflow that does fire is added by the caller from the
   * matched rule actions, so the report names what happened either way.
   */
  private async findWorkflowNames(
    tableName: string,
    operation: 'create' | 'update' | 'delete',
  ): Promise<string[]> {
    const normalized = tableName.toLowerCase().replace(/^bus_/, '');
    const candidates = [normalized, `bus_${normalized}`];

    const rows = await this.db
      .selectFrom('sys_workflow_definitions')
      .select(['name'])
      .where((eb: any) =>
        eb.or(candidates.map((c) => eb(sql<string>`lower(entity_name)`, '=', c))),
      )
      .where((eb: any) =>
        eb.or([eb('operation', '=', operation.toUpperCase()), eb('operation', '=', 'ALL')]),
      )
      .where('is_active', '=', true)
      .where('trigger_type', '=', 'automatic')
      .execute();

    return rows.map((r: any) => r.name as string);
  }

  /** Workflow names named by the `trigger-workflow` actions that matched. */
  private workflowNamesFromActions(actions: MatchedAction[]): string[] {
    return actions
      .filter((action) => action.type === 'trigger-workflow')
      .map((action) => String((action.config as any)?.workflowName ?? '').trim())
      .filter(Boolean);
  }

  private async setDocStatus(
    db: Kysely<any>,
    tableName: string,
    entityId: string,
    status: DocStatus,
    message: string | null,
  ): Promise<void> {
    await db
      .updateTable(tableName as any)
      .set({ doc_status: status, doc_status_message: message } as any)
      .where('id' as any, '=', entityId)
      .execute();
  }

  private resolveTable(entity: string): string {
    const normalized = entity.toLowerCase().replace(/-/g, '_');
    return normalized.startsWith('bus_') ? normalized : `bus_${normalized}`;
  }
}
