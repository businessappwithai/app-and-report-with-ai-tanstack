/* The same context check, but against what the generator actually seeded into
   sys_business_rules rather than against the model's own text. */
import { readFileSync } from "node:fs";
import { readModel } from "../../../../website/viewers/eml-model.js";

const seed = readFileSync(process.argv[3], "utf8");
const m = readModel(readFileSync(process.argv[2], "utf8"));
const cols = new Map(
  m.entities.map((e) => [
    `bus_${e.tableName.replace(/^bus_/, "")}`,
    new Set(e.attributes.map((a) => a.name)),
  ])
);
const KW = new Set(["and", "or", "not", "true", "false", "null", "now", "today"]);
const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

let bad = 0;
let n = 0;
const re = /entityName: '([a-z_]+)',(?:(?!entityName:)[\s\S])*?jdmContent: '((?:[^'\\]|\\.)*)'/g;
for (const mm of seed.matchAll(re)) {
  const [, table, jdm] = mm;
  for (const c of jdm.matchAll(/"i1":"([^"]*)"/g)) {
    const cond = c[1].replace(/\\+'[^\\]*?\\+'/g, " ");
    const ids = [...new Set(cond.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [])].filter((i) => !KW.has(i));
    const known = cols.get(table);
    const miss = ids.filter((i) => !(known?.has(snake(i)) || known?.has(i)));
    n++;
    if (miss.length) {
      bad++;
      console.log("OFF-ROW", table, "|", cond, "->", miss.join(", "));
    }
  }
}
console.log(`${n} seeded conditions checked in the generated application, ${bad} off-row`);
process.exitCode = bad ? 1 : 0;
