/**
 * The error a browser entry point throws for a model the checker refused.
 *
 * It lives in a module of its own rather than beside `generateFromSource`
 * because both browser bundles need it and only one of them wants the rest of
 * that file. `full-stack.ts` used to import it from `./index`, which reached
 * `wasm-app.generator.ts` and through it the sample-data generator and the whole
 * of faker's locale — 450KB of vocabulary in a bundle that assembles NestJS
 * source and seeds nothing. An error class shared by two entry points belongs to
 * neither of them.
 */

import type { Issue, ModelReview } from "../pipeline/review-model";

/**
 * A model the checker refused.
 *
 * Thrown rather than returned so no caller can generate from it by forgetting to
 * look, and typed rather than a message string so the page can render each
 * finding with its line, code and hint instead of printing one flattened line.
 */
export class ModelCheckError extends Error {
  readonly issues: Issue[];
  readonly review: ModelReview;

  constructor(review: ModelReview) {
    const errors = review.counts.errors;
    super(`This model has ${errors} error${errors === 1 ? "" : "s"}.`);
    this.name = "ModelCheckError";
    this.issues = review.issues;
    this.review = review;
  }
}
