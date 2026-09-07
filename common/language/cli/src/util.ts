/** Small, dependency-free string/naming helpers shared across the CLI. */

export function toSnakeCase(str: string): string {
  if (/^[A-Z0-9_]+$/.test(str)) return str.toLowerCase();
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])/g, (m, _c, offset) => (offset === 0 ? m : m))
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toLowerCase()
    .replace(/^_/, "");
}

export function pascalCase(str: string): string {
  return str
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

export function camelCase(str: string): string {
  const p = pascalCase(str);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

export function kebabCase(str: string): string {
  return toSnakeCase(str).replace(/_/g, "-");
}

/** Naive English pluralization sufficient for route/collection names. */
export function plural(word: string): string {
  if (/[^aeiou]y$/i.test(word)) return word.replace(/y$/i, "ies");
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  return `${word}s`;
}

export function foreignKeyName(targetEntity: string): string {
  const snake = toSnakeCase(targetEntity).replace(/^bus_/, "");
  return `${snake}_id`;
}

export function stripQuotes(str: string): string {
  return str.replace(/^["']|["']$/g, "").trim();
}

/**
 * The capture groups of a match that has already succeeded.
 *
 * `noUncheckedIndexedAccess` types every element of a `RegExpMatchArray` as
 * `string | undefined`, which is right in general and unhelpful here: a regex
 * that matched has every one of its non-optional groups. Narrowing at each call
 * site would add dozens of guards that can never fire and would bury the checks
 * that can, so the assertion is made once, here, where it is visible.
 *
 * An optional group that did not participate comes back as `""` rather than
 * `undefined`. Both are falsy, and every caller tests the value rather than
 * distinguishing "absent" from "empty".
 */
export function caps(match: RegExpMatchArray, count: 1): [string];
export function caps(match: RegExpMatchArray, count: 2): [string, string];
export function caps(match: RegExpMatchArray, count: 3): [string, string, string];
export function caps(match: RegExpMatchArray, count: 4): [string, string, string, string];
export function caps(match: RegExpMatchArray, count: 5): [string, string, string, string, string];
export function caps(
  match: RegExpMatchArray,
  count: 6
): [string, string, string, string, string, string];
export function caps(match: RegExpMatchArray, count: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= count; i += 1) out.push(match[i] ?? "");
  return out;
}

/**
 * The first word of a string, and everything after it.
 *
 * Directive bodies are all "keyword, then the rest", and splitting them by hand
 * meant indexing a split array — which is exactly where the undefined creeps
 * back in.
 */
export function splitHead(text: string): { head: string; rest: string } {
  const trimmed = text.trim();
  const at = trimmed.search(/\s/);
  if (at < 0) return { head: trimmed, rest: "" };
  return { head: trimmed.slice(0, at), rest: trimmed.slice(at).trim() };
}
