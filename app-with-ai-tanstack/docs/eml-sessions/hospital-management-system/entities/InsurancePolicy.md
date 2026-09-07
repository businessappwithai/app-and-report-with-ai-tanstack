# InsurancePolicy — dossier

Phase 4, entity 8 of 30. Where your Gate A billing decision — *an insurer, with
policies and co-pay* — first becomes columns.

## 1 · Fields

| Column | Type | Modifiers | Help text |
|---|---|---|---|
| `id` | string | PK | — |
| `patient_id` | string | FK, required | The patient this cover belongs to. |
| `insurer_name` | string | required | The company underwriting the policy, as it should appear on a claim. |
| `policy_number` | string | UK, required | The insurer's own reference. Unique, and quoted on every claim. |
| `policy_type` | string | required, enum | What kind of cover this is, which decides what may be claimed under it. |
| `valid_from` | date | required | The first day the cover applies. |
| `valid_to` | date | required | The last day it applies. An invoice dated outside these two is not claimable. |
| `coverage_limit` | decimal | required | The most the insurer will pay across the policy period. |
| `copay_percentage` | decimal | required | The share of each bill the patient pays themselves, as a percentage. The billing rule computes the split from this. |
| `is_primary` | boolean | required | Which policy to claim against first, where a patient holds more than one. Exactly one should be ticked. |
| `status` | string | required, enum | Whether the cover is live. Driven by the lifecycle below. |

## 2 · Enums

```
%%enum PolicyType: individual, family, corporate, government
%%enum PolicyStatus: active, expired, cancelled, suspended
```

## 3 · Relationships

| Direction | Other entity | Cardinality | FK lives on |
|---|---|---|---|
| in | `Patient` | many-to-one | `InsurancePolicy.patient_id` |
| out | `Invoice` | one-to-many | `Invoice.insurance_policy_id` |

A patient holds several policies over time — an expired one is kept because the
invoices claimed against it must still resolve.

## 4 · Lifecycle — `PolicyLifecycle`

```
[*] --> active
active    --> suspended : suspend
suspended --> active    : reinstate
active    --> expired   : expire
active    --> cancelled : cancel
suspended --> cancelled : cancel
expired   --> [*]
cancelled --> [*]
```

Small, and worth drawing rather than deriving from the dates. A policy can be
**suspended** for non-payment of premium and reinstated, which no date range
expresses; and `cancelled` is not `expired` — one is the insurer or the patient
ending it early, the other is time running out, and a claim behaves differently
against each.

There is no edge back from `expired`: a policy that has run its term is not
reinstated, it is replaced by a new one.

## 5 · Rules

**None on this entity.** The eligibility judgement — *is this policy valid, and
what is the co-pay* — is made when an invoice is raised, so it lives on
`Invoice`. Noted for Phase 5.

## 6 · Hooks

**None.**

## 7 · Cross-entity effects

One, landing on `Invoice`: an invoice may only be claimed against a policy that
is `active` and whose date range contains the invoice date. Recorded here,
built there, checked at Gate D.

## 8 · Access

| Operation | Roles |
|---|---|
| read | `billing_clerk`, `receptionist`, `hospital_manager`, `administrator` |
| create / update | `billing_clerk`, `receptionist`, `hospital_manager`, `administrator` |
| transition `cancel` / `suspend` | `billing_clerk`, `hospital_manager` |

**Notably not `doctor` or `nurse`.** This is the segregation from §7 of the
research working in the other direction: clinicians read the patient and the
clinical record and have no business in their financial arrangements. A doctor
who can see a patient's coverage limit is a doctor who can be influenced by it.

## Open questions

`is_primary` is a boolean where the constraint is really "exactly one per
patient". EML cannot express that, so it is a convention the application has to
keep. If you would rather it were enforced, the shape that does it is a
`primary_policy_id` on `Patient` — say so and I will re-walk `Patient`.
