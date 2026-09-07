# Invoice — dossier

Phase 4, entity 25 of 30. **Standalone**, Billing. Where your Gate A decision —
*an insurer, with policies and co-pay* — is finally enforced rather than
described.

## 1 · Fields

| Column | Type | Modifiers | Help |
|---|---|---|---|
| `id` | string | PK | — |
| `invoice_number` | string | UK, required | The hospital's own number. Generated, never typed. |
| `patient_id` | string | FK, required | Whose episode this is. |
| `status` | string | required, enum | Where the bill has got to. |
| `gross_amount` | decimal | required | What the episode cost, before the policy. The sum of the lines. |
| `insurer_amount` | decimal | required | The share the insurer is asked for. |
| `patient_amount` | decimal | required | The co-payment. |
| `paid_amount` | decimal | required | What has actually been received. |
| `issued_on` | date | optional | The day the bill was raised. |
| `due_on` | date | optional | The day it falls due. |
| `encounter_id` | string | FK, optional | The outpatient contact being billed. |
| `admission_id` | string | FK, optional | The stay being billed. |
| `insurance_policy_id` | string | FK, optional | The cover being claimed against. Empty for self-pay. |
| `notes` | text | optional | Anything the billing office records. |

## Why `patient_id` is here when I removed it three times elsewhere

At `Consent`, `LabOrder`, `ImagingOrder` and `Prescription` I removed a direct
`patient_id` because `→ Encounter → Patient` already resolved and two paths can
disagree. **Here the argument runs the other way**, and it is worth being
explicit about why rather than looking inconsistent:

An invoice does not always price an encounter. An admission spans many
encounters and is billed as one stay, and a self-pay outpatient bill may cover
several contacts. So there is **no single mandatory path** to the patient — the
patient is the only anchor every invoice has. `encounter_id` and `admission_id`
are both optional details of *which* episode, and `invoiceEpisodeGate` refuses a
bill that names neither.

## 2 · Enums

```
%%enum InvoiceStatus: draft, issued, submitted, rejected, part_paid, paid, overdue, written_off, cancelled
```

Nine states, and `submitted` / `rejected` are there because Gate A chose the
insurer fork: §1 of the research says claims *can be rejected*, so a rejected
claim is a state the bill sits in and is re-billed from, not an error.

## 3 · Relationships

`Patient`, `Encounter`, `Admission`, `InsurancePolicy` in; `InvoiceLine` and
`Payment` out. Four inbound references, each to a different entity, so each gets
its own drawn edge and its own database constraint.

## 4 · Lifecycle — `InvoiceLifecycle`

The largest machine in the model: nine states, nineteen edges. The shape worth
reading is that **`written_off` is reachable only from `rejected` and
`overdue`** — you cannot forgive a bill that has not first been refused or gone
past due — and that `paid` has no edge out. A settled bill is finished.

Access on the edges is where the money control lives:

```
%%rbac role:billing_clerk    on Invoice.issue
%%rbac role:billing_clerk    on Invoice.submit_claim
%%rbac role:billing_clerk    on Invoice.rebill
%%rbac role:hospital_manager on Invoice.write_off
%%rbac role:hospital_manager on Invoice.cancel
```

A clerk raises, claims and re-bills. **Only a manager forgives money or destroys
a bill.**

## 5 · Rules — and the honest account of the co-pay

§5 of the research asks of *is this policy valid, and what is the co-pay*
whether it merely decides or must act, and answers **act — it sets the amount the
patient owes**. Here is exactly how far the language goes, and where it stops:

| What must happen | How it is expressed |
|---|---|
| Refuse a bill issued against a policy that is not active for the dates charged | `%%action refuseInvalidPolicy validation-error` |
| Refuse a bill whose two shares do not add up to the total | `%%action refuseUnbalancedSplit validation-error` |
| Refuse marking a bill overdue before its due date | `%%action refuseEarlyOverdue validation-error` |
| **Compute** the split from the policy's `copay_percentage` | `%%hook beforeUpdate applyPolicyCoPay on Invoice` |

**The computation is a hook, not a rule, and that is a limit of EML rather than a
preference.** A `%%action … transform` writes a **literal** value into a field —
`field: severity value: major` — and a saga's `Formula` step takes a literal
`operand`. Neither can multiply a gross amount by a percentage that lives on
another row. So the arithmetic belongs in a lifecycle handler, which the
generator scaffolds as a real module.

What the rule then does is make the hook **non-optional**: `refuseUnbalancedSplit`
means a bill whose co-pay was never applied cannot be issued. The hook computes;
the rule refuses to let a bill through without it. That pairing is the model's
answer to a requirement the directive vocabulary cannot express on its own, and I
would rather write it down than quietly downgrade the requirement.

## 6 · Hooks

```
%%hook beforeCreate stampInvoiceNumber on Invoice
%%hook beforeUpdate applyPolicyCoPay  on Invoice
```

## 7 · Cross-entity effects

Two, both inbound from `Payment` — `InvoiceSettlement` and `InvoicePartPayment`.
See that dossier.

Outbound, deferred to Phase 5: an invoice is *created* when an encounter or an
admission closes (§3 of the research). That is a saga on `Encounter` and
`Admission`, and it is cross-cutting by definition — it belongs to Gate D, not
to this entity.

## 8 · Access

| Operation | Roles |
|---|---|
| read / create / update | `billing_clerk`, `hospital_manager`, `administrator` |
| delete | `administrator` |

No clinician reads an invoice. §7's segregation, in the direction that is easy to
forget: the point is not only that billing cannot read the notes, but that the
ward cannot read the money.

## Open questions

**Nothing raises `overdue` on its own.** The transition exists, it is enforced,
and `refuseEarlyOverdue` stops it being crossed too soon — but *noticing* that
today is past `due_on` is a scheduled job, and EML has no directive that fires on
a date. `%%trigger` exists in the language and is `validated` only: the checker
knows it, nothing generates from it.

So the model expresses the control and not the clock. That is a real gap between
§5's *"is this invoice overdue — it escalates to collections"* and what the
generated application does. Worth knowing before you read the seventh rule as
covering it.

---

## Phase 6 repair — `policy_verified`, and what it replaced

`refuseInvalidPolicy` read `policyValid`, a fact about the `InsurancePolicy`
row. It is now **`policy_verified boolean`** on the invoice, set by
`applyPolicyCoPay` — the handler that already had to read the policy to compute
the split.

That is a better arrangement than the original: the invoice now records *that
the cover was checked and passed*, which is a fact a billing office wants on the
record, and the rule reads it from the row it is given.
