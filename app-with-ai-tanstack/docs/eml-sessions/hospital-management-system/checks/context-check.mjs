/* Every identifier a rule's `when:` reads must be a column of the entity the
   rule is bound to. The generated bus service evaluates the decision against
   the record being written and nothing else, so an identifier that is not a
   column of that row is undefined at evaluation — and a comparison against
   undefined is false, so the rule never fires and never says so. */
import { readFileSync } from "node:fs";
import { readModel } from "../../../../website/viewers/eml-model.js";

const src = readFileSync(process.argv[2], "utf8");
const m = readModel(src);
const columnsOf = new Map(
  m.entities.map((e) => [e.name, new Set(e.attributes.map((a) => a.name))])
);
const KEYWORDS = new Set(["and", "or", "not", "true", "false", "null", "now", "today"]);
const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

let unresolved = 0;
for (const rule of m.rules) {
  const cols = columnsOf.get(rule.entity) ?? new Set();
  for (const action of rule.actions ?? []) {
    const when = (action.when ?? "").replace(/'[^']*'|"[^"]*"/g, " ");
    const ids = [...new Set(when.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [])].filter(
      (id) => !KEYWORDS.has(id)
    );
    const missing = ids.filter((id) => !cols.has(snake(id)) && !cols.has(id));
    if (missing.length) {
      unresolved++;
      console.log(`OFF-ROW  ${rule.entity}.${action.name}: ${missing.join(", ")}`);
    }
  }
}
console.log(
  `\n${m.rules.reduce((n, r) => n + (r.actions?.length ?? 0), 0)} actions checked, ${unresolved} read a value that is not a column of their own row`
);
