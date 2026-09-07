/**
 * Execution mode selector — determines whether a query should run
 * client-side (DuckDB-Wasm) or server-side.
 */

import { isFeatureEnabled } from "@/lib/feature-flags";
import type { BrowserCapabilities, ExecutionMode } from "@/types/wasm";

/** Size thresholds (bytes). */
const CLIENT_MAX = 100 * 1024 * 1024; // 100 MB
const SERVER_FORCE = 500 * 1024 * 1024; // 500 MB

/**
 * Detect browser capabilities for WASM execution.
 */
export function detectCapabilities(): BrowserCapabilities {
  if (typeof window === "undefined") {
    return {
      wasmSupported: false,
      sharedArrayBuffer: false,
      indexedDB: false,
      sufficientMemory: false,
    };
  }

  return {
    wasmSupported: typeof WebAssembly === "object",
    sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    indexedDB: typeof indexedDB !== "undefined",
    sufficientMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory
      ? ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 0) >= 4
      : true, // Assume sufficient if API not available
  };
}

/**
 * Select execution mode based on feature flags, browser capabilities,
 * and estimated dataset size.
 */
export function selectExecutionMode(
  requestedMode: ExecutionMode,
  estimatedSizeBytes: number
): "client" | "server" {
  // Explicit override
  if (requestedMode === "server") return "server";

  // Feature flag check
  if (!isFeatureEnabled("wasmEnabled")) return "server";

  if (requestedMode === "client") {
    // Honour explicit client request if capabilities exist
    const caps = detectCapabilities();
    if (caps.wasmSupported) return "client";
    return "server";
  }

  // Auto mode
  const caps = detectCapabilities();
  if (!caps.wasmSupported || !caps.sharedArrayBuffer) return "server";

  if (estimatedSizeBytes > SERVER_FORCE) return "server";
  if (estimatedSizeBytes <= CLIENT_MAX) return "client";

  // Between thresholds — prefer client if enough memory
  return caps.sufficientMemory ? "client" : "server";
}
