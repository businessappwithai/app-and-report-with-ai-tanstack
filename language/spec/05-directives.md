# EML — Directive Reference

Directives are `%%`-prefixed comment lines that carry generator meaning while
staying invisible to Mermaid renderers.

Each directive has a **status**, declared canonically in its own entry in
`erdwithai-language.json` and repeated in the heading below:

| Status | Meaning |
|--------|---------|
| **compiled** | A shipped reader consumes it and the generated application changes as a result. The `consumedBy` field in the JSON names the file. |
| **validated** | Nothing compiles it yet, but `language/checker.ts` enforces its syntax and cross-references, so a malformed one fails validation instead of being silently dropped. |
| **reserved** | Documented and renderer-safe, with no reader. Writing one is legal and inert; the keyword is held so a later meaning cannot collide with a plain comment. |

All fifteen keywords are reserved words in the language regardless of status —
a `%%` line beginning with one of them is a directive, never a plain comment:

| | | | | |
|---|---|---|---|---|
| `%%meta` *(compiled)* | `%%hook` *(compiled)* | `%%step` *(compiled)* | `%%action` *(compiled)* | `%%entity` *(validated)* |
| `%%field` *(compiled)* | `%%enum` *(compiled)* | `%%category` *(compiled)* | `%%index` *(compiled)* | `%%rule` *(validated)* |
| `%%guard` *(compiled)* | `%%loop` *(compiled)* | `%%rbac` *(compiled)* | `%%trigger` *(validated)* | `%%workflow` *(compiled)* |

---

## `%%meta` — document / section metadata *(compiled)*

```
%%meta <key>: <value>
```

| Key | Meaning |
|-----|---------|
| `name` | Human name of the model/section |
| `kind` | `erd` \| `rules` \| `workflow` (classifies the following diagram) |
| `version` | Semantic version of the model |
| `entity` | Default entity binding for the section |
| `stack` | Target stack hint (`tanstack-start-nestjs` \| `openui5-odatav4`) |

```
%%meta name: CRM Core
%%meta kind: rules
%%meta version: 1.0.0
```

## `%%hook` — lifecycle handler binding *(compiled)*

```
%%hook <type> <handlerName> on <Entity>[<params>]
```

Regex (from `hook-parser.ts`):

```
%%hook\s+(\w+)\s+(\w+)\s+on\s+(\w+)(\[(?:field:\s*\w+(?:\s*,\s*field:\s*\w+)*)?\])?
```

- `type` — one of the 13 hook types (see `03-workflows.md`).
- `params` — optional `[field: a, field: b]`.

```
%%hook beforeCreate hashPassword on User
%%hook beforeCreate generateSlug on Post[field: slug]
```

## `%%step` — bind a flowchart node to an executable step *(compiled)*

```
%%step <nodeId> <stepType> <key>: <value> ...
```

Only meaningful inside a `%%workflow ... kind: saga` section. `nodeId` names a
node in that flowchart; the flowchart's edges give the running order. Each
`%%step` becomes one `bpmn:serviceTask` in the seeded workflow definition.

- `stepType` — `UpdateEntity` | `CreateEntity` | `DeleteEntity` | `Formula` |
  `REST` | `Agent`
- properties — space-separated `key: value`. A value runs to the next `<key>:`
  token, so it may contain spaces. **`fields` carries JSON and must be the last
  key on the line.**

```
%%step B Formula target: baseDays operation: set value: 3
%%step C Formula target: resolutionDays source: baseDays operation: multiply operand: 7
%%step D CreateEntity entity: Capa as: newCapaId fields: {"title":"CAPA","status":"open"}
%%step E UpdateEntity field: status value: escalated
%%step F UpdateEntity entity: Capa targetSource: newCapaId field: effectiveness_metric source: resolutionDays
%%step G DeleteEntity entity: Capa targetSource: supersededCapaId
```

Steps share a context — the triggering record's columns plus every variable an
earlier step published (`as` on `CreateEntity`, `target` on `Formula`). Naming
one in `source` or `targetSource` is how a later step reaches a row an earlier
step created.

