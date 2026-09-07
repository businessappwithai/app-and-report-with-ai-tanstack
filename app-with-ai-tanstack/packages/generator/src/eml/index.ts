/**
 * EML composition, re-exported from the canonical definition in `language/`.
 *
 * The language folder is the source of truth for what an EML document looks
 * like; this re-export is what makes it reachable from the generator package —
 * and therefore from the web app, which imports the built generator.
 */
export * from "../../../../language/composer";
