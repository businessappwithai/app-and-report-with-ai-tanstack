# Gate D — the effects that cross entities

Phase 5 of the protocol. Seven effects were recorded during Phase 4 as *"noted
here, built at Gate D"*. This is that build, and the honest split is the finding:
**five of the seven are expressible as sagas and two are not.**

## What a saga step can and cannot reach

`%%step` has seven types, and the two that write are `CreateEntity` and
`UpdateEntity`. `UpdateEntity` reaches another entity through `targetSource` — a
row id a previous step published — or `targetField`, **a foreign key on the
triggering row**. There is no step that *searches*: nothing looks a row up by a
column value, and `%%loop` is a while-loop over the triggering record, not an
iterator over child rows (`automations.loops`, and nesting is refused outright).

That one limit decides the whole of this gate.

## The five built as sagas

| Workflow | Trigger | What it does |
|---|---|---|
| `AppointmentCheckIn` | rule — `status == 'checked_in'` | Creates the `Encounter`, carrying the patient, doctor, department and the appointment's own id |
| `AdmissionTakesBed` | **automatic**, `operation: CREATE` | `Bed.status → occupied` |
| `DischargeReleasesBed` | rule — `status == 'discharged'` | `Bed.status → cleaning` |
| `EncounterInvoicing` | rule — `status == 'closed' and isBillable` | Creates the `Invoice` in `draft`, with zero amounts |
| `ConsentWithdrawal` | rule — `isWithdrawn == true` | `Procedure.status → planned` |

`AdmissionTakesBed` is the only one on `trigger: automatic`, and deliberately:
**every** admission takes its bed, so a rule whose condition is `true` would be a
gate that never refuses anything. The other four are conditional, which is what
`trigger: rule` is for.

`EncounterInvoicing` drafts the bill with zeros rather than a total, because the
lines do not exist yet — `applyPolicyCoPay` and the line arithmetic fill it in,
and `refuseUnbalancedSplit` is what stops a bill leaving `draft` before they
have.

## The two that had to be handlers

**`raiseProcedureCharge`** · a completed procedure becomes an invoice line. The
step would need to find the invoice for the procedure's encounter —
`Procedure → Encounter → Invoice` — and `targetField` reaches one hop along a
foreign key on the triggering row, not three hops ending in a search.

**`decrementStockOnDispense`** · a dispensed prescription decrements the store.
It needs *one movement per prescription item*, and there is no step that
iterates children. It also needs each item's medicine resolved to a stocked
item — see below.

Both are declared `%%hook afterUpdate`, so the generator scaffolds a real handler
module for each. They are in the model and visible in the viewer's hook list;
what they are not is drawn as a ladder, because drawing a ladder the executor
could not run would be worse than naming the handler that can.

They join the four arithmetic handlers for the same underlying reason: **a step
writes a literal.** `applyPolicyCoPay`, the `paid_amount` running total,
`applyStockMovement` and the invoice `gross_amount` all compute; these two search
and iterate. Neither is in the step vocabulary.

## A missing link the stock effect exposed

`Medication` is the catalogue and `InventoryItem` is the store, and **nothing
joined them**. A dispense could not decrement stock because it could not find
which stocked item a medicine is.

Added: `Medication.inventory_item_id FK OPTIONAL`, drawn as
`InventoryItem ||--o{ Medication : stocked_as`. Optional, because not every
medicine is stocked — a patient's own supply, or one ordered in for them.

This is the kind of gap Gate D exists to find: both entities were complete and
correct on their own, and the effect that crosses them was the only thing that
asked the question.

## Two edges the sagas required, both found mechanically

A saga that writes a status the state machine draws no edge to is refused by the
entity-access guard with a 403 — **the trigger fires, the write is rejected, and
the record it was meant to move sits still.** So every state write in every saga
was checked against its machine rather than read over:

```
PASS  InvoiceSettlement     → Invoice.status   = paid
PASS  InvoicePartPayment    → Invoice.status   = part_paid
PASS  AppointmentCheckIn    → new Encounter.status = open   (initial: open)
PASS  AdmissionTakesBed     → Bed.status       = occupied
PASS  DischargeReleasesBed  → Bed.status       = cleaning
PASS  EncounterInvoicing    → new Invoice.status = draft    (initial: draft)
PASS  ConsentWithdrawal     → Procedure.status  = planned

7 state writes checked, 0 problems
```

Two of those pass only because the check was run:

1. **`consented --> planned : withdraw_consent`** did not exist. `ProcedureLifecycle`
   drew `planned → consented` and no way back, so withdrawing consent would have
   triggered a saga the guard refused. Added, with
   `%%rbac role:doctor|nurse on Procedure.withdraw_consent`.
2. **`part_paid --> part_paid : receive_part_payment`** did not exist. A *second*
   partial payment on an already part-paid bill writes `part_paid` onto a record
   already in `part_paid` — a self-transition the diagram never drew. Added.

Neither is visible to the checker, which validates the diagram and the saga
separately and never asks whether one can perform the other. The script that
found them is `saga-check.mjs`, and it reads the same `ViewModel` the viewers
draw from.

## What is still owed at Phase 6

1. **The derived rule context.** Twenty-one rules read values that are not
   columns of the row being written — `bedStatus`, `consentCount`,
   `hasControlledItem`, `activeSameClassCount`, `outstandingAmount`,
   `quantityOnHand`, `policyValid`, `isBillable` and the rest. Generate the
   application and confirm the rules engine is given them.
2. **The six handlers.** `applyPolicyCoPay`, `applyStockMovement`,
   `raiseProcedureCharge`, `decrementStockOnDispense`, `stampEncounterStart` and
   the `paid_amount` total. Confirm the generator scaffolds a module for each.
3. **The `%%trigger` gap.** Nothing raises `overdue` on a date. Stated in the
   `Invoice` dossier; not closeable in EML today.
