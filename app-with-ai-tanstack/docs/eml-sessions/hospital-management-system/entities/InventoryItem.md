# InventoryItem — dossier

Phase 4, entity 29 of 30. **Standalone**, Stock. §5 of the research's last
decision — *has this consumable fallen to its reorder level?* — lands here.

## 1 · Fields

| Column | Type | Modifiers | Help |
|---|---|---|---|
| `id` | string | PK | — |
| `code` | string | UK, required | The store's own code, on the shelf label and every requisition. |
| `name` | string | required | What it is called by the people who order and use it. |
| `supplier_id` | string | FK, required | Who it is bought from. |
| `category` | string | required, enum | What kind of stock. Decides where it is stored and who counts it. |
| `unit_of_issue` | string | required | What one unit *is* — each, box of 100, 500 mL bottle. |
| `quantity_on_hand` | decimal | required | How many are in the store now. |
| `reorder_level` | decimal | required | The quantity at which more must be ordered. |
| `reorder_quantity` | decimal | required | How many to order when it does. |
| `requires_cold_chain` | boolean | required | Must be kept refrigerated. |
| `is_on_reorder` | boolean | required | On the buyer's worklist. Written by the workflow, not by hand. |
| `is_active` | boolean | required | Whether it is still stocked. |
| `storage_location` | string | optional | Aisle, shelf or fridge. |

**`unit_of_issue` is a string and it is load-bearing.** Every quantity in this
part of the model — on hand, reorder level, reorder quantity, each movement — is
in these units, and the unit is not universal: *each*, *box of 100*, *500 mL
bottle*. A number without it is a number of nothing. It is free text for the same
reason `Medication.strength` is: an enum would exclude a real unit the store
actually uses.

**`quantity_on_hand` is never typed in.** It is the sum of every movement against
the item — that is what `StockTransaction` is *for*, and it is why a stock count
is recorded as a `correction` movement rather than as an edit to this number.
Two mechanisms writing one figure is how a store's book count and its shelf
count come to disagree with nothing to explain the difference.

The column is therefore maintained by a lifecycle handler,
`afterCreate applyStockMovement on StockTransaction`, for the same reason the
co-pay split is a hook: **a step writes a literal and a rule's transform writes a
literal, so running arithmetic belongs in a handler.** `%%rbac` on
`InventoryItem.update` is the other half — only `inventory_manager`,
`hospital_manager` and `administrator` may write this row at all, so a nurse
issuing stock changes the count only through a movement.

## 2 · Enums

```
%%enum StockCategory: drug, consumable, ppe, surgical, reagent, linen, other
```

## 3 · Relationships

| Direction | Other entity | Cardinality | FK lives on |
|---|---|---|---|
| in | `Supplier` | many-to-one | `InventoryItem.supplier_id` |
| out | `StockTransaction` | one-to-many | `StockTransaction.inventory_item_id` |

## 4 · Lifecycle

**None.** `is_active` and `is_on_reorder` are two independent flags, not a
sequence. An item is not *in* a state; it has a quantity, and the quantity is
what everything reacts to.

## 5 · Rules

**None on this entity.** Both stock rules fire on the movement, which is where
the write happens — the same placement as every other rule in this model.

## 6 · Hooks

**None here.** `applyStockMovement` is bound to `StockTransaction`.

## 7 · Cross-entity effects — inbound, and one still owed

Inbound: `StockReplenishment` sets `is_on_reorder` when a movement takes the
quantity to or below the reorder level.

**Still owed:** §2 of the research has the pharmacist finishing *"a prescription
turned into dispensed medicine, with the stock decremented"*. That is a saga from
`Prescription` onto `StockTransaction`, deferred at entity 22 because this entity
did not exist yet. It exists now, so **it is Gate D's**, alongside the other six
cross-entity effects.

## 8 · Access

| Operation | Roles |
|---|---|
| read | `inventory_manager`, `pharmacist`, `nurse`, `ward_manager`, `hospital_manager`, `administrator` |
| create / update | `inventory_manager`, `hospital_manager`, `administrator` |
| delete | `administrator` |

A nurse and a ward manager **read** the store — *is there any left?* is a
question a ward asks all day — and write nothing here. What they may write is a
movement, and only of the kinds a ward makes.

## Open questions

**A replenishment raises a flag, not an order.** The saga puts the item on the
buyer's worklist; there is no purchase order in the model, because the roster
was fixed at Gate B and `PurchaseOrder` is not on it. So *"it raises a
replenishment"* in §5 is honoured as far as a flag and a worklist go, and the
ordering itself happens outside the application.

That is a defensible line for a hospital system whose purchasing lives in a
finance package, and a real gap if it does not. **Adding `PurchaseOrder` and
`PurchaseOrderLine` would be two entities and would re-open Gate B** — say so and
I will cost it properly rather than sliding it in.
