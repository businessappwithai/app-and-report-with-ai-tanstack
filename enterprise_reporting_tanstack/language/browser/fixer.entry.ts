/**
 * The EML fixer, as one file a web page can load.
 *
 * The companion to `checker.entry.ts`, and the same argument: `language/fixer.ts`
 * is a command that reads a `.mmd.error` report, rewrites the `.mmd` beside it
 * and re-runs the checker in a subprocess. The repair itself is `applyFixes` —
 * a string and a list of diagnostics in, a repaired string out.
 *
 * What this adds beyond re-exporting it is `checkAndFix`: the loop between the
 * two, which every caller wants and which is easy to get subtly wrong. Repair,
 * then **check again** — a fix can uncover a problem the original error was
 * masking, so subtracting the repaired codes from the first report would be
 * describing a document that no longer exists. `packages/generator/src/pipeline/
 * review-model.ts` makes the same loop for the generator; this is that loop for
 * a browser, over the same two functions.
 *
 * It repairs five codes and no more. Everything else needs a person or a model
 * to decide what was meant, which is why `checkAndFix` reports what it could not
 * touch rather than guessing.
 */

import {
  AUTO_FIXABLE_CODES,
  type Issue as CheckerIssue,
  type CheckResult,
  checkSource,
} from "../checker";
import languageDefinition from "../erdwithai-language.json";
import { applyFixes, type FixResult } from "../fixer";
import { type LanguageDefinition, setLanguageDefinition } from "../index";

setLanguageDefinition(languageDefinition as unknown as LanguageDefinition);

export type { CheckerIssue as Issue, FixResult };

/** The EML version these repairs are written against. */
export const LANGUAGE_VERSION: string = languageDefinition.language.version;

/** The codes this file knows how to repair. Anything else is returned untouched. */
export const AUTO_FIXABLE: string[] = [...AUTO_FIXABLE_CODES].sort();

/** One diagnostic, with the flag `fix` reads. */
export interface CheckedIssue extends CheckerIssue {
  autoFixable: boolean;
}

/** What a check-repair-recheck round reports. */
export interface FixReport {
  /** The document as it should now be used — repaired, if anything was. */
  source: string;
  /** Whether `source` differs from what was passed in. */
  repaired: boolean;
  /** No errors remain after the repair. */
  ok: boolean;
  counts: { errors: number; warnings: number; infos: number };
  /** What was applied, in the order it was applied. */
  fixes: FixResult[];
  /** What is still wrong, worst first — nothing here can be auto-repaired. */
  remaining: CheckedIssue[];
  languageVersion: string;
}

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 } as const;

function mark(result: CheckResult): CheckedIssue[] {
  return [...result.issues]
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (a.line ?? 0) - (b.line ?? 0)
    )
    .map((issue) => ({ ...issue, autoFixable: AUTO_FIXABLE_CODES.has(issue.code) }));
}

/**
 * Apply the repairs a set of diagnostics asks for.
 *
 * Takes the issues rather than re-deriving them so a caller who has already
 * checked does not pay for a second parse, and so a caller can repair a chosen
 * subset. Issues that are not auto-fixable are ignored, not attempted.
 */
export function fix(
  source: string,
  issues: CheckerIssue[]
): { source: string; fixes: FixResult[] } {
  const fixable = issues
    .filter((issue) => AUTO_FIXABLE_CODES.has(issue.code))
    .map((issue) => ({ ...issue, autoFixable: true }));
  if (fixable.length === 0) return { source, fixes: [] };
  const { newSource, results } = applyFixes(source, fixable);
  return { source: newSource, fixes: results };
}

/**
 * Check, repair what is repairable, and check the repaired document again.
 *
 * The one call worth making if you do not want to think about the order. What
 * comes back is a document and the truth about that same document — not the
 * findings from before the repair.
 */
export function checkAndFix(source: string): FixReport {
  const first = checkSource(source);
  const { source: repairedSource, fixes } = fix(source, first.issues);
  const applied = fixes.some((result) => result.applied);

  const finalSource = applied ? repairedSource : source;
  const final = applied ? checkSource(finalSource) : first;

  return {
    source: finalSource,
    repaired: applied,
    ok: final.errors === 0,
    counts: { errors: final.errors, warnings: final.warnings, infos: final.infos },
    fixes,
    remaining: mark(final),
    languageVersion: LANGUAGE_VERSION,
  };
}

export { applyFixes };

// As in checker.entry.ts — reachable without a bound import.
(globalThis as Record<string, unknown>).EMLFixer = {
  fix,
  checkAndFix,
  applyFixes,
  AUTO_FIXABLE,
  LANGUAGE_VERSION,
};
