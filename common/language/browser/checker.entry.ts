/**
 * The EML checker, as one file a web page can load.
 *
 * `language/checker.ts` is a Bun command: it reads a `.mmd` off disk, writes a
 * `.mmd.error` beside it and prints in colour. None of that is the checking.
 * The checking is `checkSource` — a string in, a list of diagnostics out — and
 * it has been exported for exactly this reason since the WASM generator needed
 * to refuse a broken model before compiling it.
 *
 * So this file adds no rules. It injects the language definition (a tab has no
 * `appwithai-language.json` to open, so the bundler inlines the same JSON the
 * CLI reads) and re-exports the pure half under names a caller who has never
 * seen this repository can guess. A model checked at appwithai.org/checker.js
 * gets the same diagnostics `bun language/checker.ts` prints, because it is the
 * same engine — the alternative, a second weaker checker written for the web,
 * is how a document comes to pass in one place and fail in the other.
 */

import languageDefinition from "../appwithai-language.json";
import {
  AUTO_FIXABLE_CODES,
  type CheckResult,
  checkSource,
  type Issue,
  type Severity,
} from "../checker";
import { type LanguageDefinition, setLanguageDefinition } from "../index";

setLanguageDefinition(languageDefinition as unknown as LanguageDefinition);

export type { CheckResult, Issue, Severity };

/** The EML version these diagnostics are written against. */
export const LANGUAGE_VERSION: string = languageDefinition.language.version;

/** The five codes `fixer.js` can repair without being told what to do. */
export const AUTO_FIXABLE: string[] = [...AUTO_FIXABLE_CODES].sort();

/** One diagnostic, with the flag the fixer reads. */
export interface CheckedIssue extends Issue {
  autoFixable: boolean;
}

/** What a check run reports. */
export interface CheckReport {
  /** No errors. Warnings and infos may remain — read `counts`. */
  ok: boolean;
  counts: { errors: number; warnings: number; infos: number };
  /** Worst first, then by line, so the first entry is the one to fix. */
  issues: CheckedIssue[];
  languageVersion: string;
}

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 } as const;

/**
 * Check an EML document.
 *
 * Sorted worst-first rather than in the order the engine happened to find them:
 * a caller repairing one issue at a time should be reading the error that stops
 * generation, not an info about a naming convention that happens to sit on an
 * earlier line.
 */
export function check(source: string): CheckReport {
  const result: CheckResult = checkSource(source);
  return {
    ok: result.errors === 0,
    counts: { errors: result.errors, warnings: result.warnings, infos: result.infos },
    issues: [...result.issues]
      .sort(
        (a, b) =>
          SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (a.line ?? 0) - (b.line ?? 0)
      )
      .map((issue) => ({ ...issue, autoFixable: AUTO_FIXABLE_CODES.has(issue.code) })),
    languageVersion: LANGUAGE_VERSION,
  };
}

/** One line per diagnostic, in the shape a log or a terminal wants. */
export function formatIssue(issue: Issue): string {
  const where = issue.line ? `:${issue.line}` : "";
  const hint = issue.hint ? `  — ${issue.hint}` : "";
  return `${issue.severity}${where} [${issue.code}] ${issue.message}${hint}`;
}

/**
 * The whole report as text, for pasting back to whoever wrote the model.
 *
 * The verdict goes **last**, after the diagnostics, the way a compiler or a
 * test runner reports: whoever reads this in a terminal reads the bottom of it,
 * and with the verdict on top the final line of a passing run was whichever
 * diagnostic happened to sort last. An `info` rendered that way — same shape as
 * an error, no verdict after it — reads as the reason the run failed, which is
 * the opposite of what it says.
 *
 * The counts name infos too. They were omitted, so a report could say
 * "0 errors, 0 warnings" and then print two notes underneath it, which invited
 * exactly the same misreading from the other end.
 */
export function formatReport(report: CheckReport): string {
  const { errors, warnings, infos } = report.counts;
  /* Plural properly rather than with "(s)": this line is the one sentence most
     readers of a report actually read, and `1 error(s)` reads like a machine
     apologising for not knowing its own arithmetic. */
  const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  const counted = [
    count(errors, "error"),
    count(warnings, "warning"),
    ...(infos > 0 ? [count(infos, "note")] : []),
  ].join(", ");

  /* A passing run that still printed something says so on the same line, so the
     notes above it cannot be mistaken for the outcome. */
  const advisory =
    report.ok && report.issues.length > 0
      ? " — notes and warnings are advisory; the generator accepts this model"
      : "";
  const verdict = report.ok
    ? `OK — ${counted} (EML ${report.languageVersion})${advisory}`
    : `FAILED — ${counted} (EML ${report.languageVersion})`;

  if (report.issues.length === 0) return verdict;
  return [...report.issues.map(formatIssue), "", verdict].join("\n");
}

export { checkSource };

// Also reachable without a bound import, so a page that loaded this with a
// bare `import "./checker.js"` can still call it.
(globalThis as Record<string, unknown>).EMLChecker = {
  check,
  checkSource,
  formatIssue,
  formatReport,
  AUTO_FIXABLE,
  LANGUAGE_VERSION,
};
