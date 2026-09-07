/* Every saga step that writes a state column must write a state the machine
   knows: an UpdateEntity to any declared state (the guard refuses a move with
   no edge from where the record stands), a CreateEntity to the initial one. */
import { readFileSync } from "node:fs";
import { readModel } from "../../../../website/viewers/eml-model.js";

const m = readModel(readFileSync(process.argv[2], "utf8"));
const machines = new Map();
for (const w of m.workflows) {
  if (w.states?.length) machines.set(w.entity, w);
}
let problems = 0;
let checked = 0;

for (const w of m.sagas) {
  for (const step of w.steps ?? []) {
    const target = step.props?.entity ?? w.entity;
    const machine = machines.get(target);
    if (!machine) continue;
    const col = machine.statusColumn ?? "status";
    if (step.type === "UpdateEntity") {
      if (step.props?.field !== col) continue;
      checked++;
      const value = step.props.value;
      const known = machine.states.some((s) => (s.name ?? s) === value);
      console.log(`${known ? "PASS" : "FAIL"}  ${w.name} → ${target}.${col} = ${value}`);
      if (!known) problems++;
    } else if (step.type === "CreateEntity") {
      const fields = step.props?.fields;
      const parsed = typeof fields === "string" ? JSON.parse(fields) : fields;
      if (!parsed || !(col in parsed)) continue;
      checked++;
      const value = parsed[col];
      const ok = value === machine.initial;
      console.log(
        `${ok ? "PASS" : "FAIL"}  ${w.name} → new ${target}.${col} = ${value} (initial: ${machine.initial})`
      );
      if (!ok) problems++;
    }
  }
}
console.log(`\n${checked} state writes checked, ${problems} problem${problems === 1 ? "" : "s"}`);
process.exitCode = problems ? 1 : 0;
