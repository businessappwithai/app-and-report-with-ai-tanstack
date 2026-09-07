/**
 * Check a model before compiling it, and repair what can be repaired.
 *
 * The generator is forgiving by design: a rule it cannot read becomes an
 * `assumed` decision, an entity with no primary key gets one, a missing FK is
 * inferred. That is right for generation and wrong as the *only* thing a person
 * hears, because the result is an application that runs and quietly does not
 * mean what the model said. `language/checker.ts` already knows the difference —
 * it just lived behind a CLI that read files and printed colour.
 *
 * So this is the checker and the fixer, run over a string. Nothing here
 * re-implements a rule: `checkSource` is the same engine `bun language/checker.ts`
 * runs, and `applyFixes` is the same repair `bun language/fixer.ts` applies. What
 * this adds is the loop between them — fix, then check again, so that what is
 * reported is what survived the repair rather than what was wrong before it.
 *
 * Both callers need it and neither can use the CLI: `appwithai-wasm` is a
 * different command, and the upload page is a browser tab with no processes to
 * spawn and no files to write.
 */

import {
  AUTO_FIXABLE_CODES,
  type CheckResult,
  checkSource,
  type Issue,
} from "../../../../language/checker";
import { applyFixes, type FixResult } from "../../../../language/fixer";

export type { FixResult, Issue };

export interface ModelReview {
  /** The model as it should now be compiled — repaired, if anything was. */
  source: string;
  /** No errors remain. Warnings and infos may. */
  ok: boolean;
  /** Whether the source differs from what was passed in. */
  repaired: boolean;
  /** What the fixer applied, in the order it applied them. */
  fixes: FixResult[];
  /** What is still wrong, worst first. */
  issues: Issue[];
  counts: { errors: number; warnings: number; infos: number };
}

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 } as const;

/** The checker's own result, in the shape the caller reports. */
function summarize(source: string, result: CheckResult, fixes: FixResult[]): ModelReview {
  return {
    source,
    ok: result.errors === 0,
    repaired: fixes.some((fix) => fix.applied),
    fixes,
    issues: [...result.issues].sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (a.line ?? 0) - (b.line ?? 0)
    ),
    counts: { errors: result.errors, warnings: result.warnings, infos: result.infos },
  };
}

/**
 * Check a model, optionally repairing the five things the fixer can repair.
 *
 * `autoFix` defaults to on. The alternative — report the missing document name
 * and stop — is a worse trade for a generator: those five codes have exactly one
 * correct repair each, and a person who uploaded a file to watch it run is not
 * helped by being sent back to a text editor to add `%%meta name:`.
 *
 * What is repaired is always reported, never silent. Anything the fixer cannot
 * repair is returned as it stands.
 */
export function reviewModel(source: string, options: { autoFix?: boolean } = {}): ModelReview {
  const first = checkSource(source);

  if (options.autoFix === false) return summarize(source, first, []);

  const fixable = first.issues
    .filter((issue) => AUTO_FIXABLE_CODES.has(issue.code))
    .map((issue) => ({ ...issue, autoFixable: true }));

  if (fixable.length === 0) return summarize(source, first, []);

  const { newSource, results } = applyFixes(source, fixable);
  if (!results.some((result) => result.applied)) return summarize(source, first, results);

  // Re-check rather than subtract the fixed codes from the first result: a
  // repair can reveal a problem the original error was masking, and reporting
  // the stale list would be reporting a document that no longer exists.
  return summarize(newSource, checkSource(newSource), results);
}

/** One line per issue, in the shape a terminal or a log wants. */
export function formatIssue(issue: Issue): string {
  const where = issue.line ? `:${issue.line}` : "";
  return `${issue.severity}${where} [${issue.code}] ${issue.message}`;
}
