/**
 * Promotion Dispatcher
 *
 * Decides *how* the promotion pipeline runs. The pipeline itself lives in
 * EntityPromotionService and is identical either way:
 *
 *   - Trigger.dev configured  → hand the work to the `entity-promotion` task and
 *                               wait for its result, so promotion survives an API
 *                               restart and gets Trigger.dev's retry policy
 *   - not configured          → run it inline, in-process
 *
 * The fallback is not a stub. A generated app has to work the moment it is
 * created, before anyone has signed up for Trigger.dev, and the promotion
 * contract (draft → rules+workflows in a transaction → final, or draft plus an
 * explanation) must hold in both modes.
 */

import { Injectable, Logger } from '@nestjs/common';
import { EntityPromotionService } from './entity-promotion.service';
import type { PromotionResult } from './entity-promotion.service';

/** Trigger.dev only dispatches when it has somewhere to dispatch to. */
export function isTriggerDevConfigured(): boolean {
  return Boolean(process.env.TRIGGER_SECRET_KEY && process.env.TRIGGER_PROJECT_ID);
}

@Injectable()
export class PromotionDispatcher {
  private readonly logger = new Logger(PromotionDispatcher.name);

  constructor(private readonly promotionService: EntityPromotionService) {}

  async dispatch(
    entityName: string,
    entityId: string,
    operation: 'create' | 'update' | 'delete',
    entityData: Record<string, unknown>,
  ): Promise<PromotionResult> {
    if (!isTriggerDevConfigured()) {
      return this.promotionService.promote(entityName, entityId, operation, entityData);
    }

    try {
      // Imported lazily so an app without Trigger.dev credentials never loads the SDK.
      const { tasks } = await import('@trigger.dev/sdk/v3');
      const handle = await tasks.triggerAndPoll<any>('entity-promotion', {
        entityName,
        entityId,
        operation,
        entityData,
      });

      if (handle?.output) return handle.output as PromotionResult;

      throw new Error(
        `Trigger.dev run ${handle?.id ?? '(unknown)'} finished with status ` +
          `${handle?.status ?? 'unknown'} and returned no result`,
      );
    } catch (err: any) {
      // Falling back would hide a broken Trigger.dev deployment behind green saves,
      // so surface it as a promotion failure: the record stays draft and the user
      // is told the job runner is the problem, not their data.
      this.logger.error(`Trigger.dev dispatch failed for ${entityName}:${entityId}: ${err?.message ?? err}`);
      return this.promotionService.recordDispatchFailure(
        entityName,
        entityId,
        operation,
        err?.message ?? String(err),
      );
    }
  }
}
