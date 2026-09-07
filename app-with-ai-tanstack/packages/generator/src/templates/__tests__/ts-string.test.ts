/**
 * A model's words end up inside generated TypeScript, and they broke it.
 *
 * Templates compile with `noEscape: true` — they render code, not HTML — so
 * every `{{...}}` lands raw. The moment the CRM example gained the help text
 * "the opportunity's amount", `seeds/02_sys_dictionary.ts` had an unterminated
 * string literal and the generated application would not compile. The defect
 * had been there since the template was written; no example model had ever
 * contained an apostrophe.
 *
 * `tsString` is the fix, and this pins both halves of it: the helper escapes,
 * and the templates that carry model text actually call it. The second half
 * matters more — a correct helper nobody uses is what we had.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import Handlebars from "handlebars";
import { describe, expect, it } from "vitest";
import { TemplateLoader } from "../loader";

const TEMPLATES = join(import.meta.dirname, "../../../templates");

// Constructing one registers the helpers on the shared Handlebars instance.
new TemplateLoader(TEMPLATES);

function render(source: string, context: Record<string, unknown>): string {
  return Handlebars.compile(source, { noEscape: true })(context);
}

describe("tsString", () => {
  it("closes the literal it opens, whatever the text does", () => {
    const awkward = 'the opportunity\'s amount — a \\ and a "quote"';
    const rendered = render("const x = {{tsString value}};", { value: awkward });

    // The proof is that it evaluates back to the original, not that it looks a
    // particular way: JSON.stringify may legitimately choose either quote.
    expect(new Function(`${rendered} return x;`)()).toBe(awkward);
  });

  it("folds a newline rather than emitting one", () => {
    const rendered = render("const x = {{tsString value}};", { value: "one\ntwo" });
    expect(rendered).not.toContain("\n");
    expect(new Function(`${rendered} return x;`)()).toBe("one two");
  });

  it("renders an empty literal for a missing value", () => {
    expect(new Function(`return ${render("{{tsString value}}", {})};`)()).toBe("");
  });
});

describe("the seed templates that carry a model's own words", () => {
  const cases: Array<[string, string]> = [
    ["common/seeds/sys-dictionary.ts.hbs", "description"],
    ["common/seeds/entity-categories.ts.hbs", "description"],
  ];

  for (const [file, field] of cases) {
    it(`${file} quotes ${field} through tsString`, () => {
      const source = readFileSync(join(TEMPLATES, file), "utf-8");
      // The unsafe shape is the one that owns its own quotes around a mustache.
      expect(source).not.toMatch(new RegExp(`${field}: '\\{\\{[a-zA-Z]`));
      expect(source).toContain(`{{tsString ${field}}}`);
    });
  }
});
