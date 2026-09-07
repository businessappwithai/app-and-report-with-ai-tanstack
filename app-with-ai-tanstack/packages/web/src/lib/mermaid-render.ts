// EML → renderable Mermaid normalization.
//
// Kept in its own module (rather than in lib/mermaid.ts) because lib/mermaid.ts
// imports @appwithai/generator, which is Node-only and cannot be pulled into the
// browser bundle. This file has no imports, so client routes can use it freely.

// Keywords that open a new Mermaid diagram. An EML document (examples/*.eml.mmd)
// concatenates several of them — erDiagram, then flowchart rule sections, then
// stateDiagram workflows — into one file. Mermaid renders exactly one diagram
// per call, so the ERD section has to be isolated before rendering.
const DIAGRAM_OPENER =
  /^(erDiagram|flowchart|graph|stateDiagram(-v2)?|sequenceDiagram|classDiagram|journey|gantt|pie|mindmap|timeline|quadrantChart|requirementDiagram|gitGraph|C4Context)\b/;

// EML attribute modifiers that stock Mermaid's ER grammar does not accept.
// OPTIONAL / NULL have no Mermaid equivalent and are dropped; UNIQUE is an
// EML alias for UK. See language/appwithai-language.json → modifiers.map.
const EML_ONLY_MODIFIER = /\s+(OPTIONAL|NULL)\b/g;
const EML_UNIQUE_MODIFIER = /\bUNIQUE\b/g;

/**
 * Convert EML/Mermaid source into something `mermaid.render()` accepts.
 *
 * Handles the three ways an EML document diverges from stock Mermaid ERD:
 *   1. Leading `%%` banner comments and `%%enum` / `%%field` / `%%index` /
 *      `%%entity` directives, which Mermaid's ER parser rejects.
 *   2. Extra diagram sections after the ERD (rules, workflows).
 *   3. The OPTIONAL / NULL / UNIQUE attribute modifiers.
 *
 * Input that is already plain Mermaid passes through with only comment
 * stripping, so this is safe to call on every render.
 */
export function toRenderableMermaid(code: string): string {
  const lines = code.replace(/\r\n/g, "\n").split("\n");

  const start = lines.findIndex((line) => line.trim() === "erDiagram");
  if (start === -1) {
    // Not an ERD (flowchart, state diagram, ...) — leave it to Mermaid as-is.
    return code;
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (DIAGRAM_OPENER.test(lines[i]?.trim() ?? "")) {
      end = i;
      break;
    }
  }

  return lines
    .slice(start, end)
    .filter((line) => !line.trim().startsWith("%%"))
    .map((line) => line.replace(EML_ONLY_MODIFIER, "").replace(EML_UNIQUE_MODIFIER, "UK"))
    .join("\n")
    .trimEnd();
}
