import { readFileSync } from "node:fs";
import { readModel } from "../../../../website/viewers/eml-model.js";

const m = readModel(readFileSync(process.argv[2], "utf8"));
const s = m.stats;
const children = m.entities.filter((e) => e.parentEntity).map((e) => `${e.name}→${e.parentEntity}`);
console.log(` children resolved: ${children.join(", ") || "none"}`);
console.log(
  ` totals: ${s.entities} entities · ${s.fields} cols · ${s.enums} enums · ` +
    `${s.stateMachines} machines · ${s.rules} rules · ${s.hooks} hooks · ${s.accessRules} access rules`
);
const vis = m.access.entityCounts ?? {};
console.log(" role reach:");
const rows = m.access.roles.map((r) => `${r.name} ${vis[r.name] ?? "?"}/${s.entities}`);
for (let i = 0; i < rows.length; i += 5) console.log(`    ${rows.slice(i, i + 5).join(" · ")}`);
