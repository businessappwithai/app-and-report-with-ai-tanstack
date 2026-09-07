/**
 * Feature flags for gradual rollout of WASM-centric architecture.
 * Controlled via NEXT_PUBLIC_* environment variables.
 */

export interface FeatureFlags {
  /** Enable DuckDB-Wasm (client-side query execution) */
  wasmEnabled: boolean;
  /** Enable Apache ECharts (canvas-based charts) */
  echartsEnabled: boolean;
  /** Enable cross-widget filtering on dashboards */
  crossFilterEnabled: boolean;
  /** Enable offline mode with IndexedDB caching */
  offlineEnabled: boolean;
  /** Enable progressive loading for large datasets */
  progressiveEnabled: boolean;
}

export const featureFlags: FeatureFlags = {
  wasmEnabled: process.env.NEXT_PUBLIC_WASM_ENABLED === "true",
  echartsEnabled: process.env.NEXT_PUBLIC_ECHARTS_ENABLED === "true",
  crossFilterEnabled: process.env.NEXT_PUBLIC_CROSSFILTER_ENABLED === "true",
  offlineEnabled: process.env.NEXT_PUBLIC_OFFLINE_ENABLED === "true",
  progressiveEnabled: process.env.NEXT_PUBLIC_PROGRESSIVE_ENABLED === "true",
};

/**
 * Check if a specific feature flag is enabled.
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return featureFlags[flag];
}
