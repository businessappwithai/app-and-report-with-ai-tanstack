/**
 * Vite's ambient client types.
 *
 * `import.meta.env` is typed by `vite/client`, and this reference is the
 * standard way to bring it in. It was missing: the typing arrived only as a
 * side effect of one route file importing `@tanstack/start-api-routes`, whose
 * dependency chain reaches Vinxi and, through it, `vite/client`. That route was
 * the last user of a package the build replaces with a local shim, so
 * rewriting it to the convention every other route follows took
 * `import.meta.env` with it — on three files that had nothing to do with the
 * change. Declared on purpose here instead of inherited by accident.
 */

/// <reference types="vite/client" />
