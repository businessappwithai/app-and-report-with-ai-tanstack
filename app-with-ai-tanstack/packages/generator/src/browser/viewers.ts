/**
 * The model reader, as it runs in a browser.
 *
 * Bundled to `website/viewers/eml-model.js` by `scripts/build-viewers.ts` and
 * imported by the viewer page, so a model drawn on the site is read by exactly
 * the code that would generate it. This is the same arrangement — and the same
 * reason — as `browser/index.ts`, which bundles the generator itself; it is a
 * separate entry only so a reader who wants a picture does not download the
 * whole application assembler to get one.
 *
 * The checker travels with it, re-exported from `language/browser/checker.entry.ts`
 * rather than re-reported here. A viewer that renders a document happily while
 * `checker.js` refuses it teaches the author the wrong thing; re-exporting the
 * published entry is what makes the two verdicts the same sentence rather than
 * two sentences that ought to agree.
 */

import languageDefinition from "../../../../language/appwithai-language.json";
import { setLanguageDefinition } from "../parsers/language-maps";

// The parser resolves the language definition off disk, which a browser has
// none of. The checker entry injects it for its own half.
setLanguageDefinition(languageDefinition);

import {
  AUTO_FIXABLE,
  type CheckedIssue,
  type CheckReport,
  check,
  formatIssue,
  formatReport,
  LANGUAGE_VERSION,
} from "../../../../language/browser/checker.entry";
import { readModel, type ViewModel } from "../viewers";

export type {
  RuleNodeRole,
  ViewEntity,
  ViewFlowEdge,
  ViewFlowNode,
  ViewMeta,
  ViewModel,
  ViewRule,
  ViewSaga,
  ViewSagaStep,
  ViewStateMachine,
} from "../viewers";
export type { CheckedIssue, CheckReport };
export { AUTO_FIXABLE, check, formatIssue, formatReport, LANGUAGE_VERSION, readModel };

/**
 * Read and check in one pass — what the page needs on every keystroke.
 *
 * One call rather than two because the two answers are always shown together:
 * a picture of a document beside the verdict on it. Separating them invites a
 * caller to draw one without the other.
 */
export function inspectModel(source: string): { model: ViewModel; report: CheckReport } {
  return { model: readModel(source), report: check(source) };
}
