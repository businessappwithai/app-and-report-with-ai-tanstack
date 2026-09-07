# StockTransaction — dossier

Phase 4, entity 30 of 30. **Standalone**, Stock. The last entity, and the one
that makes `quantity_on_hand` trustworthy.

## Why every movement is a row

A quantity that is edited has no history: a count that drops by forty overnight
is either forty items issued to a ward, a delivery entered twice, a disposal
after a fridge failure, or a theft, and an edited number cannot tell you which.
A movement per row answers *who, when, how many and why* by construction, and
the count becomes the sum rather than an assertion.

That is also why a stock count is recorded here as a `correction` and not as an
edit to the item: the difference between the book figure and the shelf figure is
itself the thing worth keeping.

## 1 · Fields

| Column | Type | Modifiers | Help |
|---|---|---|---|
| `id` | string | PK | — |
| `inventory_item_id` | string | FK, required | Which item moved. |
| `performed_by_id` | string | FK, required | Who moved it. |
| `transaction_type` | string | required, enum | What kind of movement. |
| `quantity` | decimal | required | How many units. **Positive adds, negative takes away.** |
| `occurred_on` | datetime | required | When it happened — not when it was entered. |
| `supplier_id` | string | FK, optional | Who delivered it. Set on a receipt only. |
| `ward_id` | string | FK, optional | Where an issue went. Set on an issue only. |
| `batch_number` | string | optional | The manufacturer's batch. What a recall is traced by. |
| `expiry_date` | date | optional | When this batch expires. |
| `reference` | string | optional | Delivery note, requisition or count reference. |
| `notes` | text | optional | Why, where the type alone does not say. |

**`quantity` is signed, and the sign is checked against the type.** The
alternative — an unsigned quantity with the direction implied — reads more
neatly and cannot express a correction, which goes either way. Signing it and
refusing the contradictions is the version that handles all five types with one
column.

`batch_number` and `expiry_date` are on the *movement*, not the item, because
one item is received in many batches and a recall is of a batch. Putting them on
the item would say the store holds one batch at a time, which no store does.

## 2 · Enums

```
%%enum StockTransactionType: receipt, issue, correction, return, disposal
```

Five, and each is a different question answered later: a **receipt** is checked
against a delivery note, an **issue** is attributed to a ward, a **correction**
is investigated, a **return** is credited, a **disposal** is written off. One
`adjustment` type covering the last three would make all three unanswerable.

## 3 · Relationships

| Direction | Other entity | Cardinality | FK lives on |
|---|---|---|---|
| in | `InventoryItem` | many-to-one | `StockTransaction.inventory_item_id` |
| in | `Staff` | many-to-one | `StockTransaction.performed_by_id` |
| in | `Supplier` | many-to-one | `StockTransaction.supplier_id` |
| in | `Ward` | many-to-one | `StockTransaction.ward_id` |

Four inbound references to four different entities, so all four are drawn and
all four are enforced. `Ward ||--o{ StockTransaction : issued_to` is new — not
in the seed — and it is what makes consumption attributable to a ward, which is
the report a ward manager is measured on.

## 4 · Lifecycle

**None**, and for the same reason as `Payment`: a movement is a fact. Correcting
one is a second movement, not a state change on the first.

## 5 · Rules — two

**`stockMovementGate`** · `beforeCreate` · four refusals:

```
refuseZeroMovement      quantity == 0
refuseWrongDirectionIn  transactionType == 'receipt' and quantity <= 0
refuseWrongDirectionOut transactionType == 'issue'   and quantity >= 0
refuseNegativeStock     quantity < 0 and quantityOnHand + quantity < 0
```

The last one is the one that matters: **the store cannot go negative.** A
negative count is not a small error, it is proof the book and the shelf parted
company some time ago, and the moment to stop is before it happens rather than at
the next audit.

**`stockReorderGate`** · `afterCreate` · fires `StockReplenishment` when the
movement takes the item to or below its reorder level **and it is not already on
the worklist**. That second condition is what stops every subsequent issue
raising the same replenishment again.

§5 asks whether this decision must act: *yes — it raises a replenishment*. It
acts.

## 6 · Hooks

```
%%hook afterCreate applyStockMovement on StockTransaction
```

This is the handler that adds `quantity` to `InventoryItem.quantity_on_hand`.
Arithmetic across rows, so a handler rather than a saga step — the same
limit, and the same answer, as `applyPolicyCoPay`.

## 7 · Cross-entity effects

`StockReplenishment`, outbound to `InventoryItem`. The pharmacy dispense
decrement arrives at Gate D.

## 8 · Access

| Operation | Roles |
|---|---|
| read | `inventory_manager`, `pharmacist`, `nurse`, `ward_manager`, `hospital_manager`, `administrator` |
| create | `inventory_manager`, `pharmacist`, `nurse`, `administrator` |
| update | `inventory_manager`, `administrator` |
| delete | `administrator` |

**A nurse may create a movement and may not change one.** Issuing stock to a ward
is nursing work; editing the record of a movement already made is not, and that
gap is where a stock loss would be covered up. It is the same shape as
`Payment`, for the same reason.

## Open questions

None here. The purchase-order question is on `InventoryItem`.

---

## Phase 6 repair — two ledger columns, and both rules kept

`refuseNegativeStock` and `raiseReplenishment` read `quantityOnHand`,
`reorderLevel` and `isOnReorder` — all on `InventoryItem`. Phase 6 turned the two
facts the movement needs into columns of the movement:

- **`quantity_on_hand_after decimal`** — the running balance. A stock ledger's
  own column, and what makes a count difference traceable to the movement that
  caused it. `refuseNegativeStock` is now `quantityOnHandAfter < 0`.
- **`triggers_reorder boolean`** — set when this movement takes the item to or
  below its reorder level and it is not already on the worklist.
  `raiseReplenishment` is now `triggersReorder == true`.

Both are written by `%%hook beforeCreate applyStockBalance on StockTransaction`,
which runs before the rules — the generated bus service calls
`executeBeforeCreateHooks` and only then `enforceBusinessRules`.

This is the split the whole repair rests on: **the handler resolves, the rule
decides and acts.** The replenishment stays a drawn, auditable workflow rather
than disappearing into a handler body.
