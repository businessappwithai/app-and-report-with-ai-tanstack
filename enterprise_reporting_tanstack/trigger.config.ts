/**
 * Trigger.dev Configuration
 * Setup for background job processing with trigger.dev
 */

import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "enterprise-reporting",
  runtime: "node",
  logLevel: "log",
  triggerDirectories: ["./src/lib/jobs"],
  maxDuration: 3600,
});
