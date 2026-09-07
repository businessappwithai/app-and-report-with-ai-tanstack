# InvoiceLine — dossier

Phase 4, entity 26 of 30. **Child of `Invoice`.**

## 1 · Fields

| Column | Type | Modifiers | Help |
|---|---|---|---|
| `id` | string | PK | — |
| `invoice_id` | string | FK, required | The bill this charge is on. |
| `chargeable_item_id` | string | FK, required | Which charge from the price list. |
| `description` | string | required | What the line says on the bill. |
| `quantity` | decimal | required | How many — nights, tests, tablets, hours. |
| `unit_price` | decimal | required | What one cost **on the day it was charged**. |
| `line_amount` | decimal | required | Quantity times unit price. |
| `charged_on` | date | required | The day the thing charged for happened. |
| `source_reference` | string | optional | What in the record this came from. |

## Three columns that look redundant and are not

`description`, `unit_price` and `line_amount` could all be derived — from the
price list, from the price list, and from the other two. They are stored anyway,
and each for the same reason: **a bill must reprint identically years later.**

A price rise, a renamed charge or a corrected rounding rule would otherwise
silently rewrite invoices that were sent, paid and reconciled. `charged_on` is
the fourth member of that family: the day the bed-night happened is not the day
the bill was raised, and an insurer checking the claim against the stay cares
about the first.

`line_amount` being stored is what makes `refuseMiscalculatedLine` possible —
there is something to disagree with.

## `source_reference` is free text, and that is a decision

A charge comes from a procedure, a lab order, a range of bed-nights or a
dispensed medicine. There is no one entity it points back at, and EML has no
polymorphic reference. The alternatives were four nullable foreign keys — three
of them always empty, all four rendering as lookups on every line — or a legible
sentence. I took the sentence and named it here so it reads as a choice.

## 2 · Enums

**None.**

## 3 · Relationships

| Direction | Other entity | Cardinality | FK lives on |
|---|---|---|---|
| in | `Invoice` | many-to-one | `InvoiceLine.invoice_id` |
| in | `ChargeableItem` | many-to-one | `InvoiceLine.chargeable_item_id` |

## 4 · Lifecycle

**None.** A line belongs to whatever the invoice is doing.

## 5 · Rules — `invoiceLineGate`

```
%%action refuseInactiveCharge      validation-error when: chargeIsActive == false
%%action refuseMiscalculatedLine   validation-error when: lineAmount != quantity * unitPrice
```

The second is the only rule in the model that does arithmetic in its condition
rather than reading a value someone else computed. It is a zen expression over
three columns of the row being written, so it needs nothing the engine does not
already have — which is exactly why the three columns are stored.

## 6 · Hooks · 7 · Cross-entity effects

**None.** The invoice total is the sum of these lines; keeping `gross_amount` in
step with them is `applyPolicyCoPay`'s job, on the parent.

## 8 · Access

Same as `Invoice`: `billing_clerk`, `hospital_manager`, `administrator` for read,
create and update; `administrator` for delete.

## Open questions

None.

---

## Phase 6 repair — `refuseInactiveCharge` moved into the pricing handler

It read `chargeIsActive` from `ChargeableItem`. A line has no business
carrying a copy of that flag, so it did not become a column: the check is now
`%%hook beforeCreate priceInvoiceLine on InvoiceLine`, which is the same act
that copies `description` and `unit_price` off the price list.

`refuseMiscalculatedLine` is unaffected, and is why those three columns are
stored: `lineAmount != quantity * unitPrice` reads nothing but the line.
