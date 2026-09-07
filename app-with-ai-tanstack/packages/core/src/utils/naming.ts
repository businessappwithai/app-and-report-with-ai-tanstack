/**
 * Whitespace is a word separator, not a character to keep.
 *
 * Only `-` and `_` used to split, so an entity whose display name has a space
 * — "Compound Alias" — produced `compound AliasData`, and the generated file
 * would not parse. Anything asking for PascalCase wants an identifier, and an
 * identifier can never contain a space.
 */
export function pascalCase(str: string): string {
  if (!str) return "";
  return str
    .replace(/[-_\s]+(\w)/g, (_, c) => c.toUpperCase())
    .replace(/[-_\s]+/g, "")
    .replace(/^(\w)/, (_, c) => c.toUpperCase());
}

export function camelCase(str: string): string {
  if (!str) return "";
  const pascal = pascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function snakeCase(str: string): string {
  if (!str) return "";
  // Acronyms are already snake_case once lowered. Without this guard every
  // letter gets its own underscore ("CAPA" -> "c_a_p_a"), which disagreed with
  // the table name the Mermaid parser derives for the same entity ("capa") and
  // produced foreign keys pointing at tables that were never created.
  if (/^[A-Z0-9_]+$/.test(str)) {
    return str.toLowerCase();
  }
  return (
    str
      .replace(/([A-Z])/g, "_$1")
      .replace(/[-\s]+/g, "_")
      .toLowerCase()
      // A boundary that is both a separator and a capital produced two
      // underscores, one from each rule: "Drug Discovery Live" came out as
      // "drug__discovery__live", which is what a generated project ended up
      // naming its database.
      .replace(/_{2,}/g, "_")
      .replace(/^_/, "")
  );
}

export function kebabCase(str: string): string {
  if (!str) return "";
  return str
    .replace(/\s+/g, "-") // Replace spaces with hyphen first
    .replace(/([a-z])([A-Z])/g, "$1-$2") // Insert hyphen before capitals that follow lowercase
    .toLowerCase()
    .replace(/[_]+/g, "-") // Replace underscores with hyphen
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-|^-|-$/g, ""); // Remove leading/trailing hyphens
}

export function plural(str: string): string {
  if (!str) return "";
  if (str.endsWith("y")) return `${str.slice(0, -1)}ies`;
  if (str.endsWith("s") || str.endsWith("x") || str.endsWith("ch")) return `${str}es`;
  return `${str}s`;
}

export function singular(str: string): string {
  if (!str) return "";
  if (str.endsWith("ies")) return `${str.slice(0, -3)}y`;
  if (str.endsWith("es")) return str.slice(0, -2);
  if (str.endsWith("s")) return str.slice(0, -1);
  return str;
}