Per-type required properties and the row-targeting rules are in
[`03-workflows.md`](03-workflows.md#3-saga-workflows--multi-step-processes) and
declared canonically under `workflowConstructs.stepNodes` in
`appwithai-language.json`.

## `%%action` — declare a rule's side effect *(compiled)*

```
%%action <name> <actionType> when: <expr> <key>: <value> ...
```

Only meaningful inside a business-rules section. A section that carries
`%%action` directives compiles to a GoRules **decision table** — one row per
directive — instead of a node graph.

That difference is the whole point. The node-graph form a rules flowchart
normally compiles to carries no outputs, so the rules engine finds no actions in
it: a model-declared rule could decide, but never act. A decision table is the
shape the engine reads `action`, `message`, `ruleId` and `workflowName` from, so
a section declaring actions is compiled as one.

- `name` — identifies the row; also the fallback message text.
- `actionType` — lands in the `action` output. `trigger-workflow` and
  `validation-error` are the two the generated runtime acts on.
- `when:` — a Zen expression over the triggering record. Omitted means `true`,
  which fires on every write.
- remaining keys — space-separated `key: value`, each value running to the next
  `<key>:` token, so a value may contain spaces.

The recognised property keys map to decision-table output columns:

| Key | Output field | Used by |
|-----|--------------|---------|
| `message` | `message` | `validation-error` — the text the write fails with |
| `workflow` | `workflowName` | `trigger-workflow` — names the workflow to start |
| `field` / `value` | `field` / `value` | stamping a column |
| `targetEntity` / `linkField` | `targetEntity` / `linkField` | acting on a related row |

The table uses `hitPolicy: collect`, because several rows may match one write —
a rule that escalates *and* stamps a field is ordinary. Every declared output
column is written in every row, blank where unused: zen-engine yields *no result
at all* for a row with a missing cell, so an omitted column would make the whole
rule evaluate to nothing.

```
%%action escalate trigger-workflow when: severity == "critical" workflow: CriticalDeviationEscalation
%%action requireCause validation-error when: root_cause == null message: A root cause is required
```

**This is how a model-declared rule reaches a model-declared saga**: the rule's
`when` decides, and its `trigger-workflow` action names the workflow by the name
its `%%workflow` directive gave it.

## `%%entity` — entity-level metadata *(validated)*

```
%%entity <Name> <key>: <value>
```

| Key | Meaning |
|-----|---------|
| `prefix` | `bus` \| `sys` table prefix |
| `audited` | `true` \| `false` — emit audit trail |
| `softDelete` | `true` \| `false` — use `deleted_at` |
| `label` | UI display label |
| `icon` | UI icon name |
| `help` | Human-readable description — stored in `sys_table.description` and used as the opening paragraph of that entity's section in `manual.html` |

```
%%entity Order audited: true
%%entity Account prefix: bus
%%entity Lead help: A prospective customer contact who has shown interest but has not yet been qualified by a sales representative.
```

The `help:` value runs to end-of-line. It is the only prose an author controls for an entity; every other part of that section in the manual (fields, relationships, lifecycle, rules, RBAC) is derived automatically from the model structure. An entity with no `help:` gets a placeholder sentence in the manual and nothing in the form — write one for every entity.

## `%%field` — extended field metadata *(compiled: the `enum:` key only)*

```
%%field <Entity>.<attr> <key>: <value>
```

| Key | Meaning |
|-----|---------|
| `enum` | Reference a `%%enum` for allowed values |
| `ui` | Control override (select, textarea, switch, …) |
| `default` | Default value |
| `min` / `max` | Numeric or length bounds |
| `help` | Field help text |
| `format` | Display/validation format |

```
%%field Order.status enum: OrderStatus
%%field Product.price min: 0
%%field User.bio ui: textarea
%%field Order.placed_at help: When the customer committed, not when we shipped.
```

`enum:` and `help:` are the two keys a compiler reads; the rest are validated
only. `help:` has **two** consumers: `sys_column.description`, which the
generated form prints as hint text beneath the control, and `manual.html`, where
it fills the "Purpose" column of the field table. A field with no `help:` shows a
dash in the manual and no hint in the form. Write help on every field, not only
the ambiguous ones — the manual has no other way to explain what a field is for.

### The manual and what comes from help text vs. the model

The generated `manual.html` is built entirely from the `ParsedModel` —
`packages/generator/src/manual/index.ts`, zero runtime dependencies. Each
entity section has five subsections:

| Subsection | Source | Needs `help:`? |
|---|---|---|
| Opening paragraph | `%%entity <Name> help:` | Yes — blank if omitted |
| **Fields** — name, control type, constraints, enumerated values, purpose | Model attributes; purpose from `%%field <E>.<f> help:` | Yes for "Purpose" column |
| **Relationships** — what this entity links to and from | `erDiagram` FK declarations | No — auto-derived |
| **Lifecycle** — state machine table (From / To / Event) | `%%workflow … kind: state` transitions | No — auto-derived |
| **Rules and automation** — decision rules, sagas, hooks | `%%rule`, `%%workflow kind: saga`, `%%hook` | No — auto-derived |
| **Access** — which roles may read / create / update / delete | `%%rbac` directives | No — auto-derived |

The global sections (all rules, all processes, how the application was built) are
also entirely automatic. **The model author's only lever is `%%entity help:` and
`%%field help:`** — everything else the manual says about the application is
derived from the model's structure.

### Authoring guidance for `%%field help:`

Good help text answers: *what business purpose does this field serve, and what
value is expected here?*

- One or two sentences. Avoid restating the field name.
- Name the business decision or event the field records:
  `%%field Contract.signed_at help: The date and time the counterparty returned a signed copy. Left blank until signature is confirmed.`
- Describe the domain constraint, not the database constraint:
  `%%field Invoice.due_date help: Payment must be received by this date or a late-fee workflow starts automatically.`
- For enum fields, explain what each value means:
  `%%field Lead.status help: new — just entered; contacted — first outreach made; qualified — sales accepted; lost — no longer pursuing.`
- For FK fields, explain the relationship in business terms:
  `%%field Order.account_id help: The company this order belongs to. Must match an approved account before shipping.`

A field whose purpose is truly self-evident (`%%field User.email`) still benefits
from a sentence when there are business rules attached to it — the manual is the
only place those rules are explained in plain language.

## `%%enum` — named enumeration *(compiled)*

```
%%enum <Name>: <value1>, <value2>, ...
```

Reusable by `%%field enum:` and by state-workflow states.

```
%%enum OrderStatus: draft, submitted, approved, shipped, cancelled
%%enum Priority: low, medium, high, urgent
```

## `%%category` — group entities for the dashboard *(compiled)*

```
%%category name: <Name>; description: <text>; icon: <LucideIcon>; color: <#hex>; seq: <n>; default: true; entities: <A>, <B>
```

Groups business entities into a named Application Dictionary category. The
generated dashboard renders one block per category, ordered by name, and
`/admin/categories` maintains them.

Only `name` is required; the remaining keys are `;`-separated and may appear in
any order. `entities` lists the entity names the category holds. `default: true`
marks the category that receives anything left unassigned — at most one document
may declare it.

A model that declares no categories gets a single `General` default holding
every entity, so the directive is optional.

```
%%category name: Compound Registry; description: Structures and aliases; icon: FlaskConical; color: #6366f1; entities: Compound, CompoundAlias
%%category name: People and Teams; default: true; entities: User, Team
```

## `%%index` — database index *(compiled)*

```
%%index <Entity>(<attr>[, <attr>...]) [unique]
```

```
%%index Contact(email) unique
%%index Order(company_id, status)
```

## `%%rule` — bind a decision flow *(validated)*

```
%%rule <name> on <Entity> event: <lifecycle> priority: <n>
```

Ties a business-rules section to an entity + lifecycle event; `priority` orders
multiple rules.

```
%%rule pricing on Order event: beforeCreate priority: 10
```

## `%%loop` — repeat while a rule holds *(compiled)*

```
%%loop <loopId> while: <field> <operator> <value> max: <n>
%%step <nodeId> in: <loopId>
```

The steps naming a loop run in order and repeat for as long as the check passes,
ending the first time it fails. The check is re-read before every pass against
the current record, so a step inside the loop is what ends it. Operators are the
same eleven as automation conditions. Loops do not nest.

```
%%loop L1 while: retry_count lt 5 max: 10
%%step s1 in: L1
%%step s2 in: L1
```

`max:` is **required** — the passes after which the loop is abandoned and the run
marked `FAILED`. There is no default: the right ceiling depends on the work, not
the engine. A loop whose check reads a field no member writes is refused at
compile time, as is one with no `max`.

Members are drawn as a Mermaid `subgraph L1[Repeat while …]`, and a step inside
can read `{{L1.iteration}}` — the 1-based pass number. Full semantics in
[`03-workflows.md`](03-workflows.md#loops--repeating-steps-while-a-rule-holds).

## `%%guard` — automation condition *(compiled)*

```
%%guard <field> <operator> <jsonValue>
```

A check that must pass for an automation's steps to run. All of an automation's
guards must pass; there is no OR. See
[03-workflows.md](03-workflows.md#conditions) for the operators.

```
%%guard status eq "open"
%%guard order.total gt 1000
```

## `%%rbac` — restrict an operation or a transition *(compiled)*

```
%%rbac <roleExpr> on <Entity>.<op>
```

`roleExpr` uses `role:<name>` with `|` for OR — `role:sales|manager` and
`role:sales|role:manager` both work, as does a bare `admin`.

### It restricts; it does not grant

A target no directive mentions is **open** to any authenticated caller. One or
more directives close it to the union of the roles they name.

That direction matters. The opposite reading — everything denied until granted —
would lock every user out of every existing model on the next regeneration, and
a model that says nothing about permissions belongs to an author who has not got
to them yet, not one who wants everything forbidden.

A **master role** (`sys_role.is_master_role`) bypasses every rule. Role names are
matched **case-insensitively**: seeded roles are title-cased (`Manager`) and
directives are written lower-case (`role:manager`), and an exact match would
make such a rule unsatisfiable — locking out precisely the people it was written
to admit, invisibly, until someone is refused.

### `<op>` is a CRUD operation or a transition

**CRUD**: `create` `read` `update` `delete`, or `*` for all four. Aliases are
accepted (`insert`/`add`, `view`/`select`/`list`, `edit`/`write`/`modify`,
`remove`/`destroy`).

```
%%rbac role:admin on Order.delete
%%rbac role:sales|manager on Deal.update
%%rbac role:admin on Customer.*
```

**Transition**: any other name is resolved against the entity's
`stateDiagram-v2` transition events.

```
%%workflow QuoteLifecycle entity: Quote kind: state
stateDiagram-v2
    draft --> pending : submit
    pending --> approved : approve

%%rbac role:sales_manager on Quote.approve
```

A generated application has **no named-transition endpoint** — moving a record
along an edge is an ordinary status update — so the rule is stored as the
`(from_state, to_state)` pair it covers, and the guard recognises the move by the
states the write crosses. Both ends are kept because one event can sit on several
edges and two events can reach the same state: restricting `approve` must not
incidentally restrict a different event that happens to land on `approved`.

An event written with spaces or dashes in the diagram (`close won`) is named in
one token in the directive (`close_won`).

### `read` decides which functional role an entity belongs to

Every other operation only refuses a write. `read` is the one that changes what a
role *sees*: an entity a role may not read is absent from that role's navigation
entirely — no menu entry, no dashboard card, no lookup — because a menu full of
entries that answer `403` is a worse application than a shorter one.

That makes one `read` directive per entity the way a model says who an entity
belongs to:

```
%%rbac role:sales_rep|sales_manager|support_agent on Account.read
%%rbac role:sales_rep|sales_manager on Opportunity.read
%%rbac role:support_agent|support_manager on SupportCase.read
%%rbac role:marketing_manager on Campaign.read
```

A model is expected to name **every** entity on at least one such directive, so
every entity belongs to somebody. Declaring none leaves every entity visible to
every signed-in caller, which is what every model did before this rule existed —
the fallback, not the target.

Three things follow, and each has caught a model out:

- **A role that may act on an entity must also be able to read it.** A rule
  letting `sales_manager` run `Opportunity.close_won` is useless if the
  `Opportunity.read` line does not name `sales_manager`.
- **Overlap is normal and is one line.** `Account` belongs to sales, marketing
  and support in most businesses; name all three. Two directives on one target
  merge, so either spelling works.
- **Do not reach for `.*` to express ownership.** It restricts creating,
  updating and deleting to the same list, and it *merges with* rather than
  overrides the narrower `update` rules elsewhere in the document — widening
  them.

### One account per role, seeded

Every role a directive names is created, and one account is seeded holding it,
beside the administrator who bypasses everything and a role-less `User`.

This is not a convenience. The administrator is exempt from every rule the model
wrote, so an application whose only account is the administrator is one whose
access control cannot be looked at. Both stacks derive the list from
`packages/generator/src/rbac/roles.ts`, and both sign-in screens print it with
the number of entities each role can see — `Support Agent · 5 of 17` is the
invitation to check.

### What it compiles to

| | |
|---|---|
| CRUD rules | `sys_operation_access` (table, operation, role) |
| Transition rules | `sys_transition_access` (table, transition, status field, from, to, role) |
| Enforcement | `EntityAccessGuard`, applied to the generated `/bus` CRUD routes |
| Roles | every role a directive names is created in `sys_role`, with one account holding it |
| `read` rules | additionally narrow the dictionary window scope and the entity navigation |

Rules carry `entity_type = 'D'` (declared by the model) and are replaced on every
regeneration. Rules an administrator adds in the running application are marked
`'U'` and survive — the same ownership split the workflow definitions use.

> **A rule about anything other than `read` deliberately does not write
> `sys_access`.** That is a *grant* table feeding
> `sys_refresh_dictionary_scope()`, which recomputes `allowed_roles` on every
> dictionary table: a table with no rows there is visible to all roles, and the
> first row added narrows it to that role alone. Seeding one from
> `%%rbac role:admin on Order.delete` would hide the Order window from everyone
> but admin — a restriction on deleting quietly becoming a restriction on
> looking.
>
> `read` is the one operation where the two coincide, and it is the exception on
> purpose: a role that may not read an entity has no use for a window onto it.

> Spelled `%%guard` before that keyword was needed unambiguously for automation
> conditions. That sense had no shipped parser and no stored data, so it is the
> side that moved — renaming the condition form would have meant rewriting every
> stored automation. A model still carrying `%%guard role:… on <Entity>.<op>` is
> skipped by the automation reader rather than parsed as a check on a field
> called `role:admin`, which could never pass and would silently disable the
> automation.

### Validation

`EML210` malformed syntax · `EML211` names no role · `EML212` suspicious role
expression · `EML213` undeclared entity · `EML214` the target is neither a CRUD
operation nor a transition of that entity.

All but `EML212` are **errors**, not warnings: a `%%rbac` rule that does not
compile is not a rule that does nothing — it is an access restriction its author
believes is in place and is not.

## `%%trigger` — event / schedule source *(validated)*

```
%%trigger <source> -> <handler> on <Entity>
```

`source` forms: `cron:<expr>`, `webhook:<name>`, `message:<topic>`.

```
%%trigger cron:0 0 * * * -> expireQuotes on Quote
%%trigger webhook:payment -> markPaid on Order
```

## `%%workflow` — name & classify a workflow *(compiled)*

```
%%workflow <name> entity: <Entity> kind: <hook|state|saga> [trigger: automatic|rule]
           [operation: CREATE|UPDATE|DELETE|ALL]
```

`trigger` and `operation` apply to `kind: saga` only. `automatic` (the default)
runs the workflow on every matching write; `rule` runs it only when a business
rule emits a `trigger-workflow` action naming it, so the rule's condition is what
decides. `operation` defaults to `CREATE` and is only consulted for `automatic`.

```
%%workflow OrderFulfilment entity: Order kind: state
%%workflow SignupFlow entity: User kind: hook
%%workflow CheckoutSaga entity: Order kind: saga trigger: rule
```
