# EML — Entity Relationship Diagrams

The ERD section describes the **data model**: entities, their attributes and
keys, and the relationships between them. It opens with `erDiagram` and follows
Mermaid ER syntax. It is parsed by
`packages/generator/src/parsers/mermaid.parser.ts`.

## Entities

```
EntityName {
    <attribute>
    <attribute>
    ...
}
```

- Entity name must match `^[a-zA-Z][a-zA-Z0-9_]*$` and be unique in the document.
- `PascalCase` is recommended (`Customer`, `OrderItem`). `snake_case`
  (`order_item`) and prefixed names (`bus_account`, `sys_user`) are accepted.
- The **table name** is derived: `PascalCase`/`camelCase` → `snake_case`;
  `ALL_CAPS`/`snake_case` stays lower-cased. A `bus_`/`sys_` prefix is preserved.

### Auto-added fields

- If an entity declares no `id` (or any `*_id`) attribute, the generator adds
  `string id PK` as the first attribute.
- `created_at` / `updated_at` timestamps are added by default
  (`entity.timestamps = true`).

## Attributes

```
<type>[(<length>)] <name> [<modifier> ...] ["<description>"]
```

- **type** — first token; normalized via the type map (see
  [`04-types-and-modifiers.md`](04-types-and-modifiers.md)). Unknown → `string`.
- **length** — optional, attached to the type: `string(120)` → `maxLength = 120`.
- **name** — second token; `snake_case` recommended.
- **modifiers** — remaining bare tokens: `PK`, `FK`, `UK`/`UNIQUE`,
  `OPTIONAL`/`NULL` (case-insensitive).
- **description** — optional trailing quoted string.

### Examples

```
string   id PK
string   email UK
string(120) display_name
decimal  amount OPTIONAL
string   company_id FK OPTIONAL "owning company"
boolean  is_active
integer  employee_count OPTIONAL
datetime last_login OPTIONAL
```

### Modifier semantics

| Modifier | Effect |
|----------|--------|
| `PK` | Primary key → `unique`, generator-managed, sets `entity.primaryKey` |
| `FK` | Foreign key → marks a reference column |
| `UK` / `UNIQUE` | Unique constraint → `unique = true` |
| `OPTIONAL` / `NULL` | Nullable → `required = false` |

Defaults: an attribute is `required` unless `OPTIONAL`/`NULL`/`PK`, and not
`unique` unless `UK`/`UNIQUE`/`PK`.

### Foreign key naming

`FK` marks a column as a reference, but it does not say *what* the column
references — the generator derives that from the column name alone. So the name
has to carry the target:

| Column name | Resolves to |
|-------------|-------------|
| `<entity>_id` | `bus_<entity>` |
| `<role>_by_id`, `<role>_by` | `bus_user` |
| `pi_id`, `manager_id`, `owner_id`, `assigned_to`, … | `bus_user` |
| anything else | nothing — see below |

A column ending in `_by` names a person by the role they played
(`reported_by_id`, `registered_by_id`, `approved_by_id`), so it resolves to the
user entity rather than to a `bus_reported_by` table that does not exist. The
full list of person-role columns is in `foreignKeys.personRoleColumns` in
`erdwithai-language.json`.

**A column that resolves to nothing is silently degraded**: the generator stores
it as a plain string, so grids and forms render the raw UUID with no lookup and
no display name. The checker catches the common cause — an `FK` column that does
not end in `_id` — as `EML114`, and the fixer repairs it:

```bash
bun language/checker.ts model.mmd     # EML114: "DeviationReport.reported_by" does not end with "_id"
bun language/fixer.ts model.mmd       # rewrites it to  string reported_by_id FK
```

Write `reported_by_id FK` rather than `reported_by FK` and the column resolves
to `bus_user` from the start.

**The `FK` modifier is half the rule.** `attributeReferenceId()` gives a column
`TABLE_DIRECT` only when it is *both* marked `FK` and named `_id`/`_by`, so
`string vendor_id` and `string vendor_id FK` — identical to the parser and to
Mermaid — are a text box and a lookup respectively in the generated application.
A column named like a reference to an entity this document declares, with no
`FK`, is `EML119`.

The same is true one field over: a `%%enum` does nothing to a column until a
`%%field` binds it. An unbound `status`, `state` or `stage` column is recorded as
free text, and the form will accept values the state machine cannot act on —
`EML146`. See `applicationDictionary` in `erdwithai-language.json` for the whole
derivation.

## Relationships

```
<LeftEntity> <cardinality> <RightEntity> : "<label>"
```

- The label is optional; when present it is normalized (trim → underscores →
  lower-case) into the relationship name.
- The **foreign key** is derived from the target entity:
  `snake_case(target)` (minus any `bus_` prefix) + `_id`
  (e.g. `Company` → `company_id`).

### Cardinality operators

| Operator | Kind | Meaning |
|----------|------|---------|
| `\|\|--\|\|` | `oneToOne` | exactly one ↔ exactly one |
| `\|\|--o{` | `oneToMany` | one → zero or many |
| `\|\|--\|{` | `oneToMany` | one → one or many |
| `}o--\|\|` | `manyToOne` | zero or many → one |
| `}\|--\|\|` | `manyToOne` | one or many → one |
| `}o--o{` | `manyToMany` | zero-many ↔ zero-many |
| `}\|--\|{` | `manyToMany` | one-many ↔ one-many |
| `\|o--o\|` | `oneToOne` | zero-or-one ↔ zero-or-one |

### Examples

```
Company ||--o{ Contact   : "employs"
Company ||--o{ Deal      : "has"
Deal    }o--|| DealStage : "in_stage"
Quote   ||--o{ QuoteItem : "contains"
User    ||--|| Team      : "managed_by"
Student }o--o{ Course    : "enrolls"
```

## Complete ERD example

```mermaid
%%meta name: Orders Core
%%meta kind: erd
%%enum OrderStatus: draft, submitted, approved, shipped, cancelled
erDiagram
    Customer {
        string id PK
        string email UK
        string first_name
        string last_name
        string phone OPTIONAL
        boolean is_active
    }

    Order {
        string  id PK
        string  customer_id FK
        string  order_number UK
        string  status
        decimal total_amount
        date    ordered_at
    }

    OrderItem {
        string  id PK
        string  order_id FK
        string  product_id FK
        integer quantity
        decimal unit_price
    }

    Customer ||--o{ Order     : "places"
    Order    ||--o{ OrderItem : "contains"

    %%field Order.status enum: OrderStatus
    %%index Order(customer_id, status)
    %%index Customer(email) unique
    %%entity Order audited: true
```
