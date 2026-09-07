# ChargeableItem — dossier

Phase 4, entity 24 of 30. **Standalone**, Billing. The entity the published
hospital model does not have, argued for at Gate B and approved there.

## Why it exists

§1 of the research says the business model is *"things are done to them that have
prices"*. Without a price list, an invoice line is a description and a number
somebody typed — so two bills for the same procedure disagree, a price rise has
to be remembered rather than applied, and nobody can answer *what do we charge
for this*.

## 1 · Fields

| Column | Type | Modifiers | Help |
|---|---|---|---|
| `id` | string | PK | — |
| `code` | string | UK, required | The price list's own code. |
| `name` | string | required | What the charge is called on the bill the patient reads. |
| `category` | string | required, enum | What kind of charge it is. Groups the invoice. |
| `unit_price` | decimal | required | What one costs **today**. |
| `is_active` | boolean | required | Withdrawn charges are deactivated, never deleted. |
| `description` | text | optional | What the charge covers. |

**Display value** resolves to `name`.

**`unit_price` is today's price and only today's.** An invoice line keeps its own
copy, so changing this never rewrites a bill already raised. That is why there is
no `effective_from` / `effective_to` pair here: price history would be a second
mechanism doing the job the line already does, and two mechanisms disagree.

## 2 · Enums

```
%%enum ChargeCategory: consultation, procedure, bed_night, laboratory, imaging, medication, consumable, other
```

The categories are the five things §1 lists as having prices, plus consumables
and a residual. They are what the invoice groups by.

## 3 · Relationships

| Direction | Other entity | Cardinality | FK lives on |
|---|---|---|---|
| out | `InvoiceLine` | one-to-many | `InvoiceLine.chargeable_item_id` |

That foreign key clears the last outstanding `EML125` in the model — it has been
open since the seed, because the entity it points at only became real here.

## 4 · Lifecycle · 5 · Rules · 6 · Hooks

**None of the three.** A price list is maintained, not processed. The rule that
reads `is_active` fires on `InvoiceLine`, where the write happens.

## 7 · Cross-entity effects

None outward.

## 8 · Access

| Operation | Roles |
|---|---|
| read | `billing_clerk`, `hospital_manager`, `administrator` |
| create / update | `hospital_manager`, `administrator` |
| delete | `administrator` |

**A billing clerk reads the price list and cannot change it.** Setting a price is
a management decision; applying one is a clerical act. Keeping them apart is the
whole reason the price list is an entity rather than a column.

No clinician reads it, deliberately: §7 of the research wants clinicians out of
the money, and a doctor who can see what a procedure earns is a doctor who can be
influenced by it.

## Open questions

None.
