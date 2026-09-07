/**
 * The reading the viewers draw from.
 *
 * Kept as its own subdirectory rather than folded into `pipeline/` because it
 * is a second consumer of the pipeline's reading, not part of it: nothing here
 * is on the path to a generated application, and nothing in the pipeline may
 * come to depend on it.
 */
export * from "./view-model";
