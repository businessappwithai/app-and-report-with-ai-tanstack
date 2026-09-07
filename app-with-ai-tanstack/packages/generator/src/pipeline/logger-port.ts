/**
 * The pipeline's logging seam.
 *
 * The pipeline runs in two places with nothing in common underneath it: a Node
 * process, where logging means Pino writing JSON to stdout, and a browser tab,
 * where `build-fullstack-browser.ts` bundles this same code over a memory
 * filesystem and there is no stdout, no `node:os`, and no worker thread for a
 * transport to run in. Importing the real logger here would pull all of that
 * into the tab and the bundle would not build.
 *
 * So the pipeline depends on one method instead. `ChannelLogger` from
 * `@appwithai/core/logging` satisfies this structurally, so a Node caller passes
 * its channel logger and nothing needs adapting; the browser passes nothing and
 * gets `NO_LOG`. Event ids still come from `log-spec.json` — the spec is the
 * contract, this interface is only the wire.
 */

/** What the pipeline needs from a logger, and nothing more. */
export interface PipelineLogger {
  event(id: string, fields?: Record<string, unknown>): void;
}

/**
 * The default when no logger is injected.
 *
 * Silence rather than `console.log`: the browser bundle's callers render
 * progress in the page, and a pipeline that also wrote to the devtools console
 * would be duplicating that in a place nobody is reading.
 */
export const NO_LOG: PipelineLogger = {
  event() {
    /* intentionally silent — see above */
  },
};

/**
 * The logger a command-line run should use.
 *
 * A CLI's stdout is its report to the person watching it, and interleaving
 * newline-delimited JSON through a progress display makes both harder to read.
 * The server path (`/api/generate`) has no such reader and always logs.
 *
 * So a terminal run is silent unless the operator asks: setting `LOG_LEVEL`
 * (the same variable that controls everything else) opts in. That keeps one
 * switch for logging rather than a CLI flag that means the same thing.
 */
export function cliLogger<T extends PipelineLogger>(
  real: T,
  env: NodeJS.ProcessEnv = process.env
): PipelineLogger {
  return env.LOG_LEVEL ? real : NO_LOG;
}
