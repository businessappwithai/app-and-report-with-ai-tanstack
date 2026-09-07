# Supplier — dossier

Phase 4, entity 28 of 30. **Standalone**, Stock. A lookup entity, like
`Medication` and `ChargeableItem` — nothing happens to it, and two things would
be guesswork without it.

## 1 · Fields

| Column | Type | Modifiers | Help |
|---|---|---|---|
| `id` | string | PK | — |
| `code` | string | UK, required | Purchasing's own code for them. |
| `name` | string | required | The company as it appears on an order and an invoice. |
| `lead_time_days` | integer | required | How many days a delivery takes once ordered. |
| `is_active` | boolean | required | Whether they may still be ordered from. |
| `contact_name` | string | optional | Who to speak to about an order. |
| `email` | email | optional | Where an order is sent. |
| `phone` | phone | optional | The number to chase a late delivery on. |
| `address_line` | string | optional | Where they are, for returns. |
| `notes` | text | optional | Minimum order, delivery days, account number. |

**Display value** resolves to `name`.

`email` and `phone` carry the semantic types rather than `string`, so the
Application Dictionary renders an email control and a telephone control — the
same choice made on `Staff` at entity 4, and the reason §3.7 exists.

**`lead_time_days` is the column that makes `reorder_level` mean something.** A
reorder level is not a number somebody likes; it is *how much stock covers the
supplier's lead time at the expected rate of use*. Without the lead time
recorded, the level on the next entity is folklore.

## 2 · Enums

**None.**

## 3 · Relationships

| Direction | Other entity | Cardinality | FK lives on |
|---|---|---|---|
| out | `InventoryItem` | one-to-many | `InventoryItem.supplier_id` |
| out | `StockTransaction` | one-to-many | `StockTransaction.supplier_id` |

Two edges to two different entities, so both get their own database constraint.
The second is optional on the transaction: only a **receipt** names who delivered
it.

## 4 · Lifecycle · 5 · Rules · 6 · Hooks · 7 · Cross-entity effects

**None of the four.** A supplier is maintained, not processed. `is_active` is one
flag with no sequence behind it, exactly as on `Medication` and
`ChargeableItem` — the three lookup entities in this model behave identically,
which is itself worth noticing.

## 8 · Access

| Operation | Roles |
|---|---|
| read | `inventory_manager`, `pharmacist`, `hospital_manager`, `administrator` |
| create / update | `inventory_manager`, `hospital_manager`, `administrator` |
| delete | `administrator` |

**This entity introduces `inventory_manager` to the access model.** The role has
been in `StaffRole` since entity 4 and named in no `%%rbac` line until now, so
until this group it was a job title with no screens. All eleven declared roles
now appear in the access rules — which is one of the Phase 5 coverage checks,
satisfied early.

`pharmacist` reads suppliers because drugs are stocked and ordered like anything
else, and pharmacy places its own orders.

## Open questions

None.
