/**
 * Naming, kept identical to @appwithai/core/utils.
 *
 * Duplicated rather than imported because this file is copied verbatim into a
 * generated application and shipped to a browser: an `@appwithai/*` import
 * would not survive the trip. The parity test in the generator package asserts
 * these agree with core's, so a divergence fails the build rather than
 * producing an app whose URLs disagree with its own dictionary.
 */

export const snakeCase = (value = "") =>
  String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();

export const kebabCase = (value = "") => snakeCase(value).replace(/_/g, "-");

/**
 * Ported character for character from core, separators and all.
 *
 * Deriving it from `snakeCase` instead looks equivalent and is not: it lowers
 * an acronym on the way through, so `CAPA` came back as `Capa` while core
 * returned `CAPA`. The parity test caught it; a generated application would
 * have caught it as an entity that could not be found by its own name.
 */
export const pascalCase = (value = "") => {
  if (!value) return "";
  return String(value)
    .replace(/[-_\s]+(\w)/g, (_, character) => character.toUpperCase())
    .replace(/[-_\s]+/g, "")
    .replace(/^(\w)/, (_, character) => character.toUpperCase());
};

export const camelCase = (value = "") => {
  const pascal = pascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

/** For labels. An all-caps name is left alone: `CAPA`, not `Capa`. */
export const titleCase = (value = "") =>
  /^[A-Z0-9_]+$/.test(value)
    ? String(value).replace(/_/g, " ")
    : snakeCase(value)
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

/** `bus_sales_order` / `SalesOrder` / `sales-order` all resolve to `bus_sales_order`. */
export function toTableName(entity) {
  const snake = snakeCase(entity);
  return snake.startsWith("bus_") || snake.startsWith("sys_") ? snake : `bus_${snake}`;
}

/** The URL segment an entity is reached by: `SalesOrder` -> `sales-order`. */
export function toRouteName(entity) {
  return kebabCase(String(entity).replace(/^bus_/, ""));
}
