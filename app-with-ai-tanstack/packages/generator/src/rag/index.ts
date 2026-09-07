/**
 * EML retrieval chunking, re-exported from the canonical definition in `language/`.
 *
 * `language/` is the source of truth for what an EML document means, chunking
 * included; this re-export is what makes it reachable from the generator
 * package without a deep relative path at every call site.
 */

export * from "../../../../language/rag";
