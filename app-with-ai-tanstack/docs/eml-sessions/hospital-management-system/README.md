# hospital-management-system — the session record

What `llmdetailed.txt` §10 calls the session directory, kept rather than
discarded. It is the record of one complete run of the interactive authoring
protocol: the hospital model published at
`appwithai.org/guide/models/hospital-management-system.eml.mmd` was built here,
entity by entity, through seven gates.

It is here for two reasons. §10 makes claims about what the protocol produces,
and this is the evidence for them. And three of the faults found along the way
are now rules in §10 itself — the account of *how* each was found is longer than
the rule, and belongs somewhere a reader can follow it.

## What is in it

| File | What it is |
|---|---|
| `hospital-management-system.eml.mmd` | The delivered model. 30 entities, 323 columns, 39 enums, 10 state machines, 10 sagas, 18 rules, 27 hooks, 132 access rules. 0 errors, 0 warnings |
| `00-research.md` | Phase 1 — the business, before any entity is named. Every statement tagged `[stated]`, `[inferred]` or `[assumed]`; the five `FORK` lines are what Gate A decided |
| `01-entities.md` | Phase 2 — the roster, the parent/child argument for each of the seven children, and the cross-check against the model this replaces |
| `entities/*.md` | Phase 4 — one dossier per entity, in the order they were walked. Eight sections each, and an appended **Phase 6 repair** section on the eleven the late rule rewrite touched |
| `04-cross-cutting.md` | Gate D — the seven effects that cross entities, and why five are sagas and two had to be handlers |
| `05-phase6-findings.md` | What the generated application said, and the repair it forced |
| `03-validation.md` | One row per step that touched the `.mmd`, with the diagnostic count before and after. The evidence the model was built clean rather than cleaned up at the end |
| `progress.md` | The resume file §10.0 requires, plus the protocol notes collected as they arose |

## The three faults, in the order they were found

1. **§10.3's seed example did not parse.** `Member { string id PK }` on one line
   reads as zero entities — `MermaidParser` needs the brace to end the line — and
   the checker recovers the names from the `%%category` lines, so the document
   reports `0 errors` and generates nothing. Fixed in `llmdetailed.txt`, and
   `scripts/ci/llmtext-claims.ts` now reads the seed with the real parser.
2. **A column name silently decides a control type.** Ten columns resolved to
   nothing and would have rendered raw ids on every form. `03-validation.md` has
   the whole account.
3. **A rule sees the record being written and nothing else.** Sixteen of
   thirty-three actions read a parent's column or a count of children, so they
   would have been seeded, listed in the admin screen, drawn by the viewer — and
   inert. `05-phase6-findings.md` has the finding and the repair.

The third is why the dossiers carry a repair section: the model the user
approved at four gates is not quite the model that shipped, and the difference
is theirs to see.

Two more were found afterwards, by *running* the published chapter against the
delivered model rather than by reading it. Both were invisible on the page
except as a smaller number:

4. **A mandatory foreign key inside a cycle empties an entity.**
   `Department.doctor_id` shipped without `OPTIONAL` although this record's own
   dossier and the field's help text both call it optional, and
   `Department`/`Doctor`/`Staff` form a cycle no insert order can satisfy. Ten
   department rows became none. Fixed in the model, in `05-phase6-findings.md` §4.
5. **A `UNIQUE` foreign key was seeded with replacement.** Ten doctors came back
   as nine rows, ten nurses as six, silently. Fixed in the generator
   (`sample-data.ts`), in `05-phase6-findings.md` §5.

## `checks/`

Four scripts, model-agnostic, written during the walkthrough because the checker
does not do what they do. Each reads the same `ViewModel` the published viewers
draw from — `website/viewers/eml-model.js`, the generator's own parser and
compilers — so none of them knows anything the site does not.

```bash
node docs/eml-sessions/hospital-management-system/checks/summary.mjs       <model.mmd>
node docs/eml-sessions/hospital-management-system/checks/saga-check.mjs    <model.mmd>
node docs/eml-sessions/hospital-management-system/checks/context-check.mjs <model.mmd>
node docs/eml-sessions/hospital-management-system/checks/seeded-check.mjs  <model.mmd> <generated>/backend/seeds/04_business_rules.ts
```

| Script | What it catches that the checker does not |
|---|---|
| `saga-check.mjs` | A saga step that writes a state its machine draws no edge to. The entity-access guard answers 403, so the rule fires, the write is rejected, and the record sits still. It found two missing edges in this model |
| `context-check.mjs` | A rule condition naming anything that is not a column of the rule's own entity. It found sixteen |
| `seeded-check.mjs` | The same check against what the generator actually seeded into `sys_business_rules`, rather than against the model's text |
| `summary.mjs` | Totals and the per-role entity reach — what each gate was reported against |

They are deliberately not wired into CI: they are authoring tools, and a model in
this repository that failed one would be a bug in the model, not in the build.
