/**
 * Worker Runner
 *
 * Initialises background job processing.  Two backends are supported:
 *
 *   1. Trigger.dev (self-hosted) — used when TRIGGER_API_URL is set.
 *      Task definitions are registered and the platform manages scheduling.
 *
 *   2. On-premise cron runner (built-in fallback) — activated automatically
 *      when TRIGGER_API_URL is not set.  A pure-Bun interval loop polls
 *      monitoring_rules every minute and executes due rules in-process.
 */

import {
  reportGenerationTask,
  dataExportTask,
  emailBatchTask,
  scheduledRefreshTask,
} from "./trigger-tasks";
import {
  startOnPremiseCronRunner,
  stopOnPremiseCronRunner,
} from "@/lib/monitoring/monitoring-scheduler";

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "5", 10);

function isTriggerDevConfigured(): boolean {
  return Boolean(process.env.TRIGGER_API_URL?.trim());
}

export async function initializeWorkers(): Promise<void> {
  console.log("✓ Trigger.dev task definitions loaded");
  console.log(`  - reportGenerationTask (concurrency: ${WORKER_CONCURRENCY})`);
  console.log(`  - dataExportTask (concurrency: ${WORKER_CONCURRENCY})`);
  console.log(`  - emailBatchTask (concurrency: ${WORKER_CONCURRENCY})`);
  console.log(`  - scheduledRefreshTask (concurrency: ${WORKER_CONCURRENCY})`);

  if (isTriggerDevConfigured()) {
    console.log("");
    console.log("Jobs are now being processed by Trigger.dev (self-hosted):");
    console.log(`  - TRIGGER_API_URL: ${process.env.TRIGGER_API_URL}`);
    console.log("  - Configure retries and timeouts in trigger.config.ts");
  } else {
    console.log("");
    console.log("TRIGGER_API_URL not set — starting on-premise cron runner as fallback.");
    startOnPremiseCronRunner();
  }
}

export async function shutdownWorkers(): Promise<void> {
  console.log("Shutting down workers...");
  stopOnPremiseCronRunner();
  console.log("✓ Workers stopped");
}

export async function checkWorkerHealth(): Promise<{ healthy: boolean; message: string }> {
  if (isTriggerDevConfigured()) {
    return {
      healthy: true,
      message: `Trigger.dev workers active (self-hosted: ${process.env.TRIGGER_API_URL})`,
    };
  }
  return {
    healthy: true,
    message: "On-premise cron runner active (poll interval: 60s)",
  };
}

export {
  reportGenerationTask,
  dataExportTask,
  emailBatchTask,
  scheduledRefreshTask,
};
