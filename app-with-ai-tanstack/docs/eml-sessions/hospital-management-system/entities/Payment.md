# Payment — dossier

Phase 4, entity 27 of 30. **Standalone**, Billing. Money arriving, and the two
sagas that move the bill when it does.

## Why standalone rather than a child of `Invoice`

§10.2 question 1: *"show me everything received today"* is the cash-reconciliation
screen a billing office opens every afternoon, and it crosses invoices. A child
cannot be that screen. It is the same test that made `Consent` standalone and
`InvoiceLine` a child.

## 1 · Fields

| Column | Type | Modifiers | Help |
|---|---|---|---|
| `id` | string | PK | — |
| `receipt_number` | string | UK, required | The receipt given. Generated, never typed. |
| `invoice_id` | string | FK, required | The bill the money was received against. |
| `received_by_id` | string | FK, required | Who took it. Every receipt has a name against it. |
| `payer_type` | string | required, enum | Insurer, patient, or third party. |
| `method` | string | required, enum | How the money arrived. |
| `amount` | decimal | required | How much. |
| `received_on` | date | required | The day it was received. |
| `bank_reference` | string | optional | The reference it arrived with, for reconciling against a statement. |

## 2 · Enums

```
%%enum PayerType:     insurer, patient, third_party
%%enum PaymentMethod: cash, card, bank_transfer, cheque, insurer_settlement
```

`payer_type` and `method` are two questions, not one. An insurer settles by bank
transfer and so does a patient; a patient pays cash and a third party sometimes
does too. Collapsing them into one enum would make *who paid* unanswerable
without reading how.

## 3 · Relationships

| Direction | Other entity | Cardinality | FK lives on |
|---|---|---|---|
| in | `Invoice` | many-to-one | `Payment.invoice_id` |
| in | `Staff` | many-to-one | `Payment.received_by_id` |

## 4 · Lifecycle

**None**, and deliberately. Money received is a fact, not a process. Reversing
one is a second record, not a state change on the first — which is also why
`refuseNonPositivePayment` exists rather than a negative amount being allowed
through as a refund.

## 5 · Rules — two, at two different moments

**`paymentPostingGate`** · `beforeCreate` · refuses a non-positive amount, and
refuses more than the bill still owes. An overpayment recorded against a bill is
how a ledger stops reconciling.

**`paymentSettlementGate`** · `afterCreate` · fires one of two sagas:

```
%%action settleInvoice  trigger-workflow when: settlesInvoice == true  workflow: InvoiceSettlement
%%action partPayInvoice trigger-workflow when: settlesInvoice == false workflow: InvoicePartPayment
```

Two actions on one rule, mutually exclusive, each naming its own workflow. This
is the shape §3.4 wants: the decision is *does this clear the balance*, and the
consequence is a write on another row — so it is a rule that triggers a saga,
not a rule that returns a verdict nobody applies.

## 6 · Hooks

```
%%hook beforeCreate stampReceiptNumber on Payment
```

## 7 · Cross-entity effects — the two sagas

```
%%workflow InvoiceSettlement  entity: Payment kind: saga trigger: rule
%%step B UpdateEntity entity: Invoice targetField: invoice_id field: status value: paid

%%workflow InvoicePartPayment entity: Payment kind: saga trigger: rule
%%step B UpdateEntity entity: Invoice targetField: invoice_id field: status value: part_paid
```

Both reach the parent bill through `targetField: invoice_id`, the same mechanism
the two critical-result escalations use.

**Both moves are edges the invoice lifecycle actually draws** — `issued → paid`,
`issued → part_paid`, and the same from `submitted` and `overdue`. That matters:
a saga that wrote a status with no edge from where the record stands would be
refused by the entity-access guard with a 403, and the payment would post while
the bill sat still. The two diagrams have to agree, and I checked that they do.

`paid_amount` is not written by the saga: a step writes one literal, and the new
running total is arithmetic. It belongs with `applyPolicyCoPay`, in the same
handler family, for the same reason the co-pay split does — see the `Invoice`
dossier.

## 8 · Access

| Operation | Roles |
|---|---|
| read / create | `billing_clerk`, `hospital_manager`, `administrator` |
| update | `hospital_manager`, `administrator` |
| delete | `administrator` |

**A clerk may record a payment and may not edit one.** Taking money is the job;
changing the record of money already taken is not, and that gap is where a
cash-handling fraud lives.

## Open questions

None here. The `paid_amount` arithmetic is named above and shares the `Invoice`
dossier's open item about what a hook must do.

---

## Phase 6 repair — `outstanding_before`, and the two sagas it saved

`refuseOverpayment` read `outstandingAmount`, and both settlement actions read
`settlesInvoice` — all three facts about the `Invoice`. Left alone, the two
payment sagas would have been dead: nothing would have triggered them.

The fix is one column: **`outstanding_before decimal`** — what the bill still
owed immediately before this payment — resolved by
`%%hook beforeCreate resolveOutstandingBalance on Payment`. The three conditions
become arithmetic on the receipt itself:

```
refuseOverpayment  amount >  outstandingBefore
settleInvoice      amount >= outstandingBefore
partPayInvoice     amount <  outstandingBefore
```

A receipt that records what was owed before it is better than one that does not.
Any reconciliation asks that question, and now the row answers it.
